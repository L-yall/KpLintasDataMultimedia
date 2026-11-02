var db = require('../config/db');
var MikrotikService = require('./mikrotik');
var EmailService = require('./emailService');
var PdfService = require('./pdfService');
var SocketService = require('./socket');
var Pelanggan = require('../models/Pelanggan');
var logger = require('../utils/logger');

/**
 * Menghitung tanggal jatuh tempo periode berikutnya dengan tanggal yang sama (sadar akhir bulan).
 * Contoh: 31 Jan -> 28 Feb, 28 Feb -> 31 Mar, 31 Mar -> 30 Apr.
 * Mengembalikan objek { date: Date, dateString: 'YYYY-MM-DD' }.
 */
function getNextMonthDueDate(currentDueDate) {
  var d = new Date(currentDueDate);
  if (isNaN(d.getTime())) {
    d = new Date();
  }
  var originalDay = d.getDate();
  var currentMonth = d.getMonth();
  var currentYear = d.getFullYear();

  var lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  var isLastDayOfMonth = originalDay === lastDayOfCurrentMonth;

  var nextMonth = currentMonth + 1;
  var nextYear = currentYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }

  var resultDate;
  if (isLastDayOfMonth) {
    resultDate = new Date(nextYear, nextMonth + 1, 0);
  } else {
    resultDate = new Date(nextYear, nextMonth, originalDay);
    if (resultDate.getMonth() !== nextMonth) {
      resultDate = new Date(nextYear, nextMonth + 1, 0);
    }
  }

  var yy = resultDate.getFullYear();
  var mm = String(resultDate.getMonth() + 1).padStart(2, '0');
  var dd = String(resultDate.getDate()).padStart(2, '0');
  var dateStr = `${yy}-${mm}-${dd}`;
  resultDate._dateString = dateStr;
  return { date: resultDate, dateString: dateStr };
}

/**
 * Menghitung periode bulan berikutnya dalam format YYYY-MM
 */
function getNextPeriodString(periode) {
  var parts = (periode || '').split('-');
  var year = parseInt(parts[0], 10) || new Date().getFullYear();
  var month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  if (month >= 12) {
    month = 1;
    year += 1;
  } else {
    month += 1;
  }
  return year + '-' + (month < 10 ? '0' + month : month);
}

var BillingService = {
  getNextMonthDueDate: getNextMonthDueDate,
  getNextPeriodString: getNextPeriodString,

  /**
   * Menyelesaikan pembayaran tagihan secara aman dengan MySQL ACID Transaction.
   * @param {Object} params
   *   - id_tagihan: number
   *   - id_admin: number|null
   *   - id_pembayaran: number|null
   *   - payment_method: string
   *   - bukti_file: string|null
   */
  settlePayment: function (params) {
    return new Promise(function (resolve, reject) {
      var id_tagihan = params.id_tagihan;
      var id_admin = params.id_admin || null;
      var id_pembayaran = params.id_pembayaran || null;
      var payment_method = params.payment_method || 'Pembayaran Online';
      var bukti_file = params.bukti_file || ('Pembayaran: ' + payment_method);

      if (!id_tagihan) {
        return reject(new Error('ID Tagihan wajib disertakan.'));
      }

      db.getConnection(function (connErr, conn) {
        if (connErr) {
          return reject(connErr);
        }

        conn.beginTransaction(async function (txErr) {
          if (txErr) {
            conn.release();
            return reject(txErr);
          }

          try {
            // 1. Ambil data tagihan & pelanggan dengan Lock (FOR UPDATE)
            var selectTagihanSql = `
              SELECT 
                t.id_tagihan, t.id_pelanggan, t.periode, t.nominal, t.status AS tagihan_status, t.due_date,
                p.nama, p.email, p.no_hp, p.alamat, p.pppoe_username, p.paket, p.due_date AS cust_due_date, p.status_tagihan AS cust_status
              FROM tagihan t
              JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
              WHERE t.id_tagihan = ?
              FOR UPDATE
            `;

            var tagihanRows = await new Promise(function (res, rej) {
              conn.query(selectTagihanSql, [id_tagihan], function (err, rows) {
                if (err) return rej(err);
                res(rows);
              });
            });

            if (!tagihanRows || tagihanRows.length === 0) {
              await new Promise(res => conn.rollback(res));
              conn.release();
              return reject(new Error('Tagihan #' + id_tagihan + ' tidak ditemukan.'));
            }

            var bill = tagihanRows[0];

            // Jika sudah lunas, commit dan kembalikan idempotent status
            if (bill.tagihan_status === 'lunas' && !id_pembayaran) {
              await new Promise(res => conn.commit(res));
              conn.release();
              return resolve({
                success: true,
                alreadyPaid: true,
                message: 'Tagihan ini sudah lunas sebelumnya.'
              });
            }

            // 2. Insert atau Update data pembayaran
            var finalPaymentId = id_pembayaran;
            if (finalPaymentId) {
              await new Promise(function (res, rej) {
                conn.query(
                  "UPDATE pembayaran SET status = 'diterima', verified_at = NOW(), id_admin = ? WHERE id_pembayaran = ?",
                  [id_admin, finalPaymentId],
                  function (err, r) {
                    if (err) return rej(err);
                    res(r);
                  }
                );
              });
            } else {
              // Periksa apakah sudah ada entri pembayaran pending untuk tagihan ini
              var existingPem = await new Promise(function (res, rej) {
                conn.query(
                  "SELECT id_pembayaran FROM pembayaran WHERE id_tagihan = ? AND status = 'pending' ORDER BY id_pembayaran DESC LIMIT 1",
                  [id_tagihan],
                  function (err, rows) {
                    if (err) return rej(err);
                    res(rows && rows[0] ? rows[0].id_pembayaran : null);
                  }
                );
              });

              if (existingPem) {
                finalPaymentId = existingPem;
                await new Promise(function (res, rej) {
                  conn.query(
                    "UPDATE pembayaran SET status = 'diterima', verified_at = NOW(), id_admin = ?, bukti_file = ? WHERE id_pembayaran = ?",
                    [id_admin, bukti_file, finalPaymentId],
                    function (err, r) {
                      if (err) return rej(err);
                      res(r);
                    }
                  );
                });
              } else {
                var insertPem = await new Promise(function (res, rej) {
                  conn.query(
                    "INSERT INTO pembayaran (id_tagihan, id_admin, bukti_file, status, tanggal_upload, verified_at) VALUES (?, ?, ?, 'diterima', NOW(), NOW())",
                    [id_tagihan, id_admin, bukti_file],
                    function (err, r) {
                      if (err) return rej(err);
                      res(r);
                    }
                  );
                });
                finalPaymentId = insertPem.insertId;
              }
            }

            // 3. Update status tagihan menjadi 'lunas'
            await new Promise(function (res, rej) {
              conn.query(
                "UPDATE tagihan SET status = 'lunas', updated_at = NOW() WHERE id_tagihan = ?",
                [id_tagihan],
                function (err, r) {
                  if (err) return rej(err);
                  res(r);
                }
              );
            });

            // 4. Hitung tanggal jatuh tempo baru (1 bulan ke depan)
            var baseDueDate = bill.due_date || bill.cust_due_date || new Date();
            var nextDueObj = getNextMonthDueDate(baseDueDate);
            var newDueDateString = nextDueObj.dateString;

            // 5. Update pelanggan: status 'hijau' & due_date baru
            await new Promise(function (res, rej) {
              conn.query(
                "UPDATE pelanggan SET status_tagihan = 'hijau', due_date = ?, updated_at = NOW() WHERE id_pelanggan = ?",
                [newDueDateString, bill.id_pelanggan],
                function (err, r) {
                  if (err) return rej(err);
                  res(r);
                }
              );
            });

            // 6. Buat tagihan periode berikutnya jika belum ada
            var nextPeriod = getNextPeriodString(bill.periode);
            var nextBillExisting = await new Promise(function (res, rej) {
              conn.query(
                "SELECT id_tagihan FROM tagihan WHERE id_pelanggan = ? AND periode = ?",
                [bill.id_pelanggan, nextPeriod],
                function (err, rows) {
                  if (err) return rej(err);
                  res(rows && rows.length > 0 ? rows[0] : null);
                }
              );
            });

            if (!nextBillExisting) {
              // Ambil harga paket terbaru pelanggan
              var pkgPrice = await new Promise(function (res, rej) {
                conn.query(
                  "SELECT pl.harga FROM pelanggan p LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket WHERE p.id_pelanggan = ?",
                  [bill.id_pelanggan],
                  function (err, rows) {
                    if (err) return rej(err);
                    res(rows && rows[0] && rows[0].harga ? rows[0].harga : bill.nominal);
                  }
                );
              });

              await new Promise(function (res, rej) {
                conn.query(
                  "INSERT INTO tagihan (id_pelanggan, periode, nominal, status, due_date) VALUES (?, ?, ?, 'belum_bayar', ?)",
                  [bill.id_pelanggan, nextPeriod, pkgPrice, newDueDateString],
                  function (err, r) {
                    if (err) return rej(err);
                    res(r);
                  }
                );
              });
            }

            // 7. Catat notifikasi jika belum ada
            if (finalPaymentId) {
              await new Promise(function (res) {
                conn.query(
                  "INSERT INTO notifikasi (id_pembayaran, id_admin, status_baca) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE id_pembayaran = id_pembayaran",
                  [finalPaymentId, id_admin],
                  function () { res(); }
                );
              });
            }

            // Commit Transaksi
            await new Promise(function (res, rej) {
              conn.commit(function (cErr) {
                if (cErr) return rej(cErr);
                res();
              });
            });

            conn.release();

            // PROSES SETELAH TRANSAKSI (MikroTik, Email, WebSocket)
            // 8. Buka blokir / aktifkan PPPoE di MikroTik
            var pppoeStatus = 'unknown';
            if (bill.pppoe_username) {
              try {
                var mRes = await MikrotikService.enableSecret(bill.pppoe_username);
                if (mRes) pppoeStatus = 'active';
              } catch (mErr) {
                logger.error('BILLING', `Gagal enable secret di MikroTik: ${mErr.message}`);
              }
            }

            // 9. Kirim email konfirmasi lunas & lampirkan Invoice PDF
            if (bill.email) {
              try {
                var pdfBuffer = await PdfService.generateInvoicePdf({
                  id_tagihan: bill.id_tagihan,
                  periode: bill.periode,
                  nominal: bill.nominal,
                  status: 'lunas',
                  due_date: newDueDateString,
                  created_at: new Date(),
                  nama: bill.nama,
                  email: bill.email,
                  no_hp: bill.no_hp || '-',
                  alamat: bill.alamat || '-',
                  paket: bill.paket || '-'
                }, true);

                var dueDateFormatted = nextDueObj.date.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });

                var tglBayarStr = new Date().toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                await EmailService.sendPaymentApprovedEmail(bill.email, {
                  nama: bill.nama,
                  periode: bill.periode,
                  nominal: Number(bill.nominal).toLocaleString('id-ID'),
                  dueDateFormatted: dueDateFormatted,
                  tanggalBayar: tglBayarStr,
                  metodePembayaran: payment_method
                }, pdfBuffer);
              } catch (emailErr) {
                console.error('[BillingService] Gagal mengirim email konfirmasi pembayaran:', emailErr.message);
              }
            }

            // 10. Broadcast WebSocket ke Admin dan Portal
            SocketService.broadcast('pelanggan_updated', {
              id_pelanggan: bill.id_pelanggan,
              status_tagihan: 'hijau',
              due_date: newDueDateString,
              pppoe_status: pppoeStatus
            });

            SocketService.broadcast('pembayaran_masuk', {
              id_pembayaran: finalPaymentId,
              id_tagihan: bill.id_tagihan,
              nama_pelanggan: bill.nama,
              tanggal_upload: new Date()
            });

            return resolve({
              success: true,
              message: 'Pembayaran tagihan #' + id_tagihan + ' berhasil diselesaikan.',
              data: {
                id_tagihan: bill.id_tagihan,
                id_pelanggan: bill.id_pelanggan,
                new_due_date: newDueDateString,
                next_period: nextPeriod
              }
            });

          } catch (err) {
            await new Promise(res => conn.rollback(res));
            conn.release();
            return reject(err);
          }
        });
      });
    });
  },

  /**
   * Memastikan setiap pelanggan aktif memiliki tagihan berjalan di tabel tagihan
   */
  ensureActiveBills: function () {
    var sql = `
      SELECT p.id_pelanggan, p.nama, p.due_date, p.paket, pl.harga 
      FROM pelanggan p 
      LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket
      WHERE p.due_date IS NOT NULL AND p.pppoe_username IS NOT NULL AND p.pppoe_username != '' AND p.pppoe_username NOT LIKE 'REG-%'
    `;
    db.query(sql, function (err, customers) {
      if (err || !customers) return;

      customers.forEach(function (c) {
        var checkSql = 'SELECT id_tagihan FROM tagihan WHERE id_pelanggan = ? AND status != ? LIMIT 1';
        db.query(checkSql, [c.id_pelanggan, 'lunas'], function (cErr, existing) {
          if (cErr || (existing && existing.length > 0)) return;

          var d = new Date(c.due_date);
          if (isNaN(d.getTime())) return;

          var y = d.getFullYear();
          var m = String(d.getMonth() + 1).padStart(2, '0');
          var periode = `${y}-${m}`;
          var dueStr = d.toISOString().split('T')[0];
          var nominal = c.harga || 150000;

          var insertSql = 'INSERT INTO tagihan (id_pelanggan, periode, nominal, due_date, status) VALUES (?, ?, ?, ?, ?)';
          db.query(insertSql, [c.id_pelanggan, periode, nominal, dueStr, 'belum_bayar'], function (insErr, res) {
            if (!insErr && res) {
              logger.info('BILLING', `Tagihan otomatis #${res.insertId} dibuat untuk ${c.nama} (${periode})`);
              SocketService.broadcast('tagihan_created', {
                id_tagihan: res.insertId,
                id_pelanggan: c.id_pelanggan,
                nama: c.nama,
                periode: periode,
                nominal: nominal
              });
            }
          });
        });
      });
    });
  }
};

module.exports = BillingService;

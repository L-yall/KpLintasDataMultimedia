var cron = require('node-cron');
var Tagihan = require('../models/Tagihan');
var Pelanggan = require('../models/Pelanggan');
var ReminderLog = require('../models/ReminderLog');
var EmailService = require('./emailService');
var PdfService = require('./pdfService');
var SocketService = require('./socket');
var MikrotikService = require('./mikrotik');
var BillingService = require('./billingService');
var ConfigService = require('./configService');
var logger = require('../utils/logger');

// Helper to calculate difference in days between two dates
function getDaysDifference(date1, date2) {
  var d1 = new Date(date1.toISOString().split('T')[0]);
  var d2 = new Date(date2.toISOString().split('T')[0]);
  var diffTime = d1.getTime() - d2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

var CronService = {
  start: function() {
    logger.box({
      title: 'CRON JOB & AUTOMATION SERVICE',
      subtitle: 'Evaluator Tagihan, Auto-Isolir & Invoice Tagihan (H-14)',
      color: 'cyan',
      items: [
        { label: 'Status Service', value: 'Aktif & Siap', color: 'green' },
        { label: 'Jadwal Otomatis', value: 'Setiap Hari Pukul 07:00 WIB' },
        { label: 'Jadwal Invoice', value: 'H-14 Sebelum Jatuh Tempo' },
        { label: 'Zona Waktu', value: 'Asia/Jakarta (WIB)' },
        { label: 'Otomasi Fitur', value: 'Isolir PPPoE & Lampiran PDF Invoice' }
      ]
    });
    
    // Schedule to run every day at 07:00 AM
    cron.schedule('0 7 * * *', () => {
      logger.info('CRON', 'Menjalankan evaluasi harian tagihan (07:00 WIB)...');
      this.checkAndSendReminders();
    }, {
      scheduled: true,
      timezone: 'Asia/Jakarta'
    });

    // Jalankan verifikasi tagihan dan evaluasi di background (non-blocking agar npm start instan)
    setTimeout(() => {
      BillingService.ensureActiveBills();
      this.checkAndSendReminders();
    }, 2500);
  },

  sendInvoicesNow: async function() {
    var unpaidBills = await new Promise(function(resolve, reject) {
      Tagihan.getUnpaid(function(err, bills) {
        if (err) return reject(err);
        resolve(bills);
      });
    });
    var summary = {
      total: unpaidBills.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    var today = new Date();

    for (var i = 0; i < unpaidBills.length; i++) {
      var bill = unpaidBills[i];
      var result = await this.processEmailReminder(
        bill,
        getDaysDifference(new Date(bill.due_date), today)
      );

      if (result.status === 'sent') {
        summary.sent++;
      } else if (result.status === 'skipped') {
        summary.skipped++;
      } else {
        summary.failed++;
        summary.errors.push({
          email: bill.email || null,
          message: result.error
        });
      }
    }

    return summary;
  },

  checkAndSendReminders: async function() {
    var today = new Date();
    
    // We fetch all active unpaid bills
    var unpaidBills;
    try {
      unpaidBills = await new Promise(function(resolve, reject) {
        Tagihan.getUnpaid(function(err, bills) { err ? reject(err) : resolve(bills); });
      });
    } catch (err) {
      logger.once('cron_db_err', 'warn', 'CRON', `Menunggu database siap: ${err.message}`);
      return;
    }
    var routerClients = new Map();
    async function getRouterClient(id) {
      var key = id == null ? 'default' : String(id);
      if (!routerClients.has(key)) {
        routerClients.set(key, (async function() {
          try {
            var client = await MikrotikService.forRouter(id);
            var ping = await client.ping();
            if (ping && ping.online) return client;
            logger.warn('CRON', `Router #${key} offline, isolir dilewati.`);
          } catch (err) {
            logger.warn('CRON', `Router #${key}: ${err.message}; isolir dilewati.`);
          }
          return null;
        })());
      }
      return routerClients.get(key);
    }

    if (unpaidBills.length > 0) {
      logger.info('CRON', `Mengevaluasi ${unpaidBills.length} tagihan aktif belum lunas...`);
    }

    var dueDaysConfig = parseInt(ConfigService.get('REMINDER_DUE_DAYS', '14'), 10) || 14;

    for (var i = 0; i < unpaidBills.length; i++) {
      var bill = unpaidBills[i];
      var dueDate = new Date(bill.due_date);
      var daysDiff = getDaysDifference(dueDate, today);

      var newStatus = 'hijau';
      var shouldSendReminder = false;

      if (daysDiff < 0) {
        // Overdue / Late
        newStatus = 'merah';
        shouldSendReminder = true; // Email tetap dikirim setiap hari saat menunggak

        if (bill.status !== 'terlambat') {
          Tagihan.updateStatus(bill.id_tagihan, 'terlambat', function(err) {
            if (err) console.error('Failed to update bill status to terlambat:', err.message);
          });
        }

        // Connectivity is checked once per bill's router, not once globally.
        if (bill.pppoe_username) {
          try {
            var mikrotik = await getRouterClient(bill.id_router);
            var isolirResult = mikrotik ? await mikrotik.disableSecret(bill.pppoe_username) : null;
            if (isolirResult && isolirResult.success) {
              logger.warn('CRON', `Berhasil isolir PPPoE '${isolirResult.secretName || bill.pppoe_username}' (${bill.nama}) - ${isolirResult.kickedCount || 0} sesi aktif diputus.`);
            }
          } catch (mikrotikErr) {
            logger.error('CRON', `Gagal mengisolir MikroTik untuk ${bill.pppoe_username}: ${mikrotikErr.message}`);
          }
        }
      } else if (daysDiff >= 0 && daysDiff <= 3) {
        // Due in 0 to 3 days (mendekati jatuh tempo)
        newStatus = 'kuning';
      } else {
        // Far from due date
        newStatus = 'hijau';
      }

      // Evaluasi jadwal pengiriman Invoice Tagihan (H-14 jatuh tempo)
      if (daysDiff >= 0) {
        if (daysDiff === dueDaysConfig) {
          // Tepat pada H-14 sebelum jatuh tempo
          shouldSendReminder = true;
        } else if (daysDiff < dueDaysConfig) {
          // Cek apakah invoice tagihan periode ini sudah pernah terkirim ke pelanggan
          var alreadySentPeriod = await new Promise(function(resolve) {
            ReminderLog.hasBeenSentForPeriod(bill.id_pelanggan, bill.periode, function(err, sent) {
              resolve(!err && sent);
            });
          });
          if (!alreadySentPeriod) {
            // Belum pernah dikirim untuk periode tagihan ini
            shouldSendReminder = true;
          } else if (daysDiff === 0) {
            // Pengingat khusus hari-H jatuh tempo
            shouldSendReminder = true;
          }
        }
      }

      // 1. Update customer status if changed
      if (bill.status_tagihan !== newStatus) {
        const idPelanggan = bill.id_pelanggan;
        const targetStatus = newStatus;
        const idRouter = bill.id_router;
        const updateData = { status_tagihan: targetStatus };

        Pelanggan.update(idPelanggan, updateData, function(updateErr) {
          if (updateErr) {
            logger.error('CRON', `Gagal memperbarui status pelanggan #${idPelanggan}: ${updateErr.message}`);
          } else {
            logger.info('CRON', `Status pelanggan #${idPelanggan} (${bill.nama}) -> ${targetStatus}`);
            SocketService.broadcast('pelanggan_updated', {
              id_pelanggan: idPelanggan,
              id_router: idRouter,
              status_tagihan: targetStatus
            });
          }
        });
      }

      // 2. Send Email Invoice/Reminder if shouldSendReminder is true
      if (shouldSendReminder) {
        // Mengirimkan data daysDiff agar pesan email bisa dibedakan
        await this.processEmailReminder(bill, daysDiff);
      }
    }

    if (unpaidBills.length > 0) {
      logger.info('CRON', `Evaluasi billing selesai (${unpaidBills.length} tagihan diperiksa).`);
    }
  },

  processEmailReminder: async function(bill, daysDiff) {
    var idPelanggan = bill.id_pelanggan;
    var name = bill.nama;
    var email = bill.email;
    var nominal = Number(bill.nominal).toLocaleString('id-ID');
    var dueDateString = new Date(bill.due_date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    var periode = bill.periode;
    var paymentUrl = `${process.env.PAYMENT_PORTAL_URL || 'http://localhost:3001/bayar'}/${encodeURIComponent(email)}`;

    // Check if customer has email
    if (!email) {
      console.log(`[Cron Service] Pelanggan ${name} tidak memiliki email. Skipping reminder/invoice.`);
      return { status: 'skipped', reason: 'Pelanggan tidak memiliki email.' };
    }

    var alreadySent = await new Promise(function(resolve) {
      ReminderLog.hasBeenSentToday(idPelanggan, function(err, sent) {
        resolve({ error: err, sent: sent });
      });
    });
    if (alreadySent.error) {
      logger.error('CRON', `Gagal memeriksa log invoice tagihan untuk ${name}: ${alreadySent.error.message}`);
      return { status: 'failed', error: alreadySent.error.message };
    }

    // Mencegah spam jika cron terpicu lebih dari sekali pada hari yang sama.
    if (alreadySent.sent) {
      console.log(`[Cron Service] Reminder/Invoice already sent today to ${name} (${email}). Skipping.`);
      return { status: 'skipped', reason: 'Invoice sudah dikirim hari ini.' };
    }

    var message = `Halo ${name},\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n`;

    if (daysDiff < 0) {
      message += `🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode ${periode} sebesar *Rp ${nominal}* TELAH LEWAT JATUH TEMPO pada tanggal ${dueDateString}.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\n`;
    } else if (daysDiff === 0) {
      message += `⚠️ *JATUH TEMPO HARI INI* ⚠️\nTagihan internet Anda untuk periode ${periode} sebesar *Rp ${nominal}* telah jatuh tempo pada hari ini (${dueDateString}).\n\n`;
    } else {
      message += `📄 *INVOICE TAGIHAN INTERNET* 📄\nInvoice tagihan internet Anda untuk periode ${periode} sebesar *Rp ${nominal}* telah diterbitkan (Jatuh tempo pada ${dueDateString}, ${daysDiff} hari lagi).\n\n`;
    }

    message += `Silakan lakukan pembayaran dan konfirmasi melalui portal kami:\n${paymentUrl}\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.`;

    var pdfBuffer = null;
    try {
      pdfBuffer = await PdfService.generateInvoicePdf({
        id_tagihan: bill.id_tagihan,
        periode: bill.periode,
        nominal: bill.nominal,
        status: bill.status,
        due_date: bill.due_date,
        created_at: bill.created_at || new Date(),
        nama: name,
        email: email,
        no_hp: bill.no_hp || '-',
        alamat: bill.alamat || '-',
        paket: bill.paket || '-'
      }, false);
    } catch (pdfErr) {
      console.error('[Cron Service] Failed to generate PDF invoice:', pdfErr.message);
    }

    var result;
    try {
      result = await EmailService.sendReminderEmail(email, {
        nama: name,
        periode: periode,
        nominal: nominal,
        dueDateString: dueDateString,
        paymentUrl: paymentUrl,
        daysDiff: daysDiff,
        paket: bill.paket || '-',
        idPelanggan: idPelanggan,
        idTagihan: bill.id_tagihan,
        alamat: bill.alamat || '-'
      }, pdfBuffer);
    } catch (emailErr) {
      result = { success: false, error: emailErr.message };
    }

    var logError = await new Promise(function(resolve) {
      ReminderLog.create({
        id_pelanggan: idPelanggan,
        status_kirim: result.success ? 'terkirim' : 'gagal',
        pesan: message,
        tanggal_kirim: new Date()
      }, function(err) {
        resolve(err || null);
      });
    });

    if (logError) {
      logger.error('CRON', `Gagal mencatat log invoice tagihan untuk ${name}: ${logError.message}`);
      return { status: 'failed', error: logError.message };
    }

    if (!result.success) {
      logger.error('CRON', `Gagal mengirim invoice tagihan untuk ${name}: ${result.error || 'Kesalahan tidak diketahui'}`);
      return { status: 'failed', error: result.error || 'Pengiriman email gagal.' };
    }

    logger.success('CRON', `Invoice tagihan berhasil dikirim & dicatat untuk ${name}`);
    return { status: 'sent' };
  }
};

module.exports = CronService;

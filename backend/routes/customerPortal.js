var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var axios = require('axios');
var db = require('../config/db');
var verifyCustomerToken = require('../middleware/customerAuth');
var SocketService = require('../services/socket');

// Midtrans Webhook Callback endpoint (Public - must be BEFORE verifyCustomerToken)
router.post('/midtrans-callback', function (req, res) {
  var notification = req.body;

  // Jika payload tidak lengkap (seperti ping test dari Midtrans Dashboard), berikan respon 200 OK agar tes berhasil
  if (!notification || !notification.order_id || !notification.status_code || !notification.gross_amount || !notification.signature_key) {
    console.log('[Midtrans Callback] Received dashboard ping / test request.');
    return res.status(200).json({ success: true, message: 'Test notification received successfully' });
  }

  var order_id = notification.order_id;
  var status_code = notification.status_code;
  var gross_amount = notification.gross_amount;
  var signature_key = notification.signature_key;

  var serverKey = process.env.MIDTRANS_SERVER_KEY || '';

  // Verify signature_key
  var payload = order_id + status_code + gross_amount + serverKey;
  var computedHash = crypto.createHash('sha512').update(payload).digest('hex');

  if (computedHash !== signature_key) {
    console.error('[Midtrans Callback] Invalid Signature Key! Verification failed.');
    // Tetap kembalikan 200 agar dashboard tidak error, namun dengan status sukses false
    return res.status(200).json({ success: false, message: 'Invalid signature key' });
  }

  // Parse id_tagihan from order_id (e.g. 'TRX-12-1783492810' -> id_tagihan = 12)
  var parts = order_id.split('-');
  var id_tagihan = parseInt(parts[1], 10);
  if (isNaN(id_tagihan)) {
    console.error('[Midtrans Callback] Failed to parse id_tagihan from order_id:', order_id);
    return res.status(200).json({ success: false, message: 'Invalid order ID format' });
  }

  var transaction_status = notification.transaction_status;
  var fraud_status = notification.fraud_status;
  var payment_type = notification.payment_type;

  console.log(`[Midtrans Callback] Received status for Tagihan #${id_tagihan}: status=${transaction_status}, type=${payment_type}`);

  // We consider success when status is settlement or capture with fraud accept
  var isSuccess = transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept');

  if (isSuccess) {
    // 1. Get Tagihan and Customer Info
    var selectSql = `
      SELECT t.*, p.nama, p.no_hp, p.email, p.pppoe_username, p.due_date 
      FROM tagihan t 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      WHERE t.id_tagihan = ?
    `;
    db.query(selectSql, [id_tagihan], function (err, results) {
      if (err) {
        console.error('[Midtrans Callback] Database error:', err.message);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        console.error('[Midtrans Callback] Tagihan not found for ID:', id_tagihan);
        return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
      }

      var billing = results[0];

      // If the bill is already paid, do nothing
      if (billing.status === 'lunas') {
        console.log(`[Midtrans Callback] Tagihan #${id_tagihan} is already lunas. Skipping duplicate processing.`);
        return res.json({ success: true, message: 'Tagihan sudah lunas.' });
      }

      // Proceed with approval flow
      // 2. Create Pembayaran entry with status 'diterima'
      var relativePath = 'Midtrans / ' + payment_type + ' / ' + transaction_status;
      var insertSql = `
        INSERT INTO pembayaran (id_tagihan, bukti_file, status, tanggal_upload, verified_at, id_admin) 
        VALUES (?, ?, 'diterima', NOW(), NOW(), NULL)
      `;
      db.query(insertSql, [id_tagihan, relativePath], function (err, paymentResult) {
        if (err) {
          console.error('[Midtrans Callback] Failed to insert payment:', err.message);
          return res.status(500).json({ success: false, message: 'Failed to record payment' });
        }

        var id_pembayaran = paymentResult.insertId;

        // 3. Update tagihan status to 'lunas'
        var TagihanModel = require('../models/Tagihan');
        TagihanModel.updateStatus(id_tagihan, 'lunas', function (tagihanErr) {
          if (tagihanErr) {
            console.error('[Midtrans Callback] Failed to update tagihan status:', tagihanErr.message);
            return res.status(500).json({ success: false, message: 'Failed to update bill status' });
          }

          // 4. Update pelanggan: set status to 'hijau' and extend due_date by 30 days
          var currentDueDate = new Date(billing.due_date);
          var newDueDate = new Date(currentDueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          var newDueDateString = newDueDate.toISOString().split('T')[0];

          var PelangganModel = require('../models/Pelanggan');
          PelangganModel.update(billing.id_pelanggan, {
            status_tagihan: 'hijau',
            due_date: newDueDateString
          }, async function (pelangganErr) {
            if (pelangganErr) {
              console.error('[Midtrans Callback] Failed to update customer status:', pelangganErr.message);
            }

            // 5. Generate next month's bill in tagihan table
            var parts = billing.periode.split('-');
            var year = parseInt(parts[0], 10);
            var month = parseInt(parts[1], 10);
            if (month === 12) {
              month = 1;
              year += 1;
            } else {
              month += 1;
            }
            var nextPeriod = year + '-' + (month < 10 ? '0' + month : month);

            // Get customer package price for accuracy
            var nominal = await new Promise((resolve) => {
              db.query(`
                SELECT pl.harga 
                FROM pelanggan p 
                JOIN paket_layanan pl ON p.paket = pl.nama_paket 
                WHERE p.id_pelanggan = ?
              `, [billing.id_pelanggan], (err, rows) => {
                resolve(rows && rows[0] ? rows[0].harga : billing.nominal);
              });
            });

            TagihanModel.create({
              id_pelanggan: billing.id_pelanggan,
              periode: nextPeriod,
              nominal: nominal,
              status: 'belum_bayar',
              due_date: newDueDateString
            }, async function (nextBillErr) {
              if (nextBillErr) {
                console.error('[Midtrans Callback] Failed to generate next month bill:', nextBillErr.message);
              }

              // 6. Enable PPPoE in Mikrotik if username is present
              var pppoeStatus = 'unknown';
              if (billing.pppoe_username) {
                try {
                  var MikrotikService = require('../services/mikrotik');
                  var mRes = await MikrotikService.enableSecret(billing.pppoe_username);
                  if (mRes) pppoeStatus = 'active';
                } catch (mikrotikErr) {
                  console.error(`[Midtrans Callback] Failed to enable PPPoE ${billing.pppoe_username}:`, mikrotikErr.message);
                }
              }

              // 7. Send Email confirmation of approval
              if (billing.email) {
                try {
                  var EmailService = require('../services/emailService');
                  var dueDateFormatted = newDueDate.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });

                  await EmailService.sendPaymentApprovedEmail(billing.email, {
                    nama: billing.nama,
                    periode: billing.periode,
                    nominal: Number(billing.nominal).toLocaleString('id-ID'),
                    dueDateFormatted: dueDateFormatted
                  });
                } catch (emailErr) {
                  console.error('[Midtrans Callback] Failed to send confirmation email:', emailErr.message);
                }
              }

              // 8. Broadcast websocket updates
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: billing.id_pelanggan,
                status_tagihan: 'hijau',
                pppoe_status: pppoeStatus
              });

              SocketService.broadcast('pembayaran_masuk', {
                id_pembayaran: id_pembayaran,
                id_tagihan: id_tagihan,
                nama_pelanggan: billing.nama,
                tanggal_upload: new Date()
              });

              console.log(`[Midtrans Callback] Tagihan #${id_tagihan} successfully processed and re-activated!`);
              return res.json({ success: true, message: 'Pembayaran berhasil diproses!' });
            });
          });
        });
      });
    });
  } else {
    // For pending/failed/expired transactions, just return success acknowledgment to Midtrans
    console.log(`[Midtrans Callback] Acknowledging transaction status: ${transaction_status}`);
    return res.json({ success: true, message: 'Status callback received: ' + transaction_status });
  }
});

// Protect all portal routes with customer JWT token
router.use(verifyCustomerToken);

// Multer Upload Configuration
var uploadDir = path.join(__dirname, '../public/uploads/bukti');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bukti-' + uniqueSuffix + path.extname(file.originalname));
  }
});

var upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Max 5MB
  }
});

/* GET /api/customer/portal/billing - Get active bill for customer */
router.get('/billing', function (req, res) {
  var id_pelanggan = req.customerId;

  function sendBillingResponse(billingData) {
    var lastPaymentSql = `
      SELECT pem.*, t.periode, t.nominal 
      FROM pembayaran pem 
      JOIN tagihan t ON pem.id_tagihan = t.id_tagihan 
      WHERE t.id_pelanggan = ? 
      ORDER BY pem.tanggal_upload DESC 
      LIMIT 1
    `;
    db.query(lastPaymentSql, [id_pelanggan], function (payErr, payResults) {
      var lastPayment = null;
      if (!payErr && payResults && payResults[0]) {
        lastPayment = payResults[0];
      }
      res.json({
        success: true,
        data: billingData,
        lastPayment: lastPayment
      });
    });
  }

  var sql = `
    SELECT t.*, p.nama, p.paket, p.status_tagihan 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_pelanggan = ? AND t.status != 'lunas'
    ORDER BY t.due_date ASC 
    LIMIT 1
  `;

  db.query(sql, [id_pelanggan], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      // Check if we need to generate the first/missing tagihan for their current due_date
      var checkCustSql = `
        SELECT p.*, pl.harga 
        FROM pelanggan p
        LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket
        WHERE p.id_pelanggan = ?
      `;
      db.query(checkCustSql, [id_pelanggan], function (custErr, custResults) {
        if (custErr || custResults.length === 0) {
          return sendBillingResponse(null);
        }

        var customer = custResults[0];
        if (!customer.due_date || !customer.harga) {
          return sendBillingResponse(null);
        }

        // Format due_date to YYYY-MM period
        var d = new Date(customer.due_date);
        var year = d.getFullYear();
        var month = d.getMonth() + 1;
        var period = year + '-' + (month < 10 ? '0' + month : month);

        // Check if a bill for this period already exists
        var checkBillSql = 'SELECT * FROM tagihan WHERE id_pelanggan = ? AND periode = ?';
        db.query(checkBillSql, [id_pelanggan, period], function (billErr, billResults) {
          if (billErr || billResults.length > 0) {
            return sendBillingResponse(null);
          }

          console.log(`[Billing Service] Generating missing bill for customer ${customer.nama} (${period})`);
          var Tagihan = require('../models/Tagihan');
          Tagihan.create({
            id_pelanggan: id_pelanggan,
            periode: period,
            nominal: customer.harga,
            status: 'belum_bayar',
            due_date: customer.due_date
          }, function (createBillErr, newBill) {
            if (createBillErr) {
              console.error('[Billing Service] Failed to generate bill:', createBillErr.message);
              return res.status(500).json({ success: false, message: 'Gagal membuat tagihan otomatis', error: createBillErr.message });
            }

            sendBillingResponse({
              id_tagihan: newBill.id_tagihan,
              id_pelanggan: id_pelanggan,
              periode: period,
              nominal: customer.harga,
              status: 'belum_bayar',
              due_date: customer.due_date,
              nama: customer.nama,
              paket: customer.paket,
              status_tagihan: customer.status_tagihan
            });
          });
        });
      });
      return;
    }

    sendBillingResponse(results[0]);
  });
});

/* POST /api/customer/portal/pay - Upload payment proof */
router.post('/pay', function (req, res) {
  upload.single('bukti')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    var { id_tagihan } = req.body;
    var customerId = req.customerId;

    if (!id_tagihan) {
      return res.status(400).json({ success: false, message: 'ID Tagihan wajib disertakan.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti transfer wajib diunggah.' });
    }

    // Verify that the bill belongs to the logged-in customer
    var verifySql = 'SELECT * FROM tagihan WHERE id_tagihan = ? AND id_pelanggan = ?';
    db.query(verifySql, [id_tagihan, customerId], function (err, results) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        if (req.file) {
          fs.unlink(req.file.path, () => { });
        }
        return res.status(403).json({ success: false, message: 'Akses ditolak. Tagihan bukan milik Anda.' });
      }

      var tagihan = results[0];
      if (tagihan.status === 'lunas') {
        if (req.file) {
          fs.unlink(req.file.path, () => { });
        }
        return res.status(400).json({ success: false, message: 'Tagihan ini sudah lunas.' });
      }
      if (tagihan.status === 'menunggu_verifikasi') {
        if (req.file) {
          fs.unlink(req.file.path, () => { });
        }
        return res.status(400).json({ success: false, message: 'Pembayaran untuk tagihan ini sedang menunggu verifikasi admin.' });
      }

      var relativePath = '/uploads/bukti/' + req.file.filename;

      // 1. Insert into pembayaran table
      var insertSql = `
        INSERT INTO pembayaran (id_tagihan, bukti_file, status, tanggal_upload) 
        VALUES (?, ?, 'pending', NOW())
      `;
      db.query(insertSql, [id_tagihan, relativePath], function (err, paymentResult) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Gagal mencatat pembayaran.', error: err.message });
        }

        // 2. Update tagihan status to 'menunggu_verifikasi'
        var updateSql = "UPDATE tagihan SET status = 'menunggu_verifikasi' WHERE id_tagihan = ?";
        db.query(updateSql, [id_tagihan], function (err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Gagal memperbarui status tagihan.' });
          }

          // Broadcast notification to Admin dashboard (Tahap 6)
          SocketService.broadcast('pembayaran_masuk', {
            id_pembayaran: paymentResult.insertId,
            id_tagihan: id_tagihan,
            nama_pelanggan: results[0].nama,
            tanggal_upload: new Date()
          });

          res.json({
            success: true,
            message: 'Bukti transfer berhasil diunggah! Pembayaran Anda sedang menunggu verifikasi admin.',
            data: {
              id_pembayaran: paymentResult.insertId,
              bukti_file: relativePath
            }
          });
        });
      });
    });
  });
});

// GET /api/customer/portal/midtrans-config - Get Client Key for Snap SDK initialization
router.get('/midtrans-config', function (req, res) {
  var clientKey = process.env.MIDTRANS_CLIENT_KEY || '';
  var serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  var isSandbox = process.env.MIDTRANS_IS_SANDBOX === 'true' || serverKey.startsWith('SB-') || clientKey.startsWith('SB-');
  res.json({
    success: true,
    clientKey: clientKey,
    isSandbox: isSandbox
  });
});

// POST /api/customer/portal/midtrans-token - Request Midtrans Snap Token for a bill
router.post('/midtrans-token', function (req, res) {
  var { id_tagihan } = req.body;
  var customerId = req.customerId;

  if (!id_tagihan) {
    return res.status(400).json({ success: false, message: 'ID Tagihan wajib disertakan.' });
  }

  // Verify that the bill belongs to the logged-in customer and is not paid yet
  var sql = `
    SELECT t.*, p.nama, p.email, p.no_hp 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ? AND t.id_pelanggan = ?
  `;
  db.query(sql, [id_tagihan, customerId], function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(403).json({ success: false, message: 'Tagihan tidak ditemukan atau bukan milik Anda.' });
    }

    var billing = results[0];
    if (billing.status === 'lunas') {
      return res.status(400).json({ success: false, message: 'Tagihan ini sudah lunas.' });
    }

    // Generate unique order ID
    var orderId = 'TRX-' + id_tagihan + '-' + Date.now();
    var serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    var isSandbox = process.env.MIDTRANS_IS_SANDBOX === 'true' || serverKey.startsWith('SB-');

    var snapUrl = isSandbox
      ? 'https://app.sandbox.midtrans.com/snap/v1/transactions'
      : 'https://app.midtrans.com/snap/v1/transactions';

    // Call Midtrans Snap API
    var authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');

    var payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(billing.nominal))
      },
      credit_card: {
        secure: true
      },
      customer_details: {
        first_name: billing.nama,
        email: billing.email || (billing.no_hp + '@ldm.net'),
        phone: billing.no_hp
      }
    };

    axios.post(snapUrl, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    })
      .then(function (midtransRes) {
        res.json({
          success: true,
          token: midtransRes.data.token,
          redirect_url: midtransRes.data.redirect_url
        });
      })
      .catch(function (midtransErr) {
        console.error('[Midtrans Token API] Error:', midtransErr.response?.data || midtransErr.message);
        res.status(500).json({
          success: false,
          message: 'Gagal membuat transaksi di Midtrans. Silakan coba metode transfer biasa.',
          error: midtransErr.response?.data || midtransErr.message
        });
      });
  });
});

module.exports = router;

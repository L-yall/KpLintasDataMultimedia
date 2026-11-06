var express = require('express');
var router = express.Router();
var Pembayaran = require('../models/Pembayaran');
var verifyToken = require('../middleware/auth');
var Tagihan = require('../models/Tagihan');
var Pelanggan = require('../models/Pelanggan');
var MikrotikService = require('../services/mikrotik');
var EmailService = require('../services/emailService');
var PdfService = require('../services/pdfService');
var SocketService = require('../services/socket');
var BillingService = require('../services/billingService');

// Protect all payment routes with an authenticated admin token.
router.use(verifyToken);

/* GET /api/pembayaran/pending - Get all pending payment approvals */
router.get('/pending', function (req, res) {
  Pembayaran.getAllPending(function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pembayaran/midtrans - Get all Midtrans online payments */
router.get('/midtrans', function (req, res) {
  var db = require('../config/db');
  var sql = `
    SELECT 
      pem.*, 
      t.periode, 
      t.nominal, 
      p.nama, 
      p.no_hp
    FROM pembayaran pem
    JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
    WHERE pem.bukti_file LIKE 'Midtrans%'
    ORDER BY pem.tanggal_upload DESC
  `;
  db.query(sql, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pembayaran/duitku - Get all Duitku online payments */
router.get('/duitku', function (req, res) {
  var db = require('../config/db');
  var sql = `
    SELECT 
      pem.*, 
      t.periode, 
      t.nominal, 
      p.nama, 
      p.no_hp
    FROM pembayaran pem
    JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
    WHERE pem.bukti_file LIKE 'Duitku%'
    ORDER BY pem.tanggal_upload DESC
  `;
  db.query(sql, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pembayaran/manual - Get all approved manual-transfer payments */
router.get('/manual', function (req, res) {
  Pembayaran.getAllApprovedManual(function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* POST /api/pembayaran/:id/approve - Approve payment proof (Admin & Super Admin) */
router.post('/:id/approve', function (req, res) {
  var id_pembayaran = req.params.id;
  var id_admin = req.adminId; // extracted from verifyToken middleware

  Pembayaran.getById(id_pembayaran, async function (err, payment) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Data konfirmasi pembayaran tidak ditemukan.' });
    }

    if (payment.status === 'diterima') {
      return res.status(400).json({ success: false, message: 'Pembayaran ini sudah diverifikasi sebelumnya.' });
    }

    try {
      var settleResult = await BillingService.settlePayment({
        id_tagihan: payment.id_tagihan,
        id_admin: id_admin,
        id_pembayaran: id_pembayaran,
        payment_method: 'Manual Transfer Bank'
      });

      SocketService.broadcast('notifikasi_updated', { id_pembayaran: id_pembayaran });
      res.json({
        success: true,
        message: 'Pembayaran disetujui! Status pelanggan lunas, masa aktif diperpanjang, dan akun internet diaktifkan.',
        data: settleResult.data
      });
    } catch (settleErr) {
      console.error('[Pembayaran] Gagal menyetujui pembayaran:', settleErr);
      res.status(500).json({
        success: false,
        message: 'Gagal memverifikasi pembayaran: ' + settleErr.message
      });
    }
  });
});

/* POST /api/pembayaran/:id/reject - Reject payment proof (Admin & Super Admin) */
router.post('/:id/reject', function (req, res) {
  var id_pembayaran = req.params.id;
  var id_admin = req.adminId;
  var { alasan_tolak } = req.body;

  if (!alasan_tolak) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
  }

  Pembayaran.getById(id_pembayaran, function (err, payment) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Data konfirmasi pembayaran tidak ditemukan.' });
    }

    // 1. Set pembayaran status to 'ditolak'
    Pembayaran.verify(id_pembayaran, {
      status: 'ditolak',
      alasan_tolak: alasan_tolak,
      id_admin: id_admin
    }, function (verifyErr, result) {
      if (verifyErr) {
        return res.status(500).json({ success: false, message: 'Gagal memperbarui status verifikasi.' });
      }

      if (!result || result.affectedRows === 0) {
        return res.status(409).json({ success: false, message: 'Pembayaran ini sudah diverifikasi atau ditolak oleh admin lain.' });
      }

      // Calculate if the bill is late or just unpaid
      var today = new Date();
      var dueDate = new Date(payment.due_date);
      var isLate = today >= dueDate;
      var targetBillStatus = isLate ? 'terlambat' : 'belum_bayar';
      var targetCustomerStatus = isLate ? 'merah' : 'kuning';

      // 2. Revert tagihan status
      Tagihan.updateStatus(payment.id_tagihan, targetBillStatus, function (tagihanErr) {
        if (tagihanErr) {
          return res.status(500).json({ success: false, message: 'Gagal memperbarui status tagihan.' });
        }

        // 3. Revert pelanggan billing status
        Pelanggan.update(payment.id_pelanggan, { status_tagihan: targetCustomerStatus }, async function (pelangganErr) {
          if (pelangganErr) {
            console.error('Gagal memperbarui status pelanggan:', pelangganErr.message);
          }

          // 4. Send Email notification to customer with rejection reason
          if (payment.email) {
            var nominal = Number(payment.nominal).toLocaleString('id-ID');
            var paymentUrl = `${process.env.PAYMENT_PORTAL_URL || 'http://localhost:3001/bayar'}/${encodeURIComponent(payment.email)}`;

            await EmailService.sendPaymentRejectedEmail(payment.email, {
              nama: payment.nama,
              periode: payment.periode,
              nominal: nominal,
              alasan_tolak: alasan_tolak,
              paymentUrl: paymentUrl
            });
          } else {
            console.log('[Pembayaran] Pelanggan tidak memiliki email, notifikasi penolakan dilewati.');
          }

          // 5. Broadcast status updates
          SocketService.broadcast('pelanggan_updated', {
            id_pelanggan: payment.id_pelanggan,
            status_tagihan: targetCustomerStatus
          });

          // Trigger billing check immediately in background to update status & send reminder if due
          var CronService = require('../services/cronService');
          CronService.checkAndSendReminders();

          SocketService.broadcast('notifikasi_updated', { id_pembayaran: id_pembayaran });
      res.json({
            success: true,
            message: 'Pembayaran ditolak. Notifikasi penolakan telah dikirim ke Email pelanggan.'
          });
        });
      });
    });
  });
});

/* GET /api/pembayaran/invoice/:id_tagihan/pdf - Download or view PDF Invoice */
router.get('/invoice/:id_tagihan/pdf', function (req, res) {
  var idTagihan = req.params.id_tagihan;
  var db = require('../config/db');
  var sql = `
    SELECT t.*, p.nama, p.no_hp, p.email, p.alamat, p.paket 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.id_tagihan = ?
  `;
  db.query(sql, [idTagihan], async function (err, results) {
    if (err || !results || results.length === 0) {
      return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
    }
    var bill = results[0];
    var isPaid = bill.status === 'lunas';
    try {
      var pdfBuffer = await PdfService.generateInvoicePdf(bill, isPaid);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Invoice_${bill.periode}_${idTagihan}.pdf"`);
      res.send(pdfBuffer);
    } catch (pdfErr) {
      res.status(500).json({ success: false, message: 'Gagal membuat PDF invoice', error: pdfErr.message });
    }
  });
});

module.exports = router;

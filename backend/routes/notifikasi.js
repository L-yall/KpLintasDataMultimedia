var express = require('express');
var router = express.Router();
var db = require('../config/db');
var verifyToken = require('../middleware/auth');

// Protect all notification routes with admin JWT
router.use(verifyToken);

/* GET /api/notifikasi - List all notifications (db + virtual fallback) */
router.get('/', function(req, res) {
  var sql = `
    SELECT 
      'pembayaran_masuk' AS tipe,
      n.id_notifikasi,
      n.status_baca,
      n.created_at AS tanggal,
      pem.id_pembayaran,
      pem.bukti_file,
      t.periode,
      t.nominal,
      p.nama AS nama_pelanggan
    FROM notifikasi n
    JOIN pembayaran pem ON n.id_pembayaran = pem.id_pembayaran
    JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
  `;

  db.query(sql, function(err, results) {
    if (err) {
      console.error('[Notification API] Error fetching notifications:', err.message);
      return res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi', error: err.message });
    }

    var existingPaymentNotifIds = new Set(results.map(function(r) { return r.id_pembayaran; }));

    // Fetch pending payments to create virtual notifications if missing in notifikasi table
    var pendingSql = `
      SELECT 
        pem.id_pembayaran,
        pem.bukti_file,
        pem.tanggal_upload AS tanggal,
        t.periode,
        t.nominal,
        p.nama AS nama_pelanggan
      FROM pembayaran pem
      JOIN tagihan t ON pem.id_tagihan = t.id_tagihan
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      WHERE pem.status = 'pending'
    `;

    db.query(pendingSql, function(err2, pendingResults) {
      if (err2) {
        console.error('[Notification API] Error fetching pending payments:', err2.message);
        return res.status(500).json({ success: false, message: 'Gagal mengambil pembayaran pending', error: err2.message });
      }

      var virtualPendingNotifs = pendingResults
        .filter(function(p) { return !existingPaymentNotifIds.has(p.id_pembayaran); })
        .map(function(p) {
          return {
            tipe: 'pembayaran_masuk',
            id_notifikasi: 'virtual-pem-' + p.id_pembayaran,
            status_baca: 0,
            tanggal: p.tanggal,
            id_pembayaran: p.id_pembayaran,
            bukti_file: p.bukti_file,
            periode: p.periode,
            nominal: p.nominal,
            nama_pelanggan: p.nama_pelanggan
          };
        });

      db.query("SELECT id_pelanggan, nama, paket, created_at FROM pelanggan WHERE pppoe_username LIKE 'REG-%'", function(regErr, registrations) {
        if (regErr) {
          console.error('[Notification API] Error fetching pending registrations:', regErr.message);
          return res.status(500).json({ success: false, message: 'Gagal mengambil registrasi pelanggan.' });
        }

        var registrationNotifs = registrations.map(function(registration) {
          return {
            tipe: 'registrasi_masuk',
            id_notifikasi: 'virtual-reg-' + registration.id_pelanggan,
            id_pelanggan: registration.id_pelanggan,
            status_baca: 0,
            tanggal: registration.created_at,
            nama_pelanggan: registration.nama,
            paket: registration.paket
          };
        });
        var allNotifs = [...results, ...virtualPendingNotifs, ...registrationNotifs];

        allNotifs.sort(function(a, b) {
          return new Date(b.tanggal) - new Date(a.tanggal);
        });

        res.json({
          success: true,
          data: allNotifs
        });
      });
    });
  });
});

/* PUT /api/notifikasi/read-all - Mark all unread notifications as read */
router.put('/read-all', function(req, res) {
  db.query("UPDATE notifikasi SET status_baca = 1 WHERE status_baca = 0", function(err) {
    if (err) {
      console.error('[Notification API] Error reading all notifications:', err.message);
      return res.status(500).json({ success: false, message: 'Gagal menandai semua notifikasi dibaca' });
    }
    res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca.' });
  });
});

/* PUT /api/notifikasi/:id/read - Mark a specific notification as read */
router.put('/:id/read', function(req, res) {
  var id = req.params.id;
  if (id.startsWith('virtual-')) {
    // Virtual notification, cannot write to DB. Return mock success
    return res.json({ success: true, message: 'Notifikasi dibaca.' });
  }

  db.query("UPDATE notifikasi SET status_baca = 1 WHERE id_notifikasi = ?", [id], function(err) {
    if (err) {
      console.error('[Notification API] Error reading notification:', err.message);
      return res.status(500).json({ success: false, message: 'Gagal membaca notifikasi' });
    }
    res.json({ success: true, message: 'Notifikasi ditandai telah dibaca.' });
  });
});

module.exports = router;

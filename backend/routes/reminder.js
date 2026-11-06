var express = require('express');
var router = express.Router();
var ReminderLog = require('../models/ReminderLog');
var CronService = require('../services/cronService');
var verifyToken = require('../middleware/auth');

// All reminder logs are protected with JWT
router.use(verifyToken);

/* GET /api/reminder/logs - Get all reminder logs for admin panel */
router.get('/logs', function(req, res) {
  ReminderLog.getAll(function(err, results) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data log reminder',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: results
    });
  });
});

/* POST /api/reminder/trigger-cron - Manually trigger billing check and reminder routing */
router.post('/trigger-cron', async function(req, res) {
  try {
    console.log('[API] Manual invoice send initiated by admin');
    var result = await CronService.sendInvoicesNow();
    if (result.failed > 0) {
      return res.status(502).json({
        success: false,
        message: `${result.sent} invoice terkirim, ${result.failed} gagal, dan ${result.skipped} dilewati.`,
        data: result
      });
    }
    res.json({
      success: true,
      message: result.total === 0
        ? 'Tidak ada tagihan belum lunas untuk dikirim.'
        : `${result.sent} invoice terkirim dan ${result.skipped} dilewati.`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal menjalankan proses pengiriman invoice tagihan secara manual',
      error: err.message
    });
  }
});

/* DELETE /api/reminder/logs/:id - Delete a specific reminder log */
router.delete('/logs/:id', function(req, res) {
  var id = req.params.id;
  ReminderLog.delete(id, function(err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal menghapus log invoice tagihan', error: err.message });
    }
    res.json({ success: true, message: 'Log invoice tagihan berhasil dihapus.' });
  });
});

/* DELETE /api/reminder/logs - Clear all reminder logs */
router.delete('/logs', function(req, res) {
  ReminderLog.clearAll(function(err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal membersihkan log invoice tagihan', error: err.message });
    }
    res.json({ success: true, message: 'Semua log invoice tagihan berhasil dibersihkan.' });
  });
});

module.exports = router;

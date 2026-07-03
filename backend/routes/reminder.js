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
    console.log('[API] Manual trigger of cron check initiated by admin');
    await CronService.checkAndSendReminders();
    res.json({
      success: true,
      message: 'Proses pengecekan tagihan dan pengiriman reminder Email berhasil dijalankan!'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal menjalankan proses reminder secara manual',
      error: err.message
    });
  }
});

module.exports = router;

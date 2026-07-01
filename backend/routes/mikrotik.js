var express = require('express');
var router = express.Router();
var MikrotikService = require('../services/mikrotik');
var verifyToken = require('../middleware/auth');
var Pelanggan = require('../models/Pelanggan');

// Protect all mikrotik routes with JWT
router.use(verifyToken);

/* GET /api/mikrotik/status - Check connection to Mikrotik */
router.get('/status', async function(req, res) {
  var status = await MikrotikService.ping();
  res.json({
    success: true,
    data: status
  });
});

/* GET /api/mikrotik/secrets - List all PPPoE secrets (for onboarding dropdown) */
router.get('/secrets', async function(req, res) {
  try {
    var secrets = await MikrotikService.getSecrets();
    res.json({
      success: true,
      data: secrets
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil PPPoE secrets dari Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/active - List active connections */
router.get('/active', async function(req, res) {
  try {
    var active = await MikrotikService.getActiveConnections();
    res.json({
      success: true,
      data: active
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil active connections dari Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/unregistered - List active PPPoE not registered in DB */
router.get('/unregistered', async function(req, res) {
  try {
    var activeConns = await MikrotikService.getActiveConnections();
    
    Pelanggan.getAll(function(err, customers) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error',
          error: err.message
        });
      }

      var registeredUsernames = new Set(
        customers
          .map(function(c) { return c.pppoe_username; })
          .filter(Boolean)
      );

      var unregistered = activeConns.filter(function(conn) {
        return !registeredUsernames.has(conn.name);
      });

      res.json({
        success: true,
        data: unregistered
      });
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memproses data Mikrotik',
      error: err.message
    });
  }
});

module.exports = router;

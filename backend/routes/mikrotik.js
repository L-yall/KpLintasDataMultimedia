var express = require('express');
var router = express.Router();
var MikrotikService = require('../services/mikrotik');
var verifyToken = require('../middleware/auth');
var Pelanggan = require('../models/Pelanggan');
var db = require('../config/db');

// Protect all mikrotik routes with JWT
router.use(verifyToken);
router.use(function(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.adminRole)) {
    return res.status(403).json({ success: false, message: 'Akses MikroTik hanya untuk staf.' });
  }
  next();
});
router.use(async function(req, res, next) {
  // Server health must remain available even if no router is configured.
  if (req.path === '/server-health') return next();
  try {
    var id = Object.prototype.hasOwnProperty.call(req.body || {}, 'id_router') ? req.body.id_router : req.query.id_router;
    req.mikrotik = await MikrotikService.forRouter(id);
    next();
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* GET /api/mikrotik/status - Check connection to Mikrotik */
router.get('/status', async function(req, res) {
  try {
    var status = await req.mikrotik.ping();
    res.json({ success: true, id_router: req.mikrotik.id_router, data: status });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* GET /api/mikrotik/secrets - List all PPPoE secrets (for onboarding dropdown) */
router.get('/secrets', async function(req, res) {
  try {
    var secrets = await req.mikrotik.getSecrets();
    db.query(
      "SELECT pppoe_username FROM pelanggan WHERE id_router = ? AND pppoe_username IS NOT NULL AND pppoe_username <> '' AND pppoe_username NOT LIKE 'REG-%'",
      [req.mikrotik.id_router],
      function(err, customers) {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Gagal memeriksa PPPoE yang sudah terdaftar.',
            error: err.message
          });
        }

        var registeredUsernames = new Set(customers.map(function(customer) {
          return customer.pppoe_username;
        }));
        res.json({
          success: true,
          data: secrets.map(function(secret) {
            var dto = { ...secret, id_router: req.mikrotik.id_router, is_registered: registeredUsernames.has(secret.name) };
            delete dto.password;
            delete dto.pass;
            return dto;
          })
        });
      }
    );
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
    var active = await req.mikrotik.getActiveConnections();
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
    var activeConns = await req.mikrotik.getActiveConnections();
    
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
          .filter(function(c) { return String(c.id_router) === String(req.mikrotik.id_router); })
          .map(function(c) { return c.pppoe_username; })
          .filter(Boolean)
      );

      var unregistered = activeConns.filter(function(conn) {
        return !registeredUsernames.has(conn.name);
      });

      res.json({
        success: true,
        data: unregistered,
        id_router: req.mikrotik.id_router
      });
    }, { id_router: req.mikrotik.id_router });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memproses data Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/resources - Telemetri hardware RouterOS */
router.get('/resources', async function(req, res) {
  try {
    var resources = await req.mikrotik.getResources();
    res.json({
      success: true,
      data: resources
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data resource Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/interfaces - Status dan traffic interface fisik & virtual */
router.get('/interfaces', async function(req, res) {
  try {
    var result = await req.mikrotik.getInterfaces();
    res.json({
      success: true,
      data: result.data,
      source: result.source,
      error: result.error || null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data interface Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/logs - Syslog dan event log RouterOS */
router.get('/logs', async function(req, res) {
  try {
    var result = await req.mikrotik.getLogs();
    res.json({
      success: true,
      data: result.data,
      source: result.source,
      error: result.error || null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil log Mikrotik',
      error: err.message
    });
  }
});

/* GET /api/mikrotik/server-health - Status kesehatan server backend & DB */
router.get('/server-health', async function(req, res) {
  try {
    var health = await MikrotikService.getServerHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil status server health',
      error: err.message
    });
  }
});

/* POST /api/mikrotik/sync - Trigger paksa background sync */
router.post('/sync', async function(req, res) {
  try {
    var syncService = require('../services/syncService');
    var result = await syncService.sync(req.mikrotik.id_router);
    res.json({
      success: true,
      message: 'Sinkronisasi data Mikrotik berhasil dijalankan.',
      id_router: req.mikrotik.id_router,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memicu sinkronisasi',
      error: err.message
    });
  }
});

/* POST /api/mikrotik/kick-session - Putus sesi PPPoE aktif secara instan */
router.post('/kick-session', async function(req, res) {
  try {
    var username = req.body.username;
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username PPPoE harus disertakan'
      });
    }

    var result = await req.mikrotik.disconnectSession(username);
    res.json({
      success: true,
      message: result ? `Sesi untuk ${username} berhasil diputus.` : `Tidak ada sesi aktif ditemukan untuk ${username}.`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memutus sesi PPPoE',
      error: err.message
    });
  }
});

/* POST /api/mikrotik/isolir - Nonaktifkan secret PPPoE & putus sesi aktif */
router.post('/isolir', async function(req, res) {
  try {
    var username = req.body.username;
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username PPPoE harus disertakan'
      });
    }

    var result = await req.mikrotik.disableSecret(username);
    res.json({
      success: result.success,
      message: result.success ? `PPPoE '${result.secretName || username}' berhasil diisolir.` : `Gagal: ${result.reason}`,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengisolir PPPoE di MikroTik',
      error: err.message
    });
  }
});

/* POST /api/mikrotik/buka-isolir - Aktifkan kembali secret PPPoE */
router.post('/buka-isolir', async function(req, res) {
  try {
    var username = req.body.username;
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username PPPoE harus disertakan'
      });
    }

    var result = await req.mikrotik.enableSecret(username);
    res.json({
      success: result.success,
      message: result.success ? `PPPoE '${result.secretName || username}' berhasil diaktifkan kembali.` : `Gagal: ${result.reason}`,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengaktifkan kembali PPPoE di MikroTik',
      error: err.message
    });
  }
});

module.exports = router;

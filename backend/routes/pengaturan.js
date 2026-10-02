var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var verifyToken = require('../middleware/auth');
var db = require('../config/db');

// Ensure uploads/logo directory exists
var logoDir = path.join(__dirname, '../public/uploads/logo');
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

// Ensure uploads/qris directory exists
var qrisDir = path.join(__dirname, '../public/uploads/qris');
if (!fs.existsSync(qrisDir)) {
  fs.mkdirSync(qrisDir, { recursive: true });
}

// Multer configuration for logo upload
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, logoDir);
  },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'company_logo' + ext);
  }
});

var upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.indexOf(file.mimetype) === -1) {
      return cb(new Error('Format file tidak didukung. Gunakan PNG atau JPG.'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // Max 2MB sesuai UI
  }
});

// Multer configuration for QRIS upload
var qrisStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, qrisDir);
  },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'company_qris' + ext);
  }
});

var uploadQris = multer({
  storage: qrisStorage,
  fileFilter: function (req, file, cb) {
    var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.indexOf(file.mimetype) === -1) {
      return cb(new Error('Format file tidak didukung. Gunakan PNG atau JPG.'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // Max 2MB
  }
});

/* GET /api/pengaturan/logo - Public endpoint (no auth required) */
/* All pages (landing, portal, login, sidebar) need to read the current logo */
router.get('/logo', function (req, res) {
  var logoFiles = [];
  try {
    logoFiles = fs.readdirSync(logoDir).filter(function (f) {
      return f.startsWith('company_logo');
    });
  } catch (err) {
    // directory might not exist yet
  }

  if (logoFiles.length > 0) {
    var logoFile = logoFiles[0];
    return res.json({
      success: true,
      data: {
        logo_url: '/uploads/logo/' + logoFile,
        updated_at: fs.statSync(path.join(logoDir, logoFile)).mtime
      }
    });
  }

  // Fallback: check for default logo in public root
  var defaultLogo = path.join(__dirname, '../public/logo_ldm.png');
  if (fs.existsSync(defaultLogo)) {
    return res.json({
      success: true,
      data: {
        logo_url: '/logo_ldm.png',
        is_default: true,
        updated_at: fs.statSync(defaultLogo).mtime
      }
    });
  }

  res.json({
    success: true,
    data: null
  });
});

/* GET /api/pengaturan/qris - Public endpoint to get active QRIS image */
router.get('/qris', function (req, res) {
  var qrisFiles = [];
  try {
    qrisFiles = fs.readdirSync(qrisDir).filter(function (f) {
      return f.startsWith('company_qris');
    });
  } catch (err) {
    // directory might not exist yet
  }

  if (qrisFiles.length > 0) {
    var qrisFile = qrisFiles[0];
    return res.json({
      success: true,
      data: {
        qris_url: '/uploads/qris/' + qrisFile,
        is_default: false,
        updated_at: fs.statSync(path.join(qrisDir, qrisFile)).mtime
      }
    });
  }

  // Fallback: default QRIS in public/images/qris.png
  var defaultQris = path.join(__dirname, '../public/images/qris.png');
  if (fs.existsSync(defaultQris)) {
    return res.json({
      success: true,
      data: {
        qris_url: '/images/qris.png',
        is_default: true,
        updated_at: fs.statSync(defaultQris).mtime
      }
    });
  }

  res.json({
    success: true,
    data: null
  });
});

/* GET /api/pengaturan/rekening - Public endpoint to get list of bank accounts */
router.get('/rekening', function (req, res) {
  var activeOnly = req.query.active_only === 'true';
  var sql = activeOnly
    ? 'SELECT *, id_rekening AS id FROM rekening_pembayaran WHERE is_active = 1 ORDER BY id_rekening ASC'
    : 'SELECT *, id_rekening AS id FROM rekening_pembayaran ORDER BY id_rekening ASC';

  db.query(sql, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
    res.json({
      success: true,
      data: results || []
    });
  });
});

// Protect POST/DELETE/PUT routes exclusively for Super Admin
router.use(verifyToken);

/* POST /api/pengaturan/logo - Upload new company logo */
router.post('/logo', function (req, res) {
  // Remove old logo files before uploading new one
  try {
    var existingFiles = fs.readdirSync(logoDir).filter(function (f) {
      return f.startsWith('company_logo');
    });
    existingFiles.forEach(function (f) {
      fs.unlinkSync(path.join(logoDir, f));
    });
  } catch (err) {
    // ignore cleanup errors
  }

  upload.single('logo')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Ukuran file melebihi batas maksimal 2MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Gagal mengunggah logo.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File logo wajib diunggah.'
      });
    }

    var relativePath = '/uploads/logo/' + req.file.filename;
    console.log('[Pengaturan] Logo perusahaan berhasil diperbarui:', relativePath);

    res.json({
      success: true,
      message: 'Logo perusahaan berhasil diperbarui!',
      data: {
        logo_url: relativePath,
        filename: req.file.filename,
        size: req.file.size
      }
    });
  });
});

/* DELETE /api/pengaturan/logo - Reset logo to default */
router.delete('/logo', function (req, res) {
  try {
    var existingFiles = fs.readdirSync(logoDir).filter(function (f) {
      return f.startsWith('company_logo');
    });
    existingFiles.forEach(function (f) {
      fs.unlinkSync(path.join(logoDir, f));
    });
  } catch (err) {
    // ignore
  }

  console.log('[Pengaturan] Logo perusahaan di-reset ke default.');
  res.json({
    success: true,
    message: 'Logo berhasil di-reset ke default.'
  });
});

/* POST /api/pengaturan/qris - Upload new QRIS */
router.post('/qris', function (req, res) {
  try {
    var existingFiles = fs.readdirSync(qrisDir).filter(function (f) {
      return f.startsWith('company_qris');
    });
    existingFiles.forEach(function (f) {
      fs.unlinkSync(path.join(qrisDir, f));
    });
  } catch (err) {
    // ignore
  }

  uploadQris.single('qris')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Ukuran file melebihi batas maksimal 2MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Gagal mengunggah QRIS.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File QRIS wajib diunggah.'
      });
    }

    var relativePath = '/uploads/qris/' + req.file.filename;
    console.log('[Pengaturan] QRIS berhasil diperbarui:', relativePath);

    res.json({
      success: true,
      message: 'QRIS berhasil diperbarui!',
      data: {
        qris_url: relativePath,
        filename: req.file.filename,
        size: req.file.size
      }
    });
  });
});

/* DELETE /api/pengaturan/qris - Reset QRIS to default */
router.delete('/qris', function (req, res) {
  try {
    var existingFiles = fs.readdirSync(qrisDir).filter(function (f) {
      return f.startsWith('company_qris');
    });
    existingFiles.forEach(function (f) {
      fs.unlinkSync(path.join(qrisDir, f));
    });
  } catch (err) {
    // ignore
  }

  console.log('[Pengaturan] QRIS di-reset ke default.');
  res.json({
    success: true,
    message: 'QRIS berhasil di-reset ke default.'
  });
});

/* POST /api/pengaturan/rekening - Add new bank account */
router.post('/rekening', function (req, res) {
  var { nama_bank, nomor_rekening, atas_nama, is_active } = req.body;
  if (!nama_bank || !nomor_rekening || !atas_nama) {
    return res.status(400).json({
      success: false,
      message: 'Nama bank, nomor rekening, dan atas nama wajib diisi.'
    });
  }

  var activeVal = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;
  var sql = 'INSERT INTO rekening_pembayaran (nama_bank, nomor_rekening, atas_nama, is_active) VALUES (?, ?, ?, ?)';
  db.query(sql, [nama_bank.trim(), nomor_rekening.trim(), atas_nama.trim(), activeVal], function (err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
    res.json({
      success: true,
      message: 'Rekening pembayaran berhasil ditambahkan!',
      data: {
        id: result.insertId,
        id_rekening: result.insertId,
        nama_bank: nama_bank.trim(),
        nomor_rekening: nomor_rekening.trim(),
        atas_nama: atas_nama.trim(),
        is_active: activeVal
      }
    });
  });
});

/* PUT /api/pengaturan/rekening/:id - Update bank account */
router.put('/rekening/:id', function (req, res) {
  var { id } = req.params;
  var { nama_bank, nomor_rekening, atas_nama, is_active } = req.body;

  if (!nama_bank || !nomor_rekening || !atas_nama) {
    return res.status(400).json({
      success: false,
      message: 'Nama bank, nomor rekening, dan atas nama wajib diisi.'
    });
  }

  var activeVal = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;
  var sql = 'UPDATE rekening_pembayaran SET nama_bank = ?, nomor_rekening = ?, atas_nama = ?, is_active = ? WHERE id_rekening = ?';
  db.query(sql, [nama_bank.trim(), nomor_rekening.trim(), atas_nama.trim(), activeVal, id], function (err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Rekening pembayaran tidak ditemukan.' });
    }
    res.json({
      success: true,
      message: 'Rekening pembayaran berhasil diperbarui!'
    });
  });
});

/* DELETE /api/pengaturan/rekening/:id - Delete bank account */
router.delete('/rekening/:id', function (req, res) {
  var { id } = req.params;
  var sql = 'DELETE FROM rekening_pembayaran WHERE id_rekening = ?';
  db.query(sql, [id], function (err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Rekening pembayaran tidak ditemukan.' });
    }
    res.json({
      success: true,
      message: 'Rekening pembayaran berhasil dihapus!'
    });
  });
});

var ConfigService = require('../services/configService');
var MikrotikService = require('../services/mikrotik');
var EmailService = require('../services/emailService');

/* GET /api/pengaturan/config - Get all system configurations */
router.get('/config', function (req, res) {
  var configs = ConfigService.getAll();
  res.json({
    success: true,
    data: configs
  });
});

/* POST /api/pengaturan/config - Save system configurations */
router.post('/config', async function (req, res) {
  try {
    var settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Payload konfigurasi tidak valid.' });
    }

    var hasGatewaySetting = Object.prototype.hasOwnProperty.call(settings, 'PAYMENT_GATEWAY_ACTIVE');
    var hasManualSetting = Object.prototype.hasOwnProperty.call(settings, 'MANUAL_PAYMENT_ENABLED');
    var requestedGateway = hasGatewaySetting ? settings.PAYMENT_GATEWAY_ACTIVE : ConfigService.get('PAYMENT_GATEWAY_ACTIVE', 'midtrans');
    var requestedManual = hasManualSetting
      ? String(settings.MANUAL_PAYMENT_ENABLED) === 'true'
      : ConfigService.get('MANUAL_PAYMENT_ENABLED', 'true') === 'true';

    if (hasGatewaySetting && ['midtrans', 'duitku', 'none'].indexOf(requestedGateway) === -1) {
      return res.status(400).json({ success: false, message: 'Gateway pembayaran tidak valid.' });
    }

    if (requestedGateway === 'none' && !requestedManual) {
      return res.status(400).json({ success: false, message: 'Aktifkan pembayaran manual sebelum mematikan semua payment gateway.' });
    }

    await ConfigService.setMany(settings);
    res.json({
      success: true,
      message: 'Konfigurasi sistem berhasil disimpan!',
      data: ConfigService.getAll()
    });
  } catch (err) {
    console.error('[Pengaturan] Error saving config:', err.message);
    res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi: ' + err.message });
  }
});

/* POST /api/pengaturan/test-mikrotik - Test Mikrotik API Connection */
router.post('/test-mikrotik', async function (req, res) {
  try {
    var { host, port, user, pass } = req.body;
    var customConfig = (host && user && pass) ? { host, port, user, pass } : null;
    var result = await MikrotikService.ping(customConfig);

    if (result.online) {
      res.json({
        success: true,
        message: `Koneksi ke Router Mikrotik sukses! (Board: ${result.board}, RouterOS: ${result.version})`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Gagal terhubung ke Router Mikrotik: ${result.error || 'Unknown error'}`
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Error koneksi Mikrotik: ${err.message}`
    });
  }
});

/* POST /api/pengaturan/test-email - Test SMTP Email Connection */
router.post('/test-email', async function (req, res) {
  try {
    var { email_user, email_pass, email_from, target_email } = req.body;
    var recipient = target_email || email_user || ConfigService.get('EMAIL_USER');

    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Email tujuan uji coba wajib diisi.' });
    }

    var customAuth = (email_user && email_pass) ? { user: email_user, pass: email_pass, from: email_from } : null;
    var htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #006876;">Uji Coba Kirim Email - ISP Lintas Data Multimedia</h3>
        <p>Email ini dikirim untuk memverifikasi bahwa konfigurasi SMTP Gmail pada Web Billing telah berfungsi dengan baik.</p>
        <p><strong>Waktu Pengujian:</strong> ${new Date().toLocaleString('id-ID')}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0;">
        <small style="color: #64748b;">Pesan otomatis dari Sistem Pengaturan LDM.</small>
      </div>
    `;

    var result = await EmailService.sendEmail(recipient, '[UJI COBA] Konfigurasi Email Billing LDM', htmlContent, null, customAuth);

    if (result.success && result.status === 'terkirim') {
      res.json({
        success: true,
        message: `Email uji coba berhasil dikirim ke ${recipient}!`
      });
    } else if (result.status === 'simulated') {
      res.json({
        success: true,
        message: `Mode Simulation (Sandbox): Kredensial belum diisi.`
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Gagal mengirim email uji coba: ${result.error || 'Unknown error'}`
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Error pengiriman email: ${err.message}`
    });
  }
});

module.exports = router;


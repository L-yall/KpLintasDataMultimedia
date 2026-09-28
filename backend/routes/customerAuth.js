var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var Pelanggan = require('../models/Pelanggan');
var Otp = require('../models/Otp');
var EmailService = require('../services/emailService');
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var db = require('../config/db');

var rateLimit = require('express-rate-limit');

var registrationUploadDir = path.join(__dirname, '../public/uploads/foto-pelanggan');
if (!fs.existsSync(registrationUploadDir)) {
  fs.mkdirSync(registrationUploadDir, { recursive: true });
}

var registrationUpload = multer({
  storage: multer.diskStorage({
    destination: registrationUploadDir,
    filename: function (req, file, callback) {
      var extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
      callback(null, 'pelanggan-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + extension);
    }
  }),
  fileFilter: function (req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Foto harus berformat JPG, PNG, atau WEBP.'));
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* POST /api/customer/auth/register */
router.post('/register', function (req, res, next) {
  registrationUpload.single('foto')(req, res, function (uploadError) {
    if (uploadError) {
      return res.status(400).json({ success: false, message: uploadError.message });
    }
    next();
  });
}, async function (req, res) {
  var nama = (req.body.nama || '').trim();
  var noHp = (req.body.no_hp || '').trim();
  var email = normalizeEmail(req.body.email);
  var alamat = (req.body.alamat || '').trim();
  var nik = (req.body.nik || '').trim();
  var paket = (req.body.paket || '').trim();
  var password = req.body.password || '';

  function removeUploadedPhoto() {
    if (req.file) fs.unlink(req.file.path, function () {});
  }

  if (!nama || !noHp || !email || !password || !alamat || !nik || !paket || !req.file) {
    removeUploadedPhoto();
    return res.status(400).json({ success: false, message: 'Semua data dan foto wajib diisi.' });
  }
  if (!/^\d{16}$/.test(nik)) {
    removeUploadedPhoto();
    return res.status(400).json({ success: false, message: 'NIK harus terdiri dari 16 digit angka.' });
  }
  if (password.length < 6) {
    removeUploadedPhoto();
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    removeUploadedPhoto();
    return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
  }

  try {
    var existing = await new Promise(function (resolve, reject) {
      db.query('SELECT no_hp, email, nik FROM pelanggan WHERE no_hp = ? OR email = ? OR nik = ? LIMIT 1', [noHp, email, nik], function (err, rows) {
        if (err) return reject(err);
        resolve(rows[0] || null);
      });
    });
    if (existing) {
      removeUploadedPhoto();
      var duplicateMessage = existing.no_hp === noHp ? 'Nomor HP sudah terdaftar.' :
        existing.email === email ? 'Email sudah terdaftar.' : 'NIK sudah terdaftar.';
      return res.status(400).json({ success: false, message: duplicateMessage });
    }

    var selectedPackage = await new Promise(function (resolve, reject) {
      db.query('SELECT nama_paket FROM paket_layanan WHERE nama_paket = ? AND aktif = 1 LIMIT 1', [paket], function (err, rows) {
        if (err) return reject(err);
        resolve(rows[0] || null);
      });
    });
    if (!selectedPackage) {
      removeUploadedPhoto();
      return res.status(400).json({ success: false, message: 'Paket layanan tidak tersedia.' });
    }

    var passwordHash = await bcrypt.hash(password, 10);
    var foto = '/uploads/foto-pelanggan/' + req.file.filename;
    var pendingUsername = 'REG-' + Date.now() + '-' + Math.round(Math.random() * 1e9);
    var registration = await new Promise(function (resolve, reject) {
      db.query(
        "INSERT INTO pelanggan (nama, alamat, no_hp, pppoe_username, paket, due_date, email, password, nik, foto, status_tagihan, pppoe_status) VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, 'abu_abu', 'unknown')",
        [nama, alamat, noHp, pendingUsername, paket, email, passwordHash, nik, foto],
        function (err, result) {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    require('../services/socket').broadcast('registrasi_masuk', { id_pelanggan: registration.insertId, nama: nama });
    res.status(201).json({ success: true, message: 'Registrasi berhasil. Tim kami akan memproses permintaan layanan Anda.' });
  } catch (err) {
    removeUploadedPhoto();
    console.error('[CustomerAuth] Gagal registrasi pelanggan:', err);
    res.status(500).json({ success: false, message: 'Registrasi gagal diproses. Silakan coba kembali.' });
  }
});

var otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 10, // Maksimal 10 permintaan per IP/Window
  message: {
    success: false,
    message: 'Terlalu banyak permintaan OTP. Silakan coba lagi dalam beberapa menit.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/* POST /api/customer/auth/forgot-password/request-otp */
router.post('/forgot-password/request-otp', otpLimiter, function(req, res) {
  var email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ success: false, message: 'Email wajib diisi.' });

  var db = require('../config/db');
  db.query('SELECT * FROM pelanggan WHERE email = ? LIMIT 1', [email], function(err, results) {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Email pelanggan tidak terdaftar.' });

    var customer = results[0];
    var otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    Otp.createOtp(email, otpCode, async function(otpErr) {
      if (otpErr) {
        console.error('[CustomerAuth] Error saat createOtp (forgot-password):', otpErr);
        return res.status(500).json({ success: false, message: 'Gagal membuat OTP.' });
      }
      var sendResult = await EmailService.sendOtpEmail(email, { nama: customer.nama, otp: otpCode, purpose: 'reset password' });
      if (!sendResult.success) {
        console.error('[CustomerAuth] Gagal mengirim OTP email (forgot-password):', sendResult);
        return res.status(500).json({ success: false, message: 'Gagal mengirim OTP.' });
      }
      res.json({ success: true, message: 'OTP reset password telah dikirim ke email.' });
    });
  });
});

/* POST /api/customer/auth/forgot-password/reset */
router.post('/forgot-password/verify-otp', function(req, res) {
  var email = normalizeEmail(req.body.email);
  var otp = req.body.otp;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi.' });

  var db = require('../config/db');
  db.query('SELECT id_pelanggan FROM pelanggan WHERE email = ? LIMIT 1', [email], function(err, results) {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Email pelanggan tidak terdaftar.' });
    Otp.checkOtp(email, otp, function(otpErr, otpRecord) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Database error.' });
      if (!otpRecord) return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa.' });
      res.json({ success: true, message: 'OTP berhasil diverifikasi.' });
    });
  });
});

/* POST /api/customer/auth/forgot-password/reset */
router.post('/forgot-password/reset', function(req, res) {
  var email = normalizeEmail(req.body.email);
  var otp = req.body.otp;
  var newPassword = req.body.newPassword;
  var confirmPassword = req.body.confirmPassword;

  if (!email || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, password baru, dan konfirmasi password wajib diisi.' });
  }
  if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
  if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok.' });

  var db = require('../config/db');
  db.query('SELECT id_pelanggan FROM pelanggan WHERE email = ? LIMIT 1', [email], function(err, results) {
    if (err) return res.status(500).json({ success: false, message: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Email pelanggan tidak terdaftar.' });

    Otp.verifyOtp(email, otp, function(otpErr, otpRecord) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Database error.' });
      if (!otpRecord) return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa.' });

      bcrypt.hash(newPassword, 10, function(hashErr, hash) {
        if (hashErr) return res.status(500).json({ success: false, message: 'Gagal mengenkripsi password.' });
        db.query('UPDATE pelanggan SET password = ? WHERE email = ?', [hash, email], function(updateErr) {
          if (updateErr) return res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
          res.json({ success: true, message: 'Password berhasil diubah. Silakan login kembali.' });
        });
      });
    });
  });
});

/* POST /api/customer/auth/request-otp - Request OTP via Email */
router.post('/request-otp', otpLimiter, function(req, res) {
  var { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
  }

  email = email.trim().toLowerCase();

  // Search customer by email in database
  var db = require('../config/db');
  var sql = 'SELECT * FROM pelanggan WHERE email = ? LIMIT 1';

  db.query(sql, [email], function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email tidak terdaftar. Silakan hubungi admin ESP Lintas Data.' 
      });
    }

    var customer = results[0];
    if ((customer.pppoe_username || '').startsWith('REG-')) {
      return res.status(403).json({ success: false, message: 'Registrasi Anda masih menunggu persetujuan admin.' });
    }

    bcrypt.compare(password, customer.password || '', function(passwordErr, isMatch) {
      if (passwordErr || !isMatch) {
        return res.status(401).json({ success: false, message: 'Email atau password salah.' });
      }

    // Generate random 6 digit OTP
    var otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database (using email as identifier)
    Otp.createOtp(customer.email, otpCode, async function(otpErr) {
      if (otpErr) {
        console.error('[CustomerAuth] Error saat createOtp (request-otp):', otpErr);
        return res.status(500).json({ success: false, message: 'Gagal membuat kode verifikasi.' });
      }

      // Send OTP via Email
      var sendRes = await EmailService.sendOtpEmail(customer.email, {
        nama: customer.nama,
        otp: otpCode
      });

      if (sendRes.success) {
        res.json({ 
          success: true, 
          message: 'Kode OTP telah dikirim ke Email Anda!', 
          email: customer.email 
        });
      } else {
        console.error('[CustomerAuth] Gagal mengirim Email OTP (request-otp):', sendRes);
        // Fallback info in response if email fails
        res.status(500).json({ 
          success: false, 
          message: 'Gagal mengirim Email OTP. Silakan coba lagi nanti.' 
        });
      }
    });
    });
  });
});

/* POST /api/customer/auth/verify-otp - Verify OTP and login */
router.post('/verify-otp', function(req, res) {
  var { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi.' });
  }

  email = email.trim().toLowerCase();

  // Find customer by email
  var db = require('../config/db');
  var sql = 'SELECT * FROM pelanggan WHERE email = ? LIMIT 1';

  db.query(sql, [email], function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    var customer = results[0];
    if ((customer.pppoe_username || '').startsWith('REG-')) {
      return res.status(403).json({ success: false, message: 'Registrasi Anda masih menunggu persetujuan admin.' });
    }

    // Verify OTP using email
    Otp.verifyOtp(customer.email, otp, function(verifyErr, otpRecord) {
      if (verifyErr) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Kode OTP tidak valid atau sudah kedaluwarsa.' });
      }

      // Generate JWT Customer Token
      var token = jwt.sign(
        { 
          id_pelanggan: customer.id_pelanggan, 
          email: customer.email,
          role: 'customer' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // Customer stays logged in longer (30 days)
      );

      res.json({
        success: true,
        message: 'Login berhasil!',
        data: {
          token: token,
          customer: {
            id_pelanggan: customer.id_pelanggan,
            nama: customer.nama,
            email: customer.email,
            no_hp: customer.no_hp,
            paket: customer.paket
          }
        }
      });
    });
  });
});

module.exports = router;

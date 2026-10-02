var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var Admin = require('../models/Admin');
var Otp = require('../models/Otp');
var EmailService = require('../services/emailService');
var verifyToken = require('../middleware/auth');

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function sendPasswordResetOtp(email, callback) {
  Admin.findByEmail(email, async function(err, admin) {
    if (err) return callback(err);
    if (!admin) return callback(null, false);

    var otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    Otp.createOtp(email, otpCode, async function(otpErr) {
      if (otpErr) return callback(otpErr);
      var sendResult = await EmailService.sendOtpEmail(email, {
        nama: admin.nama,
        otp: otpCode,
        purpose: 'reset password'
      });
      callback(null, sendResult.success);
    });
  });
}

/* POST /api/auth/forgot-password/request-otp */
router.post('/forgot-password/request-otp', function(req, res) {
  var email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email wajib diisi.' });
  }

  sendPasswordResetOtp(email, function(err, sent) {
    if (err) return res.status(500).json({ success: false, message: 'Gagal mengirim OTP.', error: err.message });
    if (!sent) return res.status(404).json({ success: false, message: 'Email admin tidak terdaftar.' });
    res.json({ success: true, message: 'OTP reset password telah dikirim ke email.' });
  });
});

/* POST /api/auth/forgot-password/reset */
router.post('/forgot-password/verify-otp', function(req, res) {
  var email = normalizeEmail(req.body.email);
  var otp = req.body.otp;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi.' });

  Admin.findByEmail(email, function(findErr, admin) {
    if (findErr) return res.status(500).json({ success: false, message: 'Database error.' });
    if (!admin) return res.status(404).json({ success: false, message: 'Email admin tidak terdaftar.' });
    Otp.checkOtp(email, otp, function(otpErr, otpRecord) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Database error.' });
      if (!otpRecord) return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa.' });
      res.json({ success: true, message: 'OTP berhasil diverifikasi.' });
    });
  });
});

/* POST /api/auth/forgot-password/reset */
router.post('/forgot-password/reset', function(req, res) {
  var email = normalizeEmail(req.body.email);
  var otp = req.body.otp;
  var newPassword = req.body.newPassword;
  var confirmPassword = req.body.confirmPassword;

  if (!email || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, password baru, dan konfirmasi password wajib diisi.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok.' });
  }

  Admin.findByEmail(email, function(findErr, admin) {
    if (findErr) return res.status(500).json({ success: false, message: 'Database error.' });
    if (!admin) return res.status(404).json({ success: false, message: 'Email admin tidak terdaftar.' });

    Otp.verifyOtp(email, otp, function(otpErr, otpRecord) {
      if (otpErr) return res.status(500).json({ success: false, message: 'Database error.' });
      if (!otpRecord) return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa.' });

      bcrypt.hash(newPassword, 10, function(hashErr, hash) {
        if (hashErr) return res.status(500).json({ success: false, message: 'Gagal mengenkripsi password.' });
        Admin.updatePasswordByEmail(email, hash, function(updateErr) {
          if (updateErr) return res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
          res.json({ success: true, message: 'Password berhasil diubah. Silakan login kembali.' });
        });
      });
    });
  });
});

/* POST /api/auth/seed - Buat admin pertama kali */
router.post('/seed', function(req, res) {
  Admin.count(function(err, total) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (total > 0) {
      return res.status(400).json({ success: false, message: 'Admin sudah ada. Seed hanya untuk pertama kali.' });
    }

    var email = req.body.email || null;
    var password = req.body.password || 'admin123';
    var nama = req.body.nama || 'Administrator';

    bcrypt.hash(password, 10, function(hashErr, hashedPassword) {
      if (hashErr) {
        return res.status(500).json({ success: false, message: 'Gagal hash password' });
      }

      Admin.create({
        password: hashedPassword,
        nama: nama,
        email: email
      }, function(createErr, admin) {
        if (createErr) {
          return res.status(500).json({ success: false, message: 'Gagal membuat admin', error: createErr.message });
        }

        res.status(201).json({
          success: true,
          message: 'Admin berhasil dibuat! Silakan login.',
          data: { email: email, nama: nama }
        });
      });
    });
  });
});

/* POST /api/auth/login - Admin login */
router.post('/login', function(req, res) {
  var { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password harus diisi.' });
  }

  Admin.findByEmail(email.trim().toLowerCase(), function(err, admin) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    if (admin.status === 'nonaktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan. Silakan hubungi Super Admin.' });
    }

    bcrypt.compare(password, admin.password, function(compareErr, isMatch) {
      if (compareErr) {
        return res.status(500).json({ success: false, message: 'Error saat verifikasi password.' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Email atau password salah.' });
      }

      var userRole = admin.role || 'admin';
      var token = jwt.sign(
        { id: admin.id_admin, email: admin.email, role: userRole },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login berhasil!',
        data: {
          token: token,
          admin: {
            id: admin.id_admin,
            email: admin.email,
            nama: admin.nama,
            role: userRole,
            status: admin.status || 'aktif'
          }
        }
      });
    });
  });
});

/* GET /api/auth/me - Get current admin info */
router.get('/me', verifyToken, function(req, res) {
  Admin.findById(req.adminId, function(err, admin) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' });
    }

    res.json({
      success: true,
      data: admin
    });
  });
});

/* PUT /api/auth/profile - Update admin profile (nama) */
router.put('/profile', verifyToken, function(req, res) {
  var { nama } = req.body;

  if (!nama || !nama.trim()) {
    return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
  }

  Admin.updateProfile(req.adminId, { nama: nama.trim() }, function(err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal memperbarui profil.', error: err.message });
    }

    // Return updated admin data
    Admin.findById(req.adminId, function(findErr, admin) {
      if (findErr || !admin) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil data admin.' });
      }

      res.json({
        success: true,
        message: 'Profil berhasil diperbarui!',
        data: admin
      });
    });
  });
});

/* PUT /api/auth/password - Change admin password */
router.put('/password', verifyToken, function(req, res) {
  var { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Password lama dan baru harus diisi.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
  }

  Admin.findByIdWithPassword(req.adminId, function(err, admin) {
    if (err || !admin) {
      return res.status(500).json({ success: false, message: 'Admin tidak ditemukan.' });
    }

    bcrypt.compare(currentPassword, admin.password, function(compareErr, isMatch) {
      if (compareErr) {
        return res.status(500).json({ success: false, message: 'Error saat verifikasi password.' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Password lama tidak sesuai.' });
      }

      bcrypt.hash(newPassword, 10, function(hashErr, hashedPassword) {
        if (hashErr) {
          return res.status(500).json({ success: false, message: 'Gagal hash password baru.' });
        }

        Admin.updatePassword(req.adminId, hashedPassword, function(updateErr) {
          if (updateErr) {
            return res.status(500).json({ success: false, message: 'Gagal memperbarui password.', error: updateErr.message });
          }

          res.json({
            success: true,
            message: 'Password berhasil diubah!'
          });
        });
      });
    });
  });
});

module.exports = router;

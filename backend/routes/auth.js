var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var Admin = require('../models/Admin');
var verifyToken = require('../middleware/auth');

/* POST /api/auth/seed - Buat admin pertama kali */
router.post('/seed', function(req, res) {
  Admin.count(function(err, total) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (total > 0) {
      return res.status(400).json({ success: false, message: 'Admin sudah ada. Seed hanya untuk pertama kali.' });
    }

    var username = req.body.username || 'admin';
    var password = req.body.password || 'admin123';
    var nama = req.body.nama || 'Administrator';

    bcrypt.hash(password, 10, function(hashErr, hashedPassword) {
      if (hashErr) {
        return res.status(500).json({ success: false, message: 'Gagal hash password' });
      }

      Admin.create({
        username: username,
        password_hash: hashedPassword,
        nama: nama
      }, function(createErr, admin) {
        if (createErr) {
          return res.status(500).json({ success: false, message: 'Gagal membuat admin', error: createErr.message });
        }

        res.status(201).json({
          success: true,
          message: 'Admin berhasil dibuat! Silakan login.',
          data: { username: username, nama: nama }
        });
      });
    });
  });
});

/* POST /api/auth/login - Admin login */
router.post('/login', function(req, res) {
  var { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password harus diisi.' });
  }

  Admin.findByUsername(username, function(err, admin) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    bcrypt.compare(password, admin.password_hash, function(compareErr, isMatch) {
      if (compareErr) {
        return res.status(500).json({ success: false, message: 'Error saat verifikasi password.' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Username atau password salah.' });
      }

      var token = jwt.sign(
        { id: admin.id_admin, username: admin.username },
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
            username: admin.username,
            nama: admin.nama
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

module.exports = router;

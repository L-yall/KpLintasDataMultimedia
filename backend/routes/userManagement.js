var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var Admin = require('../models/Admin');
var verifyToken = require('../middleware/auth');
var requireSuperAdmin = verifyToken.requireSuperAdmin;

// Kunci seluruh endpoint di router ini hanya untuk Super Admin
router.use(verifyToken);
router.use(requireSuperAdmin);

/* GET /api/users - List semua akun admin */
router.get('/', function (req, res) {
  Admin.getAll(function (err, users) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: users });
  });
});

/* POST /api/users - Buat akun admin baru */
router.post('/', function (req, res) {
  var { email, password, nama, role } = req.body;

  if (!email || !password || !nama) {
    return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
  }

  var finalRole = role === 'superadmin' ? 'superadmin' : 'admin';
  var cleanEmail = email.trim().toLowerCase();

  Admin.findByEmail(cleanEmail, function (emailErr, existingEmail) {
      if (emailErr) {
        return res.status(500).json({ success: false, message: 'Database error', error: emailErr.message });
      }

      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan. Silakan gunakan email lain.' });
      }

    bcrypt.hash(password, 10, function (hashErr, hashedPassword) {
      if (hashErr) {
        return res.status(500).json({ success: false, message: 'Gagal mengenkripsi password.' });
      }

      Admin.create({
        password: hashedPassword,
        nama: nama.trim(),
        role: finalRole,
        status: 'aktif',
        email: cleanEmail
      }, function (createErr, result) {
        if (createErr) {
          return res.status(500).json({ success: false, message: 'Gagal membuat admin baru', error: createErr.message });
        }

        res.status(201).json({
          success: true,
          message: 'Akun ' + (finalRole === 'superadmin' ? 'Super Admin' : 'Admin') + ' berhasil dibuat!',
          data: {
            id_admin: result.id_admin,
            email: cleanEmail,
            nama: nama.trim(),
            role: finalRole,
            status: 'aktif'
          }
        });
      });
    });
  });
});

/* PUT /api/users/:id - Ubah nama, role, atau status akun */
router.put('/:id', function (req, res) {
  var targetId = parseInt(req.params.id, 10);
  var { nama, role, status } = req.body;

  Admin.findById(targetId, function (findErr, targetUser) {
    if (findErr || !targetUser) {
      return res.status(404).json({ success: false, message: 'Akun admin tidak ditemukan.' });
    }

    // Proteksi Self-Lockout: jika Super Admin mengubah rolenya sendiri atau menonaktifkan akunnya sendiri
    var isDemotingSelf = (req.adminId === targetId) && (role === 'admin' || status === 'nonaktif');

    Admin.countSuperAdmin(function (cntErr, superAdminCount) {
      if (isDemotingSelf && superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Tindakan dicegah! Anda adalah satu-satunya Super Admin aktif. Buat Super Admin lain terlebih dahulu sebelum mengubah status akun ini.'
        });
      }

      var updateData = {};
      if (nama) updateData.nama = nama.trim();
      if (role && (role === 'superadmin' || role === 'admin')) updateData.role = role;
      if (status && (status === 'aktif' || status === 'nonaktif')) updateData.status = status;

      Admin.updateProfile(targetId, updateData, function (updateErr) {
        if (updateErr) {
          return res.status(500).json({ success: false, message: 'Gagal memperbarui akun', error: updateErr.message });
        }

        res.json({
          success: true,
          message: 'Akun admin berhasil diperbarui!'
        });
      });
    });
  });
});

/* DELETE /api/users/:id - Hapus akun admin */
router.delete('/:id', function (req, res) {
  var targetId = parseInt(req.params.id, 10);

  // Proteksi Self-Lockout: Super Admin tidak boleh menghapus akun dirinya sendiri jika satu-satunya
  if (req.adminId === targetId) {
    return res.status(400).json({
      success: false,
      message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.'
    });
  }

  Admin.findById(targetId, function (findErr, targetUser) {
    if (findErr || !targetUser) {
      return res.status(404).json({ success: false, message: 'Akun admin tidak ditemukan.' });
    }

    Admin.delete(targetId, function (delErr) {
      if (delErr) {
        return res.status(500).json({ success: false, message: 'Gagal menghapus akun', error: delErr.message });
      }

      res.json({
        success: true,
        message: 'Akun ' + targetUser.nama + ' berhasil dihapus.'
      });
    });
  });
});

module.exports = router;

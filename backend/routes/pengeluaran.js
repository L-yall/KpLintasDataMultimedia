var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var Pengeluaran = require('../models/Pengeluaran');
var verifyToken = require('../middleware/auth');

// Pastikan folder uploads/bukti-pengeluaran tersedia
var buktiDir = path.join(__dirname, '../public/uploads/bukti-pengeluaran');
if (!fs.existsSync(buktiDir)) {
  fs.mkdirSync(buktiDir, { recursive: true });
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, buktiDir);
  },
  filename: function (req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'nota-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

var uploadBukti = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (allowedTypes.indexOf(file.mimetype) === -1) {
      return cb(new Error('Format file tidak didukung. Unggah nota dalam format gambar (JPG, PNG, WEBP) atau PDF.'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Protect all routes with JWT authentication
router.use(verifyToken);

/**
 * Validasi batas waktu tanggal transaksi:
 * Maksimal diinput 1 hari setelahnya (H+1) dan tidak boleh di masa depan.
 */
function validateExpenseDate(expenseDateStr) {
  if (!expenseDateStr) return { valid: false, message: 'Tanggal pengeluaran wajib diisi.' };
  var parts = String(expenseDateStr).split('-');
  if (parts.length !== 3) return { valid: false, message: 'Format tanggal pengeluaran tidak valid (YYYY-MM-DD).' };

  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);
  var expenseDate = new Date(year, month, day);

  var today = new Date();
  var currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Selisih hari: currentDate - expenseDate
  var diffTime = currentDate.getTime() - expenseDate.getTime();
  var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { valid: false, message: 'Tanggal pengeluaran/nota tidak boleh melebihi hari ini.' };
  }

  if (diffDays > 1) {
    var yesterday = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    var yesterdayStr = yesterday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return { 
      valid: false, 
      message: 'Maksimal input pengeluaran adalah 1 hari setelah tanggal transaksi/nota (Maksimal nota tertanggal ' + yesterdayStr + ').' 
    };
  }

  return { valid: true };
}

/* GET /api/pengeluaran - List monthly expenses */
router.get('/', function (req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  Pengeluaran.getAll(periode, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pengeluaran/kategori-berkala - Daftar riwayat pengeluaran berkala sebelumnya */
router.get('/kategori-berkala', function (req, res) {
  var db = require('../config/db');
  var sql = "SELECT kategori, nominal, keterangan, tanggal FROM pengeluaran WHERE tipe = 'fix' ORDER BY tanggal DESC, id_pengeluaran DESC";
  db.query(sql, function (err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran berkala', error: err.message });
    }

    var map = new Map();
    (results || []).forEach(function (r) {
      var key = (r.kategori || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, {
          kategori: r.kategori.trim(),
          nominal: parseFloat(r.nominal) || 0,
          keterangan: r.keterangan || '',
          tanggal_terakhir: r.tanggal
        });
      }
    });

    res.json({ success: true, data: Array.from(map.values()) });
  });
});

/* POST /api/pengeluaran - Add new expense */
router.post('/', function (req, res) {
  uploadBukti.single('bukti_nota')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Gagal mengunggah bukti nota.' });
    }

    var { kategori, nominal, tipe, tanggal, keterangan } = req.body;
    var id_admin = req.adminId;
    var isSuper = req.adminRole === 'superadmin';

    if (!kategori || !nominal || !tipe || !tanggal) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(400).json({ success: false, message: 'Kategori, nominal, tipe, dan tanggal wajib diisi.' });
    }

    // Bukti nota wajib diunggah
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti pengeluaran atau nota wajib diunggah.' });
    }

    // Validasi batas waktu input maksimal 1 hari setelahnya untuk admin operasional
    if (!isSuper) {
      var dateCheck = validateExpenseDate(tanggal);
      if (!dateCheck.valid) {
        if (req.file && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(400).json({ success: false, message: dateCheck.message });
      }
    }

    var relativePath = '/uploads/bukti-pengeluaran/' + req.file.filename;

    // Seluruh pengeluaran baru yang diinput (baik oleh Admin maupun Super Admin)
    // berstatus awal 'menunggu_persetujuan' agar melalui verifikasi & validasi persetujuan
    // sebelum dana pengeluaran memotong saldo pemasukan / kas.
    var status = 'menunggu_persetujuan';
    var validated_by = null;
    var validated_at = null;

    Pengeluaran.create({
      id_admin: id_admin,
      kategori: kategori.trim(),
      nominal: parseFloat(nominal),
      tipe: tipe,
      tanggal: tanggal,
      keterangan: keterangan ? keterangan.trim() : null,
      bukti_nota: relativePath,
      status: status,
      catatan_validasi: null,
      validated_by: validated_by,
      validated_at: validated_at
    }, function (createErr, result) {
      if (createErr) {
        if (req.file && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(500).json({ success: false, message: 'Gagal menambahkan pengeluaran: ' + createErr.message });
      }

      var msg = isSuper
        ? 'Pengeluaran berhasil dicatat. Status saat ini menunggu persetujuan (silakan klik tombol "Setujui" pada tabel untuk memvalidasi).'
        : 'Pengeluaran berhasil dicatat. Menunggu validasi dari Super Admin (Finance) sebelum memotong saldo kas.';

      // Broadcast notifikasi pengeluaran baru ke Super Admin
      try {
        var SocketService = require('../services/socket');
        SocketService.broadcast('pengeluaran_masuk', {
          id_pengeluaran: result.insertId,
          kategori: kategori.trim(),
          nominal: parseFloat(nominal),
          id_admin: id_admin
        });
      } catch (socketErr) {
        console.error('[Pengeluaran Socket] Gagal broadcast pengeluaran_masuk:', socketErr.message);
      }

      res.json({
        success: true,
        message: msg,
        data: {
          id_pengeluaran: result.insertId,
          status: status,
          bukti_nota: relativePath
        }
      });
    });
  });
});

/* PUT /api/pengeluaran/:id - Fitur edit dinonaktifkan demi integritas pembukuan dan audit */
router.put('/:id', function (req, res) {
  return res.status(403).json({
    success: false,
    message: 'Fitur edit data pengeluaran telah dinonaktifkan demi menjaga integritas pembukuan dan audit keuangan.'
  });
});

/* PUT /api/pengeluaran/:id/validasi - Validasi pengeluaran (Super Admin / Finance only) */
router.put('/:id/validasi', function (req, res) {
  if (req.adminRole !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak! Validasi pengeluaran hanya berhak dilakukan oleh Super Admin (Finance).'
    });
  }

  var id = req.params.id;
  var { status, catatan_validasi } = req.body;

  if (!['disetujui', 'ditolak'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: "Status validasi harus 'disetujui' atau 'ditolak'." 
    });
  }

  Pengeluaran.getById(id, function (err, expense) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (!expense) return res.status(404).json({ success: false, message: 'Data pengeluaran tidak ditemukan.' });

    Pengeluaran.validateStatus(id, {
      status: status,
      catatan_validasi: catatan_validasi ? catatan_validasi.trim() : null,
      validated_by: req.adminId
    }, function (valErr) {
      if (valErr) return res.status(500).json({ success: false, message: 'Gagal memproses validasi pengeluaran.' });

      // Broadcast pembaruan status pengeluaran agar notifikasi Super Admin ter-update real-time
      try {
        var SocketService = require('../services/socket');
        SocketService.broadcast('pengeluaran_updated', {
          id_pengeluaran: id,
          status: status
        });
      } catch (socketErr) {
        console.error('[Pengeluaran Socket] Gagal broadcast pengeluaran_updated:', socketErr.message);
      }

      res.json({
        success: true,
        message: status === 'disetujui'
          ? 'Pengeluaran berhasil disetujui! Dana pengeluaran kini memotong saldo kas pemasukan.'
          : 'Pengeluaran telah ditolak. Dana pengeluaran tidak memotong saldo pemasukan.',
        data: {
          id_pengeluaran: id,
          status: status
        }
      });
    });
  });
});

/* DELETE /api/pengeluaran/:id - Aksi hapus dinonaktifkan demi integritas pembukuan dan audit */
router.delete('/:id', function (req, res) {
  return res.status(403).json({
    success: false,
    message: 'Aksi hapus pengeluaran telah dinonaktifkan demi menjaga integritas data dan audit keuangan. Gunakan fitur Tolak jika transaksi tidak valid.'
  });
});

module.exports = router;

var express = require('express');
var router = express.Router();
var Pengeluaran = require('../models/Pengeluaran');
var verifyToken = require('../middleware/auth');

// Protect all routes with admin token
router.use(verifyToken);

/* GET /api/pengeluaran - List monthly expenses */
router.get('/', function(req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  Pengeluaran.getAll(periode, function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* POST /api/pengeluaran - Add new expense */
router.post('/', function(req, res) {
  var { kategori, nominal, tipe, tanggal, keterangan } = req.body;
  var id_admin = req.adminId;

  if (!kategori || !nominal || !tipe || !tanggal) {
    return res.status(400).json({ success: false, message: 'Kategori, nominal, tipe, dan tanggal wajib diisi.' });
  }

  Pengeluaran.create({
    id_admin: id_admin,
    kategori: kategori,
    nominal: nominal,
    tipe: tipe,
    tanggal: tanggal,
    keterangan: keterangan
  }, function(err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal menambahkan pengeluaran.' });
    }
    res.json({
      success: true,
      message: 'Pengeluaran berhasil dicatat!',
      data: { id_pengeluaran: result.insertId }
    });
  });
});

/* PUT /api/pengeluaran/:id - Update expense details */
router.put('/:id', function(req, res) {
  var id = req.params.id;
  var { kategori, nominal, tipe, tanggal, keterangan } = req.body;

  if (!kategori || !nominal || !tipe || !tanggal) {
    return res.status(400).json({ success: false, message: 'Kategori, nominal, tipe, dan tanggal wajib diisi.' });
  }

  Pengeluaran.getById(id, function(err, expense) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (!expense) return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan.' });

    Pengeluaran.update(id, {
      kategori: kategori,
      nominal: nominal,
      tipe: tipe,
      tanggal: tanggal,
      keterangan: keterangan
    }, function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Gagal memperbarui pengeluaran.' });
      res.json({ success: true, message: 'Pengeluaran berhasil diperbarui!' });
    });
  });
});

/* DELETE /api/pengeluaran/:id - Remove expense */
router.delete('/:id', function(req, res) {
  var id = req.params.id;

  Pengeluaran.getById(id, function(err, expense) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (!expense) return res.status(404).json({ success: false, message: 'Pengeluaran tidak ditemukan.' });

    Pengeluaran.delete(id, function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Gagal menghapus pengeluaran.' });
      res.json({ success: true, message: 'Pengeluaran berhasil dihapus.' });
    });
  });
});

module.exports = router;

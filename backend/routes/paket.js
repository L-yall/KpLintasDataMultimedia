var express = require('express');
var router = express.Router();
var PaketLayanan = require('../models/PaketLayanan');
var verifyToken = require('../middleware/auth');

/* GET /api/paket - List semua paket (public, untuk dropdown form) */
router.get('/', function(req, res) {
  PaketLayanan.getActive(function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data paket', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/paket/all - List semua paket termasuk non-aktif (admin only) */
router.get('/all', verifyToken, function(req, res) {
  PaketLayanan.getAll(function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data paket', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/paket/:id - Detail paket */
router.get('/:id', function(req, res) {
  PaketLayanan.getById(req.params.id, function(err, paket) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!paket) {
      return res.status(404).json({ success: false, message: 'Paket tidak ditemukan.' });
    }

    res.json({ success: true, data: paket });
  });
});

/* POST /api/paket - Tambah paket baru (admin only) */
router.post('/', verifyToken, function(req, res) {
  var { nama_paket, harga, kecepatan, deskripsi } = req.body;

  if (!nama_paket || !harga) {
    return res.status(400).json({ success: false, message: 'Nama paket dan harga harus diisi.' });
  }

  PaketLayanan.create({
    nama_paket: nama_paket,
    harga: harga,
    kecepatan: kecepatan,
    deskripsi: deskripsi
  }, function(err, result) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal menambah paket', error: err.message });
    }

    res.status(201).json({
      success: true,
      message: 'Paket layanan berhasil ditambahkan!',
      data: result
    });
  });
});

/* PUT /api/paket/:id - Update paket (admin only) */
router.put('/:id', verifyToken, function(req, res) {
  var id = req.params.id;

  PaketLayanan.getById(id, function(err, paket) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!paket) {
      return res.status(404).json({ success: false, message: 'Paket tidak ditemukan.' });
    }

    PaketLayanan.update(id, req.body, function(updateErr, result) {
      if (updateErr) {
        return res.status(500).json({ success: false, message: 'Gagal mengupdate paket', error: updateErr.message });
      }

      res.json({
        success: true,
        message: 'Paket layanan berhasil diupdate!'
      });
    });
  });
});

/* DELETE /api/paket/:id - Hapus paket (admin only, soft delete) */
router.delete('/:id', verifyToken, function(req, res) {
  var id = req.params.id;

  PaketLayanan.getById(id, function(err, paket) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!paket) {
      return res.status(404).json({ success: false, message: 'Paket tidak ditemukan.' });
    }

    PaketLayanan.delete(id, function(deleteErr, result) {
      if (deleteErr) {
        return res.status(500).json({ success: false, message: 'Gagal menghapus paket', error: deleteErr.message });
      }

      res.json({
        success: true,
        message: 'Paket layanan berhasil dihapus.'
      });
    });
  });
});

module.exports = router;

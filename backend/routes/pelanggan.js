var express = require('express');
var router = express.Router();
var Pelanggan = require('../models/Pelanggan');
var verifyToken = require('../middleware/auth');

// Semua route pelanggan butuh auth
router.use(verifyToken);

/* GET /api/pelanggan - List semua pelanggan */
router.get('/', function(req, res) {
  Pelanggan.getAll(function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pelanggan', error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

/* GET /api/pelanggan/stats - Statistik pelanggan untuk dashboard */
router.get('/stats', function(req, res) {
  Pelanggan.countActive(function(err, totalAktif) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil statistik', error: err.message });
    }

    Pelanggan.countByStatus(function(statusErr, statusData) {
      if (statusErr) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil statistik status', error: statusErr.message });
      }

      var stats = {
        total_aktif: totalAktif,
        hijau: 0,
        kuning: 0,
        merah: 0,
        abu_abu: 0
      };

      statusData.forEach(function(item) {
        stats[item.status_tagihan] = item.total;
      });

      res.json({ success: true, data: stats });
    });
  });
});

/* GET /api/pelanggan/:id - Detail pelanggan */
router.get('/:id', function(req, res) {
  Pelanggan.getById(req.params.id, function(err, pelanggan) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!pelanggan) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    res.json({ success: true, data: pelanggan });
  });
});

/* POST /api/pelanggan - Tambah pelanggan baru */
router.post('/', function(req, res) {
  var { nama, alamat, no_hp, email, pppoe_username, paket, due_date } = req.body;

  if (!nama || !no_hp) {
    return res.status(400).json({ success: false, message: 'Nama dan nomor HP harus diisi.' });
  }

  // Cek duplikat no_hp
  Pelanggan.findByNoHp(no_hp, function(err, existing) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (existing) {
      return res.status(400).json({ success: false, message: 'Nomor HP sudah terdaftar.' });
    }

    Pelanggan.create({
      nama: nama,
      alamat: alamat,
      no_hp: no_hp,
      email: email,
      pppoe_username: pppoe_username,
      paket: paket,
      due_date: due_date
    }, function(createErr, result) {
      if (createErr) {
        return res.status(500).json({ success: false, message: 'Gagal menambah pelanggan', error: createErr.message });
      }

      res.status(201).json({
        success: true,
        message: 'Pelanggan berhasil ditambahkan!',
        data: result
      });
    });
  });
});

/* PUT /api/pelanggan/:id - Update data pelanggan */
router.put('/:id', function(req, res) {
  var id = req.params.id;

  Pelanggan.getById(id, function(err, pelanggan) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!pelanggan) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    Pelanggan.update(id, req.body, function(updateErr, result) {
      if (updateErr) {
        return res.status(500).json({ success: false, message: 'Gagal mengupdate pelanggan', error: updateErr.message });
      }

      res.json({
        success: true,
        message: 'Data pelanggan berhasil diupdate!'
      });
    });
  });
});

/* DELETE /api/pelanggan/:id - Hapus pelanggan */
router.delete('/:id', function(req, res) {
  var id = req.params.id;

  Pelanggan.getById(id, function(err, pelanggan) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (!pelanggan) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    Pelanggan.delete(id, function(deleteErr, result) {
      if (deleteErr) {
        return res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan', error: deleteErr.message });
      }

      res.json({
        success: true,
        message: 'Pelanggan berhasil dihapus.'
      });
    });
  });
});

module.exports = router;

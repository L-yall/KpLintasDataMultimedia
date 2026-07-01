var db = require('../config/db');

var PaketLayanan = {
  // Ambil semua paket layanan
  getAll: function(callback) {
    var sql = 'SELECT * FROM paket_layanan ORDER BY harga ASC';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil hanya paket yang aktif
  getActive: function(callback) {
    var sql = 'SELECT * FROM paket_layanan WHERE aktif = 1 ORDER BY harga ASC';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil paket berdasarkan ID
  getById: function(id, callback) {
    var sql = 'SELECT * FROM paket_layanan WHERE id = ?';
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Tambah paket baru
  create: function(data, callback) {
    var sql = 'INSERT INTO paket_layanan (nama_paket, harga, kecepatan, deskripsi) VALUES (?, ?, ?, ?)';
    var values = [data.nama_paket, data.harga, data.kecepatan || null, data.deskripsi || null];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, { id: result.insertId, ...data });
    });
  },

  // Update paket
  update: function(id, data, callback) {
    var fields = [];
    var values = [];

    if (data.nama_paket !== undefined) { fields.push('nama_paket = ?'); values.push(data.nama_paket); }
    if (data.harga !== undefined) { fields.push('harga = ?'); values.push(data.harga); }
    if (data.kecepatan !== undefined) { fields.push('kecepatan = ?'); values.push(data.kecepatan); }
    if (data.deskripsi !== undefined) { fields.push('deskripsi = ?'); values.push(data.deskripsi); }
    if (data.aktif !== undefined) { fields.push('aktif = ?'); values.push(data.aktif); }

    if (fields.length === 0) {
      return callback(new Error('Tidak ada data yang diubah'), null);
    }

    values.push(id);
    var sql = 'UPDATE paket_layanan SET ' + fields.join(', ') + ' WHERE id = ?';
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Hapus paket (soft delete)
  delete: function(id, callback) {
    var sql = 'UPDATE paket_layanan SET aktif = 0 WHERE id = ?';
    db.query(sql, [id], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }
};

module.exports = PaketLayanan;

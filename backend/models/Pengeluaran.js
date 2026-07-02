var db = require('../config/db');

var Pengeluaran = {
  // Ambil semua pengeluaran berdasarkan filter periode (YYYY-MM)
  getAll: function(periode, callback) {
    var sql = `
      SELECT p.*, a.nama as nama_admin 
      FROM pengeluaran p 
      LEFT JOIN admin a ON p.id_admin = a.id_admin 
      WHERE DATE_FORMAT(p.tanggal, '%Y-%m') = ? 
      ORDER BY p.tanggal DESC, p.created_at DESC
    `;
    db.query(sql, [periode], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil detail pengeluaran berdasarkan ID
  getById: function(id, callback) {
    var sql = 'SELECT * FROM pengeluaran WHERE id_pengeluaran = ?';
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Tambah pengeluaran baru
  create: function(data, callback) {
    var sql = `
      INSERT INTO pengeluaran (id_admin, kategori, nominal, tipe, tanggal, keterangan) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    var values = [
      data.id_admin,
      data.kategori,
      data.nominal,
      data.tipe, // 'fix' atau 'tidak_fix'
      data.tanggal,
      data.keterangan || null
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Update pengeluaran
  update: function(id, data, callback) {
    var sql = `
      UPDATE pengeluaran 
      SET kategori = ?, nominal = ?, tipe = ?, tanggal = ?, keterangan = ? 
      WHERE id_pengeluaran = ?
    `;
    var values = [
      data.kategori,
      data.nominal,
      data.tipe,
      data.tanggal,
      data.keterangan || null,
      id
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Hapus pengeluaran
  delete: function(id, callback) {
    var sql = 'DELETE FROM pengeluaran WHERE id_pengeluaran = ?';
    db.query(sql, [id], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }
};

module.exports = Pengeluaran;

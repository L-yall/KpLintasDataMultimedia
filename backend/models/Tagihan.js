var db = require('../config/db');

var Tagihan = {
  // Ambil semua tagihan
  getAll: function(callback) {
    var sql = `
      SELECT t.*, p.nama, p.no_hp, p.pppoe_username 
      FROM tagihan t 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      ORDER BY t.due_date DESC
    `;
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil tagihan yang belum dibayar / terlambat
  getUnpaid: function(callback) {
    var sql = `
      SELECT t.*, p.nama, p.no_hp, p.pppoe_username, p.status_tagihan 
      FROM tagihan t 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      WHERE t.status IN ('belum_bayar', 'terlambat')
    `;
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Tambah tagihan baru
  create: function(data, callback) {
    var sql = `
      INSERT INTO tagihan (id_pelanggan, periode, nominal, status, due_date) 
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [data.id_pelanggan, data.periode, data.nominal, data.status || 'belum_bayar', data.due_date], function(err, result) {
      if (err) return callback(err, null);
      callback(null, { id_tagihan: result.insertId, ...data });
    });
  },

  // Update status tagihan
  updateStatus: function(id, status, callback) {
    var sql = 'UPDATE tagihan SET status = ? WHERE id_tagihan = ?';
    db.query(sql, [status, id], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Ambil tagihan berdasarkan pelanggan & periode
  getByPelangganPeriode: function(id_pelanggan, periode, callback) {
    var sql = 'SELECT * FROM tagihan WHERE id_pelanggan = ? AND periode = ?';
    db.query(sql, [id_pelanggan, periode], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  }
};

module.exports = Tagihan;

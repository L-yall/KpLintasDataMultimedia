var db = require('../config/db');

var Admin = {
  // Cari admin berdasarkan username
  findByUsername: function(username, callback) {
    var sql = 'SELECT * FROM admin WHERE username = ?';
    db.query(sql, [username], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Buat admin baru
  create: function(data, callback) {
    var sql = 'INSERT INTO admin (username, password_hash, nama) VALUES (?, ?, ?)';
    db.query(sql, [data.username, data.password_hash, data.nama], function(err, result) {
      if (err) return callback(err, null);
      callback(null, { id_admin: result.insertId, ...data });
    });
  },

  // Cek apakah sudah ada admin di database
  count: function(callback) {
    var sql = 'SELECT COUNT(*) as total FROM admin';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0].total);
    });
  },

  // Cari admin berdasarkan ID
  findById: function(id, callback) {
    var sql = 'SELECT id_admin, username, nama, role, created_at FROM admin WHERE id_admin = ?';
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  }
};

module.exports = Admin;

var db = require('../config/db');

var ReminderLog = {
  // Ambil semua log pengiriman reminder
  getAll: function (callback) {
    var sql = `
      SELECT r.*, p.nama, p.no_hp, p.email 
      FROM reminder_log r 
      LEFT JOIN pelanggan p ON r.id_pelanggan = p.id_pelanggan 
      ORDER BY r.tanggal_kirim DESC
    `;
    db.query(sql, function (err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Tambah log baru
  create: function (data, callback) {
    var sql = `
      INSERT INTO reminder_log (id_pelanggan, status_kirim, pesan, tanggal_kirim) 
      VALUES (?, ?, ?, ?)
    `;
    var date = data.tanggal_kirim || new Date();
    db.query(sql, [data.id_pelanggan, data.status_kirim, data.pesan, date], function (err, result) {
      if (err) return callback(err, null);
      callback(null, { id_reminder: result.insertId, ...data });
    });
  },

  // Cek apakah hari ini pelanggan sudah menerima reminder
  hasBeenSentToday: function (id_pelanggan, callback) {
    var sql = `
      SELECT COUNT(*) as total 
      FROM reminder_log 
      WHERE id_pelanggan = ? 
        AND DATE(tanggal_kirim) = CURDATE()
        AND status_kirim = 'terkirim'
    `;
    db.query(sql, [id_pelanggan], function (err, results) {
      if (err) return callback(err, null);
      callback(null, results[0].total > 0);
    });
  },

  // Hapus log tertentu
  delete: function (id_reminder, callback) {
    var sql = 'DELETE FROM reminder_log WHERE id_reminder = ?';
    db.query(sql, [id_reminder], function (err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Hapus semua log
  clearAll: function (callback) {
    var sql = 'DELETE FROM reminder_log';
    db.query(sql, function (err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }
};

module.exports = ReminderLog;

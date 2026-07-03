var db = require('../config/db');

var Pembayaran = {
  // Ambil semua pembayaran yang pending verifikasi
  getAllPending: function(callback) {
    var sql = `
      SELECT pem.*, t.periode, t.nominal, t.due_date, p.id_pelanggan, p.nama, p.no_hp, p.email, p.pppoe_username 
      FROM pembayaran pem 
      JOIN tagihan t ON pem.id_tagihan = t.id_tagihan 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      WHERE pem.status = 'pending' 
      ORDER BY pem.tanggal_upload DESC
    `;
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil detail pembayaran berdasarkan ID
  getById: function(id, callback) {
    var sql = `
      SELECT pem.*, t.id_pelanggan, t.periode, t.nominal, t.due_date, p.nama, p.no_hp, p.email, p.pppoe_username 
      FROM pembayaran pem 
      JOIN tagihan t ON pem.id_tagihan = t.id_tagihan 
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
      WHERE pem.id_pembayaran = ?
    `;
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Update status verifikasi pembayaran
  verify: function(id_pembayaran, data, callback) {
    var sql = `
      UPDATE pembayaran 
      SET status = ?, alasan_tolak = ?, id_admin = ?, verified_at = NOW() 
      WHERE id_pembayaran = ?
    `;
    var values = [
      data.status, // 'diterima' atau 'ditolak'
      data.alasan_tolak || null,
      data.id_admin,
      id_pembayaran
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }
};

module.exports = Pembayaran;

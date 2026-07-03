var db = require('../config/db');

var Pelanggan = {
  // Ambil semua pelanggan
  getAll: function(callback) {
    var sql = `
      SELECT p.*, pl.harga, pl.kecepatan 
      FROM pelanggan p 
      LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket 
      ORDER BY p.created_at DESC
    `;
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil pelanggan berdasarkan ID
  getById: function(id, callback) {
    var sql = `
      SELECT p.*, pl.harga, pl.kecepatan 
      FROM pelanggan p 
      LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket 
      WHERE p.id_pelanggan = ?
    `;
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Tambah pelanggan baru
  create: function(data, callback) {
    var sql = `
      INSERT INTO pelanggan 
      (nama, alamat, no_hp, pppoe_username, paket, due_date, email) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    var values = [
      data.nama,
      data.alamat || '',
      data.no_hp,
      data.pppoe_username || '',
      data.paket || '',
      data.due_date || null,
      data.email || null
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, { id_pelanggan: result.insertId, ...data });
    });
  },

  // Update data pelanggan
  update: function(id, data, callback) {
    var fields = [];
    var values = [];

    if (data.nama !== undefined) { fields.push('nama = ?'); values.push(data.nama); }
    if (data.alamat !== undefined) { fields.push('alamat = ?'); values.push(data.alamat); }
    if (data.no_hp !== undefined) { fields.push('no_hp = ?'); values.push(data.no_hp); }
    if (data.pppoe_username !== undefined) { fields.push('pppoe_username = ?'); values.push(data.pppoe_username); }
    if (data.paket !== undefined) { fields.push('paket = ?'); values.push(data.paket); }
    if (data.status_tagihan !== undefined) { fields.push('status_tagihan = ?'); values.push(data.status_tagihan); }
    if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date); }
    if (data.pppoe_status !== undefined) { fields.push('pppoe_status = ?'); values.push(data.pppoe_status); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }

    if (fields.length === 0) {
      return callback(new Error('Tidak ada data yang diubah'), null);
    }

    values.push(id);
    var sql = 'UPDATE pelanggan SET ' + fields.join(', ') + ' WHERE id_pelanggan = ?';
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Hapus pelanggan
  delete: function(id, callback) {
    var sql = 'DELETE FROM pelanggan WHERE id_pelanggan = ?';
    db.query(sql, [id], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Cari berdasarkan nomor HP
  findByNoHp: function(no_hp, callback) {
    var sql = 'SELECT * FROM pelanggan WHERE no_hp = ?';
    db.query(sql, [no_hp], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Cari berdasarkan Email
  findByEmail: function(email, callback) {
    var sql = 'SELECT * FROM pelanggan WHERE email = ?';
    db.query(sql, [email], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Hitung jumlah pelanggan per status
  countByStatus: function(callback) {
    var sql = 'SELECT status_tagihan, COUNT(*) as total FROM pelanggan GROUP BY status_tagihan';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Hitung total pelanggan
  countActive: function(callback) {
    var sql = 'SELECT COUNT(*) as total FROM pelanggan';
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0].total);
    });
  }
};

module.exports = Pelanggan;

var db = require('../config/db');

var Pengeluaran = {
  // Ambil semua pengeluaran berdasarkan filter periode (YYYY-MM) atau seluruhnya ('all')
  getAll: function(periode, callback) {
    var hasPeriode = Boolean(periode && periode !== 'all');
    var sql = `
      SELECT 
        p.*, 
        a.nama as nama_admin,
        v.nama as nama_validator
      FROM pengeluaran p 
      LEFT JOIN (
        SELECT id_admin, MAX(nama) as nama
        FROM admin
        GROUP BY id_admin
      ) a ON p.id_admin = a.id_admin
      LEFT JOIN (
        SELECT id_admin, MAX(nama) as nama
        FROM admin
        GROUP BY id_admin
      ) v ON p.validated_by = v.id_admin
      ${hasPeriode ? "WHERE DATE_FORMAT(p.tanggal, '%Y-%m') = ?" : ""}
      ORDER BY p.tanggal DESC, p.created_at DESC
    `;
    var params = hasPeriode ? [periode] : [];
    db.query(sql, params, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil detail pengeluaran berdasarkan ID
  getById: function(id, callback) {
    var sql = `
      SELECT 
        p.*, 
        a.nama as nama_admin,
        v.nama as nama_validator
      FROM pengeluaran p
      LEFT JOIN (
        SELECT id_admin, MAX(nama) as nama
        FROM admin
        GROUP BY id_admin
      ) a ON p.id_admin = a.id_admin
      LEFT JOIN (
        SELECT id_admin, MAX(nama) as nama
        FROM admin
        GROUP BY id_admin
      ) v ON p.validated_by = v.id_admin
      WHERE p.id_pengeluaran = ?
    `;
    db.query(sql, [id], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0] || null);
    });
  },

  // Tambah pengeluaran baru
  create: function(data, callback) {
    var sql = `
      INSERT INTO pengeluaran (
        id_admin, kategori, nominal, tipe, tanggal, keterangan, 
        bukti_nota, status, catatan_validasi, validated_by, validated_at
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    var values = [
      data.id_admin,
      data.kategori,
      data.nominal,
      data.tipe, // 'fix' atau 'tidak_fix'
      data.tanggal,
      data.keterangan || null,
      data.bukti_nota || null,
      data.status || 'menunggu_persetujuan',
      data.catatan_validasi || null,
      data.validated_by || null,
      data.validated_at || null
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
      SET 
        kategori = ?, 
        nominal = ?, 
        tipe = ?, 
        tanggal = ?, 
        keterangan = ?, 
        bukti_nota = COALESCE(?, bukti_nota),
        status = ?,
        catatan_validasi = ?,
        validated_by = ?,
        validated_at = ?
      WHERE id_pengeluaran = ?
    `;
    var values = [
      data.kategori,
      data.nominal,
      data.tipe,
      data.tanggal,
      data.keterangan || null,
      data.bukti_nota || null,
      data.status || 'menunggu_persetujuan',
      data.catatan_validasi || null,
      data.validated_by || null,
      data.validated_at || null,
      id
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Validasi pengeluaran oleh Super Admin / Finance (Setujui / Tolak)
  validateStatus: function(id, data, callback) {
    var sql = `
      UPDATE pengeluaran 
      SET 
        status = ?, 
        catatan_validasi = ?, 
        validated_by = ?, 
        validated_at = NOW() 
      WHERE id_pengeluaran = ?
    `;
    var values = [
      data.status, // 'disetujui' atau 'ditolak'
      data.catatan_validasi || null,
      data.validated_by,
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

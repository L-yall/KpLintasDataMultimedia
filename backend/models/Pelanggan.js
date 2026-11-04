var db = require('../config/db');
var Router = require('./Router');

var Pelanggan = {
  // Ambil semua pelanggan
  getAll: function(callback, options) {
    options = options || {};
    var sql = `
      SELECT 
        p.*, 
        pl.harga, 
        pl.kecepatan,
        COALESCE(
          (SELECT due_date FROM tagihan WHERE id_pelanggan = p.id_pelanggan AND status != 'lunas' ORDER BY due_date ASC LIMIT 1),
          (SELECT due_date FROM tagihan WHERE id_pelanggan = p.id_pelanggan ORDER BY due_date DESC LIMIT 1),
          p.due_date
        ) AS due_date
      FROM pelanggan p 
      LEFT JOIN paket_layanan pl ON p.paket = pl.nama_paket 
      WHERE p.pppoe_username IS NOT NULL AND p.pppoe_username != '' AND p.pppoe_username NOT LIKE 'REG-%'
      ${options.id_router !== undefined ? 'AND p.id_router = ?' : ''}
      ORDER BY p.created_at DESC
    `;
    db.query(sql, options.id_router !== undefined ? [options.id_router] : [], function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Ambil pelanggan berdasarkan ID
  getById: function(id, callback) {
    var sql = `
      SELECT 
        p.*, 
        pl.harga, 
        pl.kecepatan,
        COALESCE(
          (SELECT due_date FROM tagihan WHERE id_pelanggan = p.id_pelanggan AND status != 'lunas' ORDER BY due_date ASC LIMIT 1),
          (SELECT due_date FROM tagihan WHERE id_pelanggan = p.id_pelanggan ORDER BY due_date DESC LIMIT 1),
          p.due_date
        ) AS due_date
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
      (nama, alamat, no_hp, pppoe_username, paket, due_date, email, password, nik, foto, id_router)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    var values = [
      data.nama,
      data.alamat || '',
      data.no_hp,
      data.pppoe_username ? data.pppoe_username.trim() : null,
      data.paket || null,
      data.due_date || null,
      data.email || null,
      data.password,
      data.nik || null,
      data.foto || null,
      data.id_router == null ? null : data.id_router
    ];
    db.query(sql, values, function(err, result) {
      if (err) return callback(err, null);
      callback(null, { id_pelanggan: result.insertId, ...data });
    });
  },

  // Update data pelanggan
  update: function(id, data, callback, options) {
    options = options || {};
    var fields = [];
    var values = [];

    if (data.id_router !== undefined) { fields.push('id_router = ?'); values.push(data.id_router); }
    if (data.nama !== undefined) { fields.push('nama = ?'); values.push(data.nama); }
    if (data.alamat !== undefined) { fields.push('alamat = ?'); values.push(data.alamat); }
    if (data.no_hp !== undefined) { fields.push('no_hp = ?'); values.push(data.no_hp); }
    if (data.pppoe_username !== undefined) {
      fields.push('pppoe_username = ?');
      values.push(data.pppoe_username ? data.pppoe_username.trim() : null);
    }
    if (data.paket !== undefined) { fields.push('paket = ?'); values.push(data.paket || null); }
    if (data.status_tagihan !== undefined) { fields.push('status_tagihan = ?'); values.push(data.status_tagihan); }
    if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date || null); }
    if (data.pppoe_status !== undefined) { fields.push('pppoe_status = ?'); values.push(data.pppoe_status); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.nik !== undefined) { fields.push('nik = ?'); values.push(data.nik); }
    if (data.foto !== undefined) { fields.push('foto = ?'); values.push(data.foto); }

    if (fields.length === 0) {
      return callback(new Error('Tidak ada data yang diubah'), null);
    }

    values.push(id);
    var sql = 'UPDATE pelanggan SET ' + fields.join(', ') + ' WHERE id_pelanggan = ?';
    if (options.id_router !== undefined) {
      sql += ' AND id_router = ?';
      values.push(options.id_router);
    }
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

  // Update password pelanggan berdasarkan email
  updatePasswordByEmail: function(email, passwordHash, callback) {
    var sql = 'UPDATE pelanggan SET password = ? WHERE email = ?';
    db.query(sql, [passwordHash, email], function(err, result) {
      if (err) return callback(err, null);
      callback(null, result);
    });
  },

  // Cari berdasarkan PPPoE Username
  findByPppoe: function(username, idRouter, callback) {
    if (typeof idRouter === 'function') { callback = idRouter; idRouter = undefined; }
    Promise.resolve(idRouter == null ? Router.getDefaultId() : idRouter).then(function(selectedId) {
      db.query('SELECT * FROM pelanggan WHERE pppoe_username = ? AND id_router = ?', [username, selectedId], function(err, results) {
        if (err) return callback(err, null);
        callback(null, results[0] || null);
      });
    }).catch(callback);
  },

  // Hitung jumlah pelanggan per status
  countByStatus: function(callback) {
    var sql = "SELECT status_tagihan, COUNT(*) as total FROM pelanggan WHERE pppoe_username IS NOT NULL AND pppoe_username != '' AND pppoe_username NOT LIKE 'REG-%' GROUP BY status_tagihan";
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  // Hitung total pelanggan
  countActive: function(callback) {
    var sql = "SELECT COUNT(*) as total FROM pelanggan WHERE pppoe_username IS NOT NULL AND pppoe_username != '' AND pppoe_username NOT LIKE 'REG-%'";
    db.query(sql, function(err, results) {
      if (err) return callback(err, null);
      callback(null, results[0].total);
    });
  }
};

// The registry owns schema initialization; it imports db, never this model.
Object.keys(Pelanggan).forEach(function(name) {
  var method = Pelanggan[name];
  Pelanggan[name] = function() {
    var args = Array.from(arguments);
    var callbackIndex = args.findIndex(function(arg) { return typeof arg === 'function'; });
    var callback = args[callbackIndex];
    Router.initialize().then(async function() {
      if (name === 'getAll' || name === 'getById') {
        var routers = await Router.list();
        var names = new Map(routers.map(function(router) { return [String(router.id_router), router.nama_router]; }));
        args[callbackIndex] = function(err, result) {
          if (err) return callback(err, null);
          function withRouter(customer) {
            return customer ? { ...customer, nama_router: names.get(String(customer.id_router)) || null } : null;
          }
          callback(null, Array.isArray(result) ? result.map(withRouter) : withRouter(result));
        };
      }
      method.apply(Pelanggan, args);
    }).catch(function(err) { callback(err, null); });
  };
});

module.exports = Pelanggan;

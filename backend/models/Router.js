const net = require('node:net');
const credentials = require('../utils/routerCredentials');

const migrationKey = 'core_multi_router_v1';
const migrationLock = 'kp_core_multi_router_v1';
const fields = ['nama_router', 'lokasi', 'host', 'port', 'username', 'password', 'is_active'];
const selectRouter = `SELECT r.id_router, r.nama_router, r.lokasi, r.host, r.port,
  r.username, r.is_active, r.password_encrypted,
  (SELECT COUNT(*) FROM pelanggan p WHERE p.id_router = r.id_router) AS jumlah_pelanggan
  FROM router_mikrotik r`;

function failure(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function routerId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295) {
    throw failure(400, 'ID router tidak valid.');
  }
  return Number(value);
}

function text(value, name, max, required) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw failure(400, name + ' tidak valid (maksimal ' + max + ' karakter).');
  }
  const clean = value.trim();
  if (required && !clean) throw failure(400, name + ' wajib diisi.');
  return clean;
}

function validHost(host) {
  if (net.isIP(host)) return true;
  if (!host || host.length > 253 || /^[\d.]+$/.test(host)) return false;
  const name = host.endsWith('.') ? host.slice(0, -1) : host;
  return name.split('.').every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}

function portNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d{1,5}$/.test(String(value))) {
    throw failure(400, 'Port harus berupa bilangan bulat antara 1 dan 65535.');
  }
  const port = Number(value);
  if (port < 1 || port > 65535) throw failure(400, 'Port harus antara 1 dan 65535.');
  return port;
}

function validate(data, creating = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw failure(400, 'Data router tidak valid.');
  if (Object.keys(data).some(key => !fields.includes(key))) throw failure(400, 'Field router tidak dikenal.');
  const result = {};
  for (const [name, max] of [['nama_router', 100], ['lokasi', 255], ['host', 253], ['username', 100]]) {
    if (creating || Object.hasOwn(data, name)) {
      result[name] = text(name === 'lokasi' && data[name] === undefined ? '' : data[name], name, max, name !== 'lokasi');
    }
  }
  if (result.host !== undefined && !validHost(result.host)) throw failure(400, 'Host harus hostname atau alamat IP, bukan URL/path.');
  if (creating || Object.hasOwn(data, 'port')) result.port = portNumber(data.port === undefined ? 8728 : data.port);
  if (creating || Object.hasOwn(data, 'is_active')) {
    const active = data.is_active === undefined ? true : data.is_active;
    if (typeof active !== 'boolean') throw failure(400, 'is_active harus boolean.');
    result.is_active = active ? 1 : 0;
  }
  if (creating || Object.hasOwn(data, 'password')) {
    if (typeof data.password !== 'string' || data.password.length > 1024 || data.password.includes('\0')) {
      throw failure(400, 'Password tidak valid (maksimal 1024 karakter).');
    }
    if (data.password.trim()) result.password = data.password;
    else if (creating) throw failure(400, 'Password wajib diisi.');
  }
  return result;
}

function publicRouter(row) {
  const hasPassword = Boolean(row.password_encrypted);
  return {
    id_router: Number(row.id_router),
    nama_router: row.nama_router,
    lokasi: row.lokasi,
    host: row.host,
    port: Number(row.port),
    username: row.username,
    is_active: Boolean(Number(row.is_active)),
    has_password: hasPassword,
    jumlah_pelanggan: Number(row.jumlah_pelanggan || 0),
    configured: Boolean(row.host && validHost(row.host) && row.username && hasPassword && Number(row.port) >= 1 && Number(row.port) <= 65535)
  };
}

function identifier(name) {
  return '`' + name.replace(/`/g, '``') + '`';
}

class RouterModel {
  constructor(database) {
    this.database = database;
    this.ready = null;
  }

  pool() {
    return this.database().promise();
  }

  async initialize() {
    if (!this.ready) {
      this.ready = this.migrate().catch(error => {
        this.ready = null;
        if (error.statusCode) throw error;
        // MySQL errors can contain SQL and encrypted values; never expose them.
        throw failure(503, 'Migrasi router gagal. Periksa struktur/akses database lalu coba kembali.');
      });
    }
    return this.ready;
  }

  async migrate() {
    const connection = await this.pool().getConnection();
    let locked = false;
    let transaction = false;
    let reusable = false;
    try {
      const [locks] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [migrationLock]);
      reusable = true;
      if (!locks[0] || Number(locks[0].acquired) !== 1) throw failure(503, 'Migrasi router sedang terkunci. Coba kembali.');
      locked = true;
      await connection.query(`CREATE TABLE IF NOT EXISTS router_mikrotik (
        id_router INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nama_router VARCHAR(100) NOT NULL,
        lokasi VARCHAR(255) NOT NULL DEFAULT '',
        host VARCHAR(253) NOT NULL DEFAULT '',
        port SMALLINT UNSIGNED NOT NULL DEFAULT 8728,
        username VARCHAR(100) NOT NULL DEFAULT '',
        password_encrypted TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      // This marker deliberately has no FK: deleting the seed must not erase history.
      await connection.query(`CREATE TABLE IF NOT EXISTS router_migrations (
        migration_key VARCHAR(100) NOT NULL PRIMARY KEY,
        id_router_seed INT UNSIGNED NULL,
        jumlah_pelanggan_migrasi INT UNSIGNED NOT NULL DEFAULT 0,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await this.migrateCustomerSchema(connection);

      const [encrypted] = await connection.query("SELECT password_encrypted FROM router_mikrotik WHERE password_encrypted IS NOT NULL AND password_encrypted <> '' LIMIT 1");
      if (encrypted.length) await credentials.decrypt(encrypted[0].password_encrypted);

      // DDL auto-commits in MySQL. Only the seed, mapping and marker belong here.
      await connection.beginTransaction();
      transaction = true;
      const [markers] = await connection.query('SELECT id_router_seed, jumlah_pelanggan_migrasi FROM router_migrations WHERE migration_key = ? FOR UPDATE', [migrationKey]);
      let summary = markers[0];
      if (!summary) {
        const [existing] = await connection.query('SELECT id_router FROM router_mikrotik WHERE nama_router = ? ORDER BY id_router LIMIT 1 FOR UPDATE', ['Router Utama']);
        let id;
        if (existing.length) {
          id = existing[0].id_router;
        } else {
          const seed = await this.legacyConfig(connection);
          const encryptedPassword = seed.password ? await credentials.encrypt(seed.password) : null;
          const [insert] = await connection.query(`INSERT INTO router_mikrotik
            (nama_router, lokasi, host, port, username, password_encrypted, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, ['Router Utama', '', seed.host, seed.port, seed.username, encryptedPassword, 1]);
          id = insert.insertId;
        }
        const [mapping] = await connection.query(`UPDATE pelanggan SET id_router = ?
          WHERE id_router IS NULL AND pppoe_username IS NOT NULL
          AND TRIM(pppoe_username) <> '' AND TRIM(pppoe_username) NOT LIKE 'REG-%'`, [id]);
        summary = { id_router_seed: Number(id), jumlah_pelanggan_migrasi: mapping.affectedRows };
        await connection.query('INSERT INTO router_migrations (migration_key, id_router_seed, jumlah_pelanggan_migrasi) VALUES (?, ?, ?)',
          [migrationKey, id, mapping.affectedRows]);
      }
      await connection.commit();
      transaction = false;
      return { ...summary };
    } catch (error) {
      if (transaction) {
        try { await connection.rollback(); } catch (_) { reusable = false; }
      }
      throw error;
    } finally {
      if (locked) {
        try {
          const [released] = await connection.query('SELECT RELEASE_LOCK(?) AS released', [migrationLock]);
          if (!released[0] || Number(released[0].released) !== 1) reusable = false;
        } catch (_) {
          reusable = false;
        }
      }
      // A pooled session must never retain an advisory lock after a failure.
      if (reusable) connection.release();
      else connection.destroy();
    }
  }

  async migrateCustomerSchema(connection) {
    const [columns] = await connection.query("SHOW COLUMNS FROM pelanggan LIKE 'id_router'");
    if (!columns.length) {
      await connection.query('ALTER TABLE pelanggan ADD COLUMN id_router INT UNSIGNED NULL DEFAULT NULL');
    } else if (!/^int(?:\(\d+\))? unsigned$/i.test(columns[0].Type) || columns[0].Null !== 'YES') {
      throw failure(503, 'Kolom pelanggan.id_router harus INT UNSIGNED NULL; migrasi dihentikan.');
    }

    const [indexes] = await connection.query('SHOW INDEX FROM pelanggan');
    const groups = new Map();
    for (const index of indexes) {
      if (!groups.has(index.Key_name)) groups.set(index.Key_name, []);
      groups.get(index.Key_name).push(index);
    }
    let composite = false;
    const changes = [];
    for (const [name, entries] of groups) {
      entries.sort((a, b) => a.Seq_in_index - b.Seq_in_index);
      if (Number(entries[0].Non_unique) !== 0) continue;
      const names = entries.map(entry => entry.Column_name).join(',');
      if (names === 'id_router,pppoe_username' && entries.every(entry => !entry.Sub_part)) composite = true;
      if (names === 'pppoe_username') {
        if (name === 'PRIMARY') throw failure(503, 'Primary key PPPoE tidak didukung; migrasi dihentikan.');
        changes.push('DROP INDEX ' + identifier(name));
      }
    }
    if (!composite) changes.unshift('ADD UNIQUE INDEX uq_pelanggan_router_pppoe (id_router, pppoe_username)');
    if (changes.length) await connection.query('ALTER TABLE pelanggan ' + changes.join(', '));

    const [foreignKeys] = await connection.query(`SELECT k.CONSTRAINT_NAME, k.REFERENCED_TABLE_NAME,
      k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE,
      (k.REFERENCED_TABLE_SCHEMA = k.TABLE_SCHEMA) AS same_schema,
      (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE parts
        WHERE parts.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND parts.TABLE_NAME = k.TABLE_NAME
          AND parts.CONSTRAINT_NAME = k.CONSTRAINT_NAME) AS column_count
      FROM information_schema.KEY_COLUMN_USAGE k
      JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'pelanggan' AND k.COLUMN_NAME = 'id_router'
        AND k.REFERENCED_TABLE_NAME IS NOT NULL`);
    if (foreignKeys.length) {
      if (foreignKeys.some(key => Number(key.same_schema) !== 1 || Number(key.column_count) !== 1 ||
              key.REFERENCED_TABLE_NAME !== 'router_mikrotik' || key.REFERENCED_COLUMN_NAME !== 'id_router' ||
        !['RESTRICT', 'NO ACTION'].includes(key.DELETE_RULE) || !['RESTRICT', 'NO ACTION'].includes(key.UPDATE_RULE))) {
        throw failure(503, 'Foreign key pelanggan.id_router harus membatasi penghapusan/perubahan router.');
      }
    } else {
      await connection.query(`ALTER TABLE pelanggan ADD CONSTRAINT fk_pelanggan_router_mikrotik
        FOREIGN KEY (id_router) REFERENCES router_mikrotik (id_router) ON DELETE RESTRICT ON UPDATE RESTRICT`);
    }
  }

  async legacyConfig(connection) {
    const keys = ['MIKROTIK_HOST', 'MIKROTIK_PORT', 'MIKROTIK_USER', 'MIKROTIK_PASS'];
    const values = {};
    // Do not import ConfigService: getAll() invents default credentials.
    const [columns] = await connection.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pengaturan'`);
    const names = columns.map(column => column.COLUMN_NAME);
    const keyColumn = names.includes('id_pengaturan') ? 'id_pengaturan' : names.includes('kunci') ? 'kunci' : null;
    if (keyColumn && names.includes('nilai')) {
      const [settings] = await connection.query('SELECT ' + identifier(keyColumn) + ' AS setting_key, nilai FROM pengaturan WHERE ' + identifier(keyColumn) + ' IN (?, ?, ?, ?)', keys);
      for (const setting of settings) values[setting.setting_key] = setting.nilai;
    } else if (names.length) {
      throw failure(503, 'Struktur pengaturan tidak dikenali; migrasi router dihentikan.');
    }
    const value = key => values[key] !== undefined && values[key] !== null ? values[key] : (process.env[key] || '');
    const host = text(value('MIKROTIK_HOST'), 'MIKROTIK_HOST', 253, false);
    if (host && !validHost(host)) throw failure(503, 'MIKROTIK_HOST tersimpan tidak valid; perbaiki sebelum migrasi.');
    const username = text(value('MIKROTIK_USER'), 'MIKROTIK_USER', 100, false);
    const password = value('MIKROTIK_PASS');
    if (typeof password !== 'string' || password.length > 1024 || password.includes('\0')) throw failure(503, 'MIKROTIK_PASS tersimpan tidak valid.');
    return { host, username, password: password.trim() ? password : '', port: portNumber(value('MIKROTIK_PORT') || 8728) };
  }

  async find(connection, id, lock = false) {
    const [rows] = await connection.query(selectRouter + ' WHERE r.id_router = ?' + (lock ? ' FOR UPDATE' : ''), [id]);
    if (!rows.length) throw failure(404, 'Router tidak ditemukan.');
    return rows[0];
  }

  async list({ activeOnly = false } = {}) {
    await this.initialize();
    if (typeof activeOnly !== 'boolean') throw failure(400, 'activeOnly harus boolean.');
    const [rows] = await this.pool().query(selectRouter + (activeOnly ? ' WHERE r.is_active = 1' : '') + ' ORDER BY r.id_router');
    return rows.map(publicRouter);
  }

  async getById(id, { includePassword = false } = {}) {
    await this.initialize();
    if (typeof includePassword !== 'boolean') throw failure(400, 'includePassword harus boolean.');
    const row = await this.find(this.pool(), routerId(id));
    const result = publicRouter(row);
    if (includePassword) result.password = row.password_encrypted ? await credentials.decrypt(row.password_encrypted) : '';
    return result;
  }

  async getDefaultId() {
    await this.initialize();
    // Compatibility means first record, not first active/configured record.
    const [rows] = await this.pool().query('SELECT id_router FROM router_mikrotik ORDER BY id_router LIMIT 1');
    return rows.length ? Number(rows[0].id_router) : null;
  }

  async getClientConfig(id) {
    await this.initialize();
    const row = await this.find(this.pool(), routerId(id));
    const dto = publicRouter(row);
    if (!dto.is_active) throw failure(409, 'Router dinonaktifkan.');
    if (!dto.configured) throw failure(409, 'Router belum dikonfigurasi lengkap.');
    return { host: row.host, user: row.username, pass: await credentials.decrypt(row.password_encrypted),
      port: Number(row.port), id_router: Number(row.id_router), nama_router: row.nama_router };
  }

  async transaction(work) {
    const connection = await this.pool().getConnection();
    let reusable = true;
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try { await connection.rollback(); } catch (_) { reusable = false; }
      if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
        throw failure(409, 'Router masih memiliki pelanggan dan tidak dapat dihapus.');
      }
      if (error.statusCode) throw error;
      throw failure(503, 'Operasi database router gagal. Coba kembali.');
    } finally {
      if (reusable) connection.release();
      else connection.destroy();
    }
  }

  async create(data) {
    await this.initialize();
    const input = validate(data, true);
    const encrypted = await credentials.encrypt(input.password);
    return this.transaction(async connection => {
      const [insert] = await connection.query(`INSERT INTO router_mikrotik
        (nama_router, lokasi, host, port, username, password_encrypted, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.nama_router, input.lokasi, input.host, input.port, input.username, encrypted, input.is_active]);
      return publicRouter(await this.find(connection, insert.insertId));
    });
  }

  async update(id, data) {
    await this.initialize();
    id = routerId(id);
    const input = validate(data);
    if (Object.hasOwn(input, 'password')) {
      input.password_encrypted = await credentials.encrypt(input.password);
      delete input.password;
    }
    return this.transaction(async connection => {
      await this.find(connection, id, true);
      const names = Object.keys(input);
      if (names.length) await connection.query('UPDATE router_mikrotik SET ' + names.map(name => identifier(name) + ' = ?').join(', ') + ' WHERE id_router = ?', [...names.map(name => input[name]), id]);
      return publicRouter(await this.find(connection, id));
    });
  }

  async remove(id) {
    await this.initialize();
    id = routerId(id);
    return this.transaction(async connection => {
      await this.find(connection, id, true);
      const [customers] = await connection.query('SELECT id_pelanggan FROM pelanggan WHERE id_router = ? LIMIT 1 FOR UPDATE', [id]);
      if (customers.length) throw failure(409, 'Router masih memiliki pelanggan dan tidak dapat dihapus.');
      // Parent row lock + RESTRICT FK also cover concurrent customer assignment.
      await connection.query('DELETE FROM router_mikrotik WHERE id_router = ?', [id]);
      return { id_router: id };
    });
  }
}

// Importing this module does not start a migration or open a database connection.
module.exports = new RouterModel(() => require('../config/db'));
// Isolated pool injection keeps the CLI away from config/db's unrelated startup work.
module.exports.withDatabase = database => new RouterModel(() => database);

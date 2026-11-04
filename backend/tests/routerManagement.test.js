const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const root = path.join(__dirname, '..');
const testKey = crypto.randomBytes(32).toString('hex');
const validInput = { nama_router: 'Branch', host: 'router.example.net', username: 'operator', password: 'a test-only password' };
const dtoKeys = ['id_router', 'nama_router', 'lokasi', 'host', 'port', 'username', 'is_active', 'has_password', 'jumlah_pelanggan', 'configured'].sort();
const copy = value => JSON.parse(JSON.stringify(value));

function load(relative, mocks = {}, options = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  function localRequire(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('node:')) return require(name);
    throw new Error('Unexpected dependency: ' + name);
  }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, require: localRequire,
    __dirname: options.dirname || path.dirname(filename), Buffer,
    process: { env: options.env || {} },
    console: options.console || { log() { assert.fail('Unexpected log'); }, error() { assert.fail('Unexpected error log'); } }
  }, { filename });
  return module.exports;
}

function credentials(options = {}) {
  return load('utils/routerCredentials.js', {}, { env: { ROUTER_ENCRYPTION_KEY: testKey }, ...options });
}

function mockDatabase(options = {}) {
  const state = {
    routers: [], customers: [], markers: [], settings: {}, settingsTable: true,
    keyColumn: 'id_pengaturan', column: false, fk: false, nextId: 1,
    indexes: [
      { Key_name: 'PRIMARY', Column_name: 'id_pelanggan', Seq_in_index: 1, Non_unique: 0 },
      { Key_name: 'old_pppoe_unique', Column_name: 'pppoe_username', Seq_in_index: 1, Non_unique: 0 },
      { Key_name: 'uq_email', Column_name: 'email', Seq_in_index: 1, Non_unique: 0 }
    ], ...options
  };
  const calls = [];
  let owner;
  let sequence = 0;
  const waiters = [];
  const fk = { CONSTRAINT_NAME: 'fk_pelanggan_router_mikrotik', REFERENCED_TABLE_NAME: 'router_mikrotik', REFERENCED_COLUMN_NAME: 'id_router', DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'RESTRICT' };
  const result = value => [value, []];

  async function execute(session, raw, values = []) {
    const sql = raw.replace(/\s+/g, ' ').trim();
    calls.push({ session, sql, values: copy(values) });
    if (state.failOnce && state.failOnce.test(sql)) {
      state.failOnce = null;
      throw Object.assign(new Error('Driver SQL with secret must not escape'), { code: 'ER_TEST_FAILURE' });
    }
    if (sql.startsWith('SELECT GET_LOCK')) {
      if (state.lockTimeout) return result([{ acquired: 0 }]);
      if (owner !== undefined) await new Promise(resolve => waiters.push(resolve));
      owner = session;
      if (state.lockBarrier) await state.lockBarrier;
      return result([{ acquired: 1 }]);
    }
    if (sql.startsWith('SELECT RELEASE_LOCK')) {
      assert.equal(owner, session);
      owner = undefined;
      if (waiters.length) waiters.shift()();
      if (state.releaseFailure) throw new Error('Release lost');
      return result([{ released: 1 }]);
    }
    if (sql.startsWith('CREATE TABLE')) return result({});
    if (sql.startsWith('SHOW COLUMNS FROM pelanggan')) return result(state.column ? [{ Type: state.columnType || 'int unsigned', Null: 'YES' }] : []);
    if (sql.startsWith('ALTER TABLE pelanggan ADD COLUMN')) { state.column = true; return result({}); }
    if (sql === 'SHOW INDEX FROM pelanggan') return result(copy(state.indexes));
    if (sql.startsWith('ALTER TABLE pelanggan ADD CONSTRAINT')) { state.fk = true; return result({}); }
    if (sql.startsWith('ALTER TABLE pelanggan')) {
      for (const match of sql.matchAll(/DROP INDEX `([^`]+)`/g)) state.indexes = state.indexes.filter(index => index.Key_name !== match[1]);
      if (sql.includes('ADD UNIQUE INDEX')) state.indexes.push(
        { Key_name: 'uq_pelanggan_router_pppoe', Column_name: 'id_router', Seq_in_index: 1, Non_unique: 0 },
        { Key_name: 'uq_pelanggan_router_pppoe', Column_name: 'pppoe_username', Seq_in_index: 2, Non_unique: 0 }
      );
      return result({});
    }
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return result(state.fk ? [typeof state.fk === 'object' ? state.fk : fk] : []);
    if (sql.includes('information_schema.COLUMNS')) return result(state.settingsTable ? [{ COLUMN_NAME: state.keyColumn }, { COLUMN_NAME: 'nilai' }] : []);
    if (sql.includes(' AS setting_key, nilai FROM pengaturan')) return result(Object.entries(state.settings).map(([setting_key, nilai]) => ({ setting_key, nilai })));
    if (sql.startsWith('SELECT password_encrypted FROM')) return result(state.routers.filter(row => row.password_encrypted).slice(0, 1).map(row => ({ password_encrypted: row.password_encrypted })));
    if (sql.includes('FROM router_migrations')) return result(copy(state.markers));
    if (sql.startsWith('SELECT id_router FROM router_mikrotik WHERE nama_router')) return result(state.routers.filter(row => row.nama_router === values[0]).slice(0, 1).map(row => ({ id_router: row.id_router })));
    if (sql.startsWith('INSERT INTO router_mikrotik')) {
      const [nama_router, lokasi, host, port, username, password_encrypted, is_active] = values;
      const id_router = state.nextId++;
      state.routers.push({ id_router, nama_router, lokasi, host, port, username, password_encrypted, is_active });
      return result({ insertId: id_router, affectedRows: 1 });
    }
    if (sql.startsWith('UPDATE pelanggan SET id_router')) {
      let affectedRows = 0;
      for (const customer of state.customers) {
        const username = (customer.pppoe_username || '').trim();
        if (customer.id_router == null && username && !/^REG-/i.test(username)) {
          customer.id_router = values[0];
          affectedRows++;
        }
      }
      return result({ affectedRows });
    }
    if (sql.startsWith('INSERT INTO router_migrations')) {
      state.markers.push({ id_router_seed: values[1], jumlah_pelanggan_migrasi: values[2] });
      return result({ affectedRows: 1 });
    }
    if (sql.startsWith('SELECT id_router FROM router_mikrotik ORDER BY')) return result(state.routers.slice().sort((a, b) => a.id_router - b.id_router).slice(0, 1).map(row => ({ id_router: row.id_router })));
    if (sql.startsWith('SELECT r.id_router')) {
      let rows = state.routers.slice();
      if (sql.includes('WHERE r.id_router = ?')) rows = rows.filter(row => row.id_router === values[0]);
      if (sql.includes('WHERE r.is_active = 1')) rows = rows.filter(row => row.is_active === 1);
      return result(rows.sort((a, b) => a.id_router - b.id_router).map(row => ({ ...row, jumlah_pelanggan: state.customers.filter(customer => customer.id_router === row.id_router).length })));
    }
    if (sql.startsWith('UPDATE router_mikrotik SET')) {
      const row = state.routers.find(router => router.id_router === values[values.length - 1]);
      const names = [...sql.matchAll(/`(\w+)` = \?/g)].map(match => match[1]);
      names.forEach((name, index) => { row[name] = values[index]; });
      return result({ affectedRows: 1 });
    }
    if (sql.startsWith('SELECT id_pelanggan FROM pelanggan')) {
      assert.match(sql, /FOR UPDATE$/);
      return result(state.customers.filter(customer => customer.id_router === values[0]).slice(0, 1));
    }
    if (sql.startsWith('DELETE FROM router_mikrotik')) {
      if (state.deleteRace || state.customers.some(customer => customer.id_router === values[0])) {
        throw Object.assign(new Error('FK rejected SQL'), { code: 'ER_ROW_IS_REFERENCED_2' });
      }
      state.routers = state.routers.filter(row => row.id_router !== values[0]);
      return result({ affectedRows: 1 });
    }
    assert.fail('Unhandled SQL: ' + sql);
  }

  const pool = {
    query(sql, values) { return execute('pool', sql, values); },
    async getConnection() {
      const session = ++sequence;
      let snapshot;
      return {
        query(sql, values) { return execute(session, sql, values); },
        async beginTransaction() {
          calls.push({ session, sql: 'BEGIN' });
          snapshot = copy({ routers: state.routers, customers: state.customers, markers: state.markers });
        },
        async commit() { calls.push({ session, sql: 'COMMIT' }); snapshot = undefined; },
        async rollback() { calls.push({ session, sql: 'ROLLBACK' }); if (snapshot) Object.assign(state, snapshot); },
        release() { calls.push({ session, sql: 'RELEASE' }); },
        destroy() { calls.push({ session, sql: 'DESTROY' }); },
      };
    },
    async end() { calls.push({ sql: 'END' }); }
  };
  return { state, calls, database: { promise() { return pool; } } };
}

function setup(options = {}, env = {}, secret = credentials()) {
  const db = mockDatabase(options);
  const exported = load('models/Router.js', { '../utils/routerCredentials': secret, '../config/db': db.database }, { env });
  return { ...db, model: exported, fresh() { return exported.withDatabase(db.database); }, secret };
}

function status(code) {
  return error => error.statusCode === code;
}

test('lazy migration uses real settings, scopes uniqueness, maps only connected nonREG customers and stores no plaintext', async () => {
  const { model, state, calls } = setup({
    settings: { MIKROTIK_HOST: '10.0.0.1', MIKROTIK_PORT: '8729', MIKROTIK_USER: 'saved-user', MIKROTIK_PASS: 'saved-secret' },
    customers: [
      { id_pelanggan: 1, pppoe_username: 'connected', pppoe_status: 'inactive' },
      { id_pelanggan: 2, pppoe_username: 'REG-123' },
      { id_pelanggan: 3, pppoe_username: '' },
      { id_pelanggan: 4, pppoe_username: null },
      { id_pelanggan: 5, pppoe_username: '   ' },
      { id_pelanggan: 6, pppoe_username: 'already-assigned', id_router: 22 }
    ]
  }, { MIKROTIK_HOST: 'wrong.example.net', MIKROTIK_USER: 'env-user', MIKROTIK_PASS: 'env-secret' });
  assert.equal(calls.length, 0);
  const summary = await model.initialize();
  assert.deepEqual(copy(summary), { id_router_seed: 1, jumlah_pelanggan_migrasi: 1 });
  assert.equal(state.routers.length, 1);
  assert.equal(state.routers[0].nama_router, 'Router Utama');
  assert.equal(state.routers[0].host, '10.0.0.1');
  assert.equal(state.routers[0].username, 'saved-user');
  assert.equal(state.routers[0].port, 8729);
  assert.notEqual(state.routers[0].password_encrypted, 'saved-secret');
  assert.match(state.routers[0].password_encrypted, /^v1:/);
  assert.equal((await model.getById(1, { includePassword: true })).password, 'saved-secret');
  assert.equal(state.customers[0].id_router, 1);
  assert.equal(state.customers[1].id_router, undefined);
  assert.equal(state.customers[2].id_router, undefined);
  assert.equal(state.customers[3].id_router, undefined);
  assert.equal(state.customers[4].id_router, undefined);
  assert.equal(state.customers[5].id_router, 22);
  assert.equal(state.indexes.some(index => index.Key_name === 'old_pppoe_unique'), false);
  assert.equal(state.indexes.some(index => index.Key_name === 'uq_email'), true);
  assert.equal(state.indexes.filter(index => index.Key_name === 'uq_pelanggan_router_pppoe').length, 2);
  assert.equal(state.fk, true);
  const migrationCalls = calls.filter(call => call.sql !== 'RELEASE');
  assert.equal(new Set(migrationCalls.slice(0, migrationCalls.findIndex(call => call.sql.startsWith('SELECT r.id_router'))).map(call => call.session)).size, 1);
  assert.ok(calls.some(call => call.sql.includes('ON DELETE RESTRICT ON UPDATE RESTRICT')));
  const dto = await model.getById(1);
  assert.deepEqual(Object.keys(dto).sort(), dtoKeys);
  assert.equal(dto.jumlah_pelanggan, 1);
  assert.equal(JSON.stringify(await model.list()).includes('saved-secret'), false);
});

test('environment-only and legacy kunci settings are supported; no invented credentials when absent', async () => {
  const environment = setup({ settingsTable: false }, { MIKROTIK_HOST: '2001:db8::1', MIKROTIK_PORT: '8729', MIKROTIK_USER: 'from-env', MIKROTIK_PASS: 'from-env-secret' });
  assert.equal((await environment.model.getClientConfig(1)).host, '2001:db8::1');
  assert.equal((await environment.model.getClientConfig(1)).pass, 'from-env-secret');
  const empty = setup();
  const dto = (await empty.model.list())[0];
  assert.equal(dto.host, '');
  assert.equal(dto.username, '');
  assert.equal(dto.has_password, false);
  assert.equal(dto.configured, false);
  assert.equal(dto.port, 8728);
  await assert.rejects(empty.model.getClientConfig(1), status(409));
  const legacy = setup({ keyColumn: 'kunci', settings: { MIKROTIK_HOST: '', MIKROTIK_USER: '', MIKROTIK_PASS: '' } }, { MIKROTIK_HOST: 'env.example.net', MIKROTIK_USER: 'env', MIKROTIK_PASS: 'env-secret' });
  assert.equal((await legacy.model.list())[0].host, '');
  assert.equal(legacy.state.routers[0].password_encrypted, null);
});

test('initialization is serialized across instances and ordinary reads await readiness', async () => {
  let unlock;
  const barrier = new Promise(resolve => { unlock = resolve; });
  const { model, fresh, state, calls } = setup({ lockBarrier: barrier });
  const second = fresh();
  const pending = [model.initialize(), model.initialize(), model.list(), second.initialize()];
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(call => call.sql.startsWith('SELECT GET_LOCK')).length, 2);
  assert.equal(calls.some(call => call.sql.startsWith('CREATE TABLE')), false);
  unlock();
  await Promise.all(pending);
  assert.equal(state.routers.length, 1);
  assert.equal(state.markers.length, 1);
  const seedWrites = calls.filter(call => call.sql.startsWith('INSERT INTO router_mikrotik'));
  assert.equal(seedWrites.length, 1);
  assert.equal(calls.filter(call => call.sql.startsWith('UPDATE pelanggan SET')).length, 1);
});

test('failed seed/marker transaction rolls back, fails visibly, releases lock and retries', async () => {
  const { model, state, calls } = setup({ failOnce: /^INSERT INTO router_migrations/, customers: [{ id_pelanggan: 1, pppoe_username: 'legacy' }] });
  await assert.rejects(model.initialize(), error => error.statusCode === 503 && !error.message.includes('secret'));
  assert.equal(state.routers.length, 0);
  assert.equal(state.customers[0].id_router, undefined);
  assert.equal(state.markers.length, 0);
  assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
  assert.ok(calls.some(call => call.sql.startsWith('SELECT RELEASE_LOCK')));
  await model.initialize();
  assert.equal(state.routers.length, 1);
  assert.equal(state.customers[0].id_router, state.routers[0].id_router);
  assert.equal(state.markers.length, 1);
  assert.equal(calls.filter(call => call.sql.startsWith('ALTER TABLE pelanggan ADD COLUMN')).length, 1);
});

test('lock timeout and incompatible schema reject initialization and remain retryable', async () => {
  const locked = setup({ lockTimeout: true });
  await assert.rejects(locked.model.list(), status(503));
  assert.equal(locked.state.routers.length, 0);
  locked.state.lockTimeout = false;
  await locked.model.list();
  const incompatible = setup({ column: true, columnType: 'int' });
  await assert.rejects(incompatible.model.initialize(), status(503));
  incompatible.state.columnType = 'int(10) unsigned';
  await incompatible.model.initialize();
  const unsafeFk = setup({ fk: { REFERENCED_TABLE_NAME: 'router_mikrotik', REFERENCED_COLUMN_NAME: 'id_router', DELETE_RULE: 'CASCADE', UPDATE_RULE: 'RESTRICT' } });
  await assert.rejects(unsafeFk.model.initialize(), status(503));
  assert.equal(unsafeFk.state.markers.length, 0);
});

test('uncertain advisory-lock release destroys rather than pools the session', async () => {
  const { model, calls } = setup({ releaseFailure: true });
  await model.initialize();
  assert.equal(calls[calls.length - 1].sql, 'DESTROY');
});

test('marker survives seed deletion/restart and never assigns later customers or reseeds', async () => {
  const { model, fresh, state, calls } = setup();
  await model.initialize();
  await model.remove(1);
  state.customers.push({ id_pelanggan: 2, pppoe_username: 'later' });
  const restarted = fresh();
  await restarted.initialize();
  assert.equal(state.routers.length, 0);
  assert.equal(state.markers.length, 1);
  assert.equal(state.customers[0].id_router, undefined);
  assert.equal(await restarted.getDefaultId(), null);
  assert.equal(calls.filter(call => call.sql.startsWith('INSERT INTO router_mikrotik')).length, 1);
  assert.equal(calls.filter(call => call.sql.startsWith('UPDATE pelanggan SET')).length, 1);
});

test('CRUD DTOs are secret-free; password edits encrypt and blank edits preserve; inactive remains default', async () => {
  const { model, state } = setup();
  const created = await model.create(validInput);
  assert.equal(created.id_router, 2);
  assert.equal(created.configured, true);
  assert.deepEqual(Object.keys(created).sort(), dtoKeys);
  const encrypted = state.routers[1].password_encrypted;
  await model.update(2, { password: '   ', lokasi: 'New location', is_active: false });
  assert.equal(state.routers[1].password_encrypted, encrypted);
  await assert.rejects(model.getClientConfig(2), status(409));
  await model.update(2, { password: '  replacement password  ', is_active: true });
  assert.notEqual(state.routers[1].password_encrypted, encrypted);
  assert.equal((await model.getClientConfig(2)).pass, '  replacement password  ');
  assert.deepEqual(Object.keys(await model.getClientConfig(2)).sort(), ['host', 'user', 'pass', 'port', 'id_router', 'nama_router'].sort());
  assert.equal((await model.getById(2, { includePassword: true })).password, '  replacement password  ');
  await model.update(1, { is_active: false });
  assert.equal(await model.getDefaultId(), 1);
  assert.deepEqual((await model.list({ activeOnly: true })).map(row => row.id_router), [2]);
  await assert.rejects(model.getClientConfig(1), status(409));
  await assert.rejects(model.getClientConfig(999), status(404));
  await assert.rejects(model.getClientConfig(undefined), status(400));
  assert.equal(JSON.stringify(await model.list()).includes('password_encrypted'), false);
});

test('validation rejects URL/path hosts, malformed IPs, invalid ports, booleans, lengths and mass assignment', async () => {
  const { model } = setup();
  const cases = [
    { nama_router: '' }, { nama_router: 'x'.repeat(101) }, { nama_router: 'line\nbreak' },
    { lokasi: 'x'.repeat(256) }, { username: '' }, { username: 'x'.repeat(101) },
    { password: '' }, { password: '   ' }, { password: 'x'.repeat(1025) },
    { host: 'http://router.example.net' }, { host: 'router/path' }, { host: 'host:8728' },
    { host: '999.1.1.1' }, { host: '-bad.example' }, { host: 'x'.repeat(64) + '.net' },
    { port: 0 }, { port: 65536 }, { port: 1.5 }, { port: '8728oops' }, { port: true },
    { is_active: 'false' }, { is_active: 0 }, { password_encrypted: 'injected' }, { id_router: 10 }
  ];
  for (const change of cases) await assert.rejects(model.create({ ...validInput, ...change }), status(400), JSON.stringify(Object.keys(change)));
  await assert.rejects(model.create(null), status(400));
  await assert.rejects(model.create([]), status(400));
  for (const host of ['127.0.0.1', '2001:db8::4', 'localhost', 'router.example.net.']) {
    assert.equal((await model.create({ ...validInput, host, port: '65535' })).host, host);
  }
  for (const id of ['1 OR 1=1', 0, -1, 1.2, 4294967296, '1x']) await assert.rejects(model.update(id, { nama_router: 'Name' }), status(400));
  await assert.rejects(model.update(999, { nama_router: 'Name' }), status(404));
  await assert.rejects(model.remove(999), status(404));
  await assert.rejects(model.list({ activeOnly: 'false' }), status(400));
});

test('delete refuses assigned customers, deactivation works, and FK race maps to conflict', async () => {
  const { model, state, calls } = setup({ customers: [{ id_pelanggan: 1, pppoe_username: 'legacy' }] });
  await model.initialize();
  await assert.rejects(model.remove(1), status(409));
  assert.equal((await model.update(1, { is_active: false })).is_active, false);
  assert.equal(state.routers.length, 1);
  state.customers = [];
  state.deleteRace = true;
  await assert.rejects(model.remove(1), status(409));
  assert.equal(state.routers.length, 1);
  state.deleteRace = false;
  assert.deepEqual(copy(await model.remove(1)), { id_router: 1 });
  const deleteCall = calls.findIndex(call => call.sql.startsWith('DELETE FROM router_mikrotik'));
  const session = calls[deleteCall].session;
  assert.ok(calls.slice(0, deleteCall).some(call => call.session === session && /WHERE r.id_router = \? FOR UPDATE$/.test(call.sql)));
  assert.ok(calls.slice(0, deleteCall).some(call => call.session === session && /FROM pelanggan.*FOR UPDATE$/.test(call.sql)));
});

test('AES-GCM randomizes encryption and rejects tampering/wrong/invalid keys without echoing secrets', async () => {
  const cipher = credentials();
  const first = await cipher.encrypt('test secret');
  const second = await cipher.encrypt('test secret');
  assert.notEqual(first, second);
  assert.equal(await cipher.decrypt(first), 'test secret');
  const parts = first.split(':');
  const ciphertext = Buffer.from(parts[3], 'base64');
  ciphertext[0] ^= 1;
  parts[3] = ciphertext.toString('base64');
  await assert.rejects(cipher.decrypt(parts.join(':')), status(503));
  const wrong = credentials({ env: { ROUTER_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex') } });
  await assert.rejects(wrong.decrypt(first), error => error.statusCode === 503 && !error.message.includes(first));
  const invalid = credentials({ env: { ROUTER_ENCRYPTION_KEY: '' } });
  await assert.rejects(invalid.encrypt('test secret'), status(503));
  const base64 = credentials({ env: { ROUTER_ENCRYPTION_KEY: Buffer.from(testKey, 'hex').toString('base64') } });
  assert.equal(await base64.decrypt(first), 'test secret');
});

test('persistent file key is atomic/shared across processes; missing key never regenerates on decryption', async t => {
  const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), 'router-credentials-'));
  t.after(() => fsp.rm(temporary, { recursive: true, force: true }));
  const dirname = path.join(temporary, 'utils');
  const keyFile = path.join(temporary, 'config', '.router-encryption.key');
  const first = credentials({ env: {}, dirname });
  const second = credentials({ env: {}, dirname });
  const [one, two] = await Promise.all([first.encrypt('one'), second.encrypt('two')]);
  assert.equal(await second.decrypt(one), 'one');
  assert.equal(await first.decrypt(two), 'two');
  assert.deepEqual(await fsp.readdir(path.dirname(keyFile)), ['.router-encryption.key']);
  if (process.platform !== 'win32') assert.equal((await fsp.stat(keyFile)).mode & 0o777, 0o600);
  const restarted = credentials({ env: {}, dirname });
  assert.equal(await restarted.decrypt(two), 'two');
  await fsp.unlink(keyFile);
  const missing = credentials({ env: {}, dirname });
  await assert.rejects(missing.decrypt(one), status(503));
  await assert.rejects(fsp.access(keyFile), { code: 'ENOENT' });
});

test('initialization refuses a missing/wrong encryption key before accepting new credentials', async () => {
  const cipher = credentials();
  const encrypted = await cipher.encrypt('existing secret');
  const wrong = credentials({ env: { ROUTER_ENCRYPTION_KEY: 'invalid' } });
  const { model, state } = setup({ routers: [{ id_router: 1, password_encrypted: encrypted }] }, {}, wrong);
  await assert.rejects(model.create(validInput), status(503));
  assert.equal(state.markers.length, 0);
  assert.equal(state.routers.length, 1);
});

function routeHarness(model, ping = async () => ({ online: true })) {
  const secret = crypto.randomBytes(32).toString('hex');
  const middleware = load('middleware/auth.js', { jsonwebtoken: jwt }, { env: { JWT_SECRET: secret } });
  const common = [];
  const routes = [];
  let serviceLoads = 0;
  const fakeRouter = { use(fn) { common.push(fn); } };
  for (const method of ['get', 'post', 'put', 'delete']) fakeRouter[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  load('routes/routers.js', {
    express: { Router: () => fakeRouter }, jsonwebtoken: jwt,
    '../middleware/auth': middleware, '../models/Router': model,
    get '../services/mikrotik'() { serviceLoads++; return { ping }; }
  });
  return {
    serviceLoads: () => serviceLoads,
    async request(method, url, claims, { query = {}, body = {}, id = '1', token } = {}) {
      const route = routes.find(item => item.method === method && item.url === url);
      assert.ok(route, 'Route must exist');
      const req = { headers: {}, query, body, params: { id } };
      if (claims !== null) req.headers.authorization = 'Bearer ' + (token || jwt.sign(claims, secret));
      const response = { status: 200 };
      const res = { status(code) { response.status = code; return res; }, json(value) { response.body = copy(value); } };
      const stack = [...common, ...route.handlers];
      async function run(index) {
        if (index === stack.length) return;
        let next;
        await stack[index](req, res, () => { next = run(index + 1); });
        if (next) await next;
      }
      await run(0);
      return response;
    }
  };
}

test('API rejects customers, unknown/missing roles and missing/invalid tokens before any model access', async () => {
  const model = new Proxy({}, { get() { assert.fail('Unauthorized request reached the model'); } });
  const api = routeHarness(model);
  assert.equal(api.serviceLoads(), 0);
  for (const claims of [{ id_pelanggan: 1, role: 'customer' }, { id: 1 }, { id: 1, role: 'root' }, { id_pelanggan: 1, id: 1, role: 'admin' }, { role: 'admin' }]) {
    assert.equal((await api.request('get', '/', claims)).status, 403);
  }
  assert.equal((await api.request('get', '/', null)).status, 401);
  assert.equal((await api.request('get', '/', { id: 1, role: 'admin' }, { token: 'invalid' })).status, 403);
  for (const [method, url] of [['post', '/'], ['put', '/:id'], ['delete', '/:id'], ['post', '/:id/test']]) {
    assert.equal((await api.request(method, url, { id: 1, role: 'admin' })).status, 403);
  }
  assert.equal(api.serviceLoads(), 0);
});

test('API list/mutations follow success/data convention and validate active_only', async () => {
  const { model } = setup();
  const api = routeHarness(model);
  const admin = { id: 1, role: 'admin' };
  const superadmin = { id: 2, role: 'superadmin' };
  let response = await api.request('get', '/', admin, { query: { active_only: 'true' } });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(Object.keys(response.body.data[0]).sort(), dtoKeys);
  assert.equal((await api.request('get', '/', admin, { query: { active_only: '1' } })).status, 400);
  response = await api.request('post', '/', superadmin, { body: validInput });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.id_router, 2);
  response = await api.request('put', '/:id', superadmin, { id: '2', body: { is_active: false, password: '' } });
  assert.equal(response.body.data.is_active, false);
  response = await api.request('delete', '/:id', superadmin, { id: '2' });
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, { id_router: 2 });
  assert.equal(api.serviceLoads(), 0);
});

test('test endpoint lazily pings exact saved inactive config with skipCache and never echoes secrets/errors', async () => {
  const { model } = setup();
  await model.initialize();
  const saved = await model.create({ ...validInput, is_active: false });
  let received;
  const api = routeHarness(model, async (config, skipCache) => {
    received = { config: copy(config), skipCache };
    return { online: false, error: config.pass, password: config.pass, password_encrypted: 'must not escape' };
  });
  assert.equal(api.serviceLoads(), 0);
  const response = await api.request('post', '/:id/test', { id: 1, role: 'superadmin' }, { id: String(saved.id_router), body: { host: 'ignored.example.net', password: 'ignored' } });
  assert.equal(api.serviceLoads(), 1);
  assert.equal(received.config.host, validInput.host);
  assert.equal(received.config.pass, validInput.password);
  assert.equal(received.config.id_router, saved.id_router);
  assert.equal(received.skipCache, true);
  assert.equal(response.body.data.online, false);
  assert.equal(JSON.stringify(response).includes(validInput.password), false);
  assert.equal(JSON.stringify(response).includes('password_encrypted'), false);
  const incomplete = await api.request('post', '/:id/test', { id: 1, role: 'superadmin' }, { id: '1' });
  assert.equal(incomplete.status, 409);
  assert.equal(api.serviceLoads(), 1);
  assert.equal((await api.request('post', '/:id/test', { id: 1, role: 'superadmin' }, { id: '999' })).status, 404);
});

test('API suppresses unexpected SQL errors and ping exceptions', async () => {
  const throwing = routeHarness({ async list() { throw new Error('SQL with secret ciphertext'); } });
  const response = await throwing.request('get', '/', { id: 1, role: 'admin' });
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(response).includes('ciphertext'), false);
  const { model } = setup();
  await model.create(validInput);
  const api = routeHarness(model, async () => { throw new Error(validInput.password); });
  const failed = await api.request('post', '/:id/test', { id: 1, role: 'superadmin' }, { id: '2' });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.data.online, false);
  assert.equal(JSON.stringify(failed).includes(validInput.password), false);
});

test('CLI uses isolated pool, quiet dotenv, sanitized counts/ids/names only, and always closes DB', async () => {
  const logs = [];
  const { database, calls } = mockDatabase();
  let fail = false;
  const main = load('scripts/migrateRouters.js', {
    dotenv: { config(options) { assert.equal(options.quiet, true); assert.equal(options.path, path.join(root, '.env')); } },
    mysql2: { createPool() { return database; } },
    '../models/Router': {
      withDatabase(pool) {
        assert.equal(pool, database);
        return {
          async initialize() { if (fail) throw new Error('Do not log credentials'); return { id_router_seed: 1, jumlah_pelanggan_migrasi: 3 }; },
          async list() { return [{ id_router: 1, nama_router: 'Router\u001b\nUtama', jumlah_pelanggan: 3, host: 'private-host', password: 'private-password' }]; }
        };
      }
    }
  }, { console: { log(message) { logs.push(message); }, error() { assert.fail('Unexpected error log'); } } });
  await main();
  assert.deepEqual(JSON.parse(logs[0]), {
    jumlah_router: 1, id_router_seed: 1, jumlah_pelanggan_migrasi: 3,
    routers: [{ id_router: 1, nama_router: 'RouterUtama', jumlah_pelanggan: 3 }]
  });
  assert.equal(calls[calls.length - 1].sql, 'END');
  fail = true;
  await assert.rejects(main());
  assert.equal(calls.filter(call => call.sql === 'END').length, 2);
  assert.equal(logs.length, 1);
});

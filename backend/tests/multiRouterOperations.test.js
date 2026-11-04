const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { AsyncLocalStorage } = require('node:async_hooks');

const logger = {
  info() {}, warn() {}, error() {}, success() {}, once() {}, box() {},
  stateChange(key, value, callback) { callback(value); }
};
const copy = value => JSON.parse(JSON.stringify(value));
const quietConsole = { log() {}, warn() {}, error() {} };

function load(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, __dirname: path.dirname(filename), console: quietConsole, process, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency in ${relativePath}: ${name}`);
      return mocks[name];
    }
  }, { filename });
  return module.exports;
}

function registryHarness() {
  const records = new Map([
    [1, { id_router: 1, nama_router: 'One', host: 'router-one', user: 'one', pass: 'password-one', port: 8728 }],
    [2, { id_router: 2, nama_router: 'Two', host: 'router-two', user: 'two', pass: 'password-two', port: 8729 }]
  ]);
  let defaults = 0;
  const registry = {
    async initialize() {},
    async getDefaultId() { defaults += 1; return 1; },
    async list() { return [...records.values()].filter(row => !row.disabled).map(row => ({ id_router: row.id_router, nama_router: row.nama_router })); },
    async getClientConfig(id) {
      const row = records.get(Number(id));
      if (!row || row.disabled || !row.host || !row.user || !row.pass) throw new Error('Invalid, disabled, or incomplete router');
      return { ...row };
    }
  };
  return { registry, records, get defaults() { return defaults; } };
}

function mikrotikHarness() {
  const registry = registryHarness();
  const writes = [];
  const connections = [];
  const removed = new Set();
  class FakeRouterOSAPI {
    constructor(config) { this.config = copy(config); connections.push(this.config); }
    async connect() { await new Promise(resolve => setTimeout(resolve, 1)); }
    async close() {}
    async write(command, params) {
      await new Promise(resolve => setTimeout(resolve, this.config.port === 8728 ? 2 : 1));
      const host = this.config.host;
      writes.push({ host, command, params: params ? copy(params) : null });
      if (command === '/system/resource/print') return [{ version: host, 'board-name': host }];
      if (command === '/ppp/secret/print') return [{ '.id': host + '-secret', name: 'shared', password: 'never-expose', pass: 'also-private' }];
      if (command === '/ppp/active/print') return removed.has(host) ? [] : [{ '.id': host + '-active', name: 'shared', address: host === 'router-one' ? '192.0.2.1' : '192.0.2.2' }];
      if (command === '/ppp/profile/print' || command === '/ip/firewall/filter/print') return [{ '.id': host + '-existing' }];
      if (command === '/ip/firewall/address-list/print') return [{ '.id': host + '-list', comment: 'shared' }];
      if (command === '/ppp/active/remove') removed.add(host);
      return [];
    }
  }
  const service = load('services/mikrotik.js', {
    'node-routeros': { RouterOSAPI: FakeRouterOSAPI },
    'node:async_hooks': { AsyncLocalStorage },
    '../models/Router': registry.registry,
    '../utils/logger': logger,
    os: require('node:os'),
    '../config/db': { query(sql, callback) { assert.equal(sql, 'SELECT 1'); callback(null); } }
  });
  return { ...registry, registryHarness: registry, service, writes, connections };
}

test('concurrent nested RouterOS operations and detached facade methods keep router ownership', async () => {
  const harness = mikrotikHarness();
  const one = await harness.service.forRouter(1);
  const two = await harness.service.forRouter(2);
  const detachedEnable = two.enableSecret;
  const results = await Promise.all([one.disableSecret('shared'), detachedEnable('shared'), one.disconnectSession('shared')]);
  assert.ok(results.every(result => result.success));
  const sets = harness.writes.filter(write => write.command === '/ppp/secret/set');
  assert.equal(sets.length, 2);
  for (const write of harness.writes) {
    for (const param of write.params || []) {
      if (param.startsWith('=.id=')) assert.ok(param.startsWith('=.id=' + write.host + '-'));
    }
  }
  assert.ok(sets.find(write => write.host === 'router-one').params.includes('=profile=ISOLIR'));
  assert.ok(sets.find(write => write.host === 'router-two').params.includes('=profile=default'));
  for (const connection of harness.connections) {
    const selected = connection.host === 'router-one' ? harness.records.get(1) : harness.records.get(2);
    assert.equal(connection.user, selected.user);
    assert.equal(connection.password, selected.pass);
    assert.equal(connection.port, selected.port);
  }
  assert.equal(Object.hasOwn(one, 'pass'), false);
  assert.equal(Object.hasOwn(one, 'getServerHealth'), false);
  const secrets = await two.getSecrets();
  assert.equal(Object.hasOwn(secrets[0], 'password'), false);
  assert.equal(Object.hasOwn(secrets[0], 'pass'), false);
});

test('ping cache is per-router and custom credentials cannot fill from or poison the registry', async () => {
  const harness = mikrotikHarness();
  const one = await harness.service.forRouter(1);
  const two = await harness.service.forRouter(2);
  assert.equal((await one.ping()).version, 'router-one');
  assert.equal((await two.ping()).version, 'router-two');
  assert.equal(harness.connections.length, 2);
  await Promise.all([one.ping(), two.ping()]);
  assert.equal(harness.connections.length, 2);
  const probe = await harness.service.ping({ host: 'probe', user: 'probe-user', pass: 'probe-pass', port: 8730 });
  assert.equal(probe.version, 'probe');
  assert.equal((await one.ping()).version, 'router-one');
  const blank = await harness.service.ping({ host: 'probe', user: 'probe-user', pass: '', port: 8730 });
  assert.equal(blank.online, false);
  await assert.rejects(harness.service.executeCommand('/ppp/secret/print', null, { host: 'probe', user: 'probe-user' }), /belum dikonfigurasi/);
  assert.equal(harness.connections.length, 3);
  harness.records.get(1).pass = 'rotated';
  await one.ping();
  assert.equal(harness.connections.length, 4);
  assert.equal(harness.connections.at(-1).password, 'rotated');
});

test('only missing IDs use the stable legacy default; explicit invalid or disabled IDs never fallback', async () => {
  const harness = mikrotikHarness();
  const legacy = await harness.service.forRouter();
  assert.equal(legacy.id_router, 1);
  harness.records.get(1).disabled = true;
  await assert.rejects(harness.service.forRouter(), /disabled/);
  for (const id of [1, 999, '', 'invalid']) await assert.rejects(harness.service.forRouter(id), /Invalid/);
  const before = harness.connections.length;
  await assert.rejects(legacy.disableSecret('shared'), /disabled/);
  assert.equal(harness.connections.length, before);
  const two = await harness.service.forRouter(2);
  harness.records.get(2).host = '';
  await assert.rejects(two.getSecrets(), /incomplete/);
  assert.equal(harness.registryHarness.defaults, 2);
});

test('server health does not initialize or select a router', async () => {
  const harness = mikrotikHarness();
  harness.registry.initialize = async () => { assert.fail('Health must not depend on router registry'); };
  assert.equal((await harness.service.getServerHealth()).db_status, 'connected');
  assert.equal(harness.connections.length, 0);
});

test('sync isolates an offline router and same-named accounts while retaining guarded telemetry writes', async () => {
  const registry = registryHarness();
  const customers = [
    { id_pelanggan: 1, id_router: 1, pppoe_username: 'shared', pppoe_status: 'active', status_tagihan: 'merah' },
    { id_pelanggan: 2, id_router: 2, pppoe_username: 'shared', pppoe_status: 'inactive', status_tagihan: 'hijau' }
  ];
  const events = [];
  const updates = [];
  const reads = [];
  const service = load('services/syncService.js', {
    '../models/Router': registry.registry,
    './mikrotik': { async forRouter(id) {
      return {
        async ping() { return { online: id === 2 }; },
        async getActiveConnections() { assert.equal(id, 2); return [{ name: 'shared' }, { name: 'unregistered' }]; }
      };
    } },
    '../models/Pelanggan': {
      getAll(callback, options) { reads.push(options.id_router); callback(null, customers); },
      update(id, data, callback, options) { updates.push({ id, data: copy(data), options: copy(options) }); callback(null, { affectedRows: 1 }); }
    },
    './socket': { broadcast(event, data) { events.push({ event, data: copy(data) }); } },
    '../utils/logger': logger
  });
  const summaries = copy(await service.sync());
  assert.deepEqual(reads, [2]);
  assert.deepEqual(updates, [{ id: 2, data: { pppoe_status: 'active' }, options: { id_router: 2 } }]);
  assert.equal(summaries.find(row => row.id_router === 1).telemetry_available, false);
  assert.deepEqual(summaries.find(row => row.id_router === 2).active_usernames, ['shared', 'unregistered']);
  assert.equal(summaries.find(row => row.id_router === 2).unregistered_count, 1);
  for (const event of events) {
    assert.ok([1, 2].includes(event.data.id_router));
    assert.equal(typeof event.data.telemetry_available, 'boolean');
    assert.ok(Array.isArray(event.data.active_usernames));
  }
  assert.deepEqual(customers.map(row => row.status_tagihan), ['merah', 'hijau']);
});

test('cron evaluates every bill even if its selected router is invalid and pings once per router', async () => {
  const bills = [1, 2, 2].map((router, index) => ({
    id_tagihan: index + 1, id_pelanggan: index + 1, id_router: router, pppoe_username: 'shared',
    due_date: '2020-01-01', status: 'belum_bayar', status_tagihan: 'hijau'
  }));
  const selected = [];
  const isolated = [];
  const updates = [];
  const service = load('services/cronService.js', {
    'node-cron': {},
    '../models/Tagihan': { getUnpaid(callback) { callback(null, bills); }, updateStatus(id, status, callback) { callback(null); } },
    '../models/Pelanggan': { update(id, data, callback) { updates.push({ id, data: copy(data) }); callback(null); } },
    '../models/ReminderLog': {}, './emailService': {}, './pdfService': {}, './billingService': {},
    './socket': { broadcast() {} }, '../utils/logger': logger,
    './mikrotik': { async forRouter(id) {
      selected.push(id);
      if (id === 1) throw new Error('disabled');
      return { async ping() { return { online: true }; }, async disableSecret(username) { isolated.push({ id, username }); return { success: true }; } };
    } }
  });
  let reminders = 0;
  service.processEmailReminder = async () => { reminders += 1; };
  await service.checkAndSendReminders();
  assert.deepEqual(selected, [1, 2]);
  assert.deepEqual(isolated, [{ id: 2, username: 'shared' }, { id: 2, username: 'shared' }]);
  assert.deepEqual(updates.map(row => row.data), [{ status_tagihan: 'merah' }, { status_tagihan: 'merah' }, { status_tagihan: 'merah' }]);
  assert.equal(reminders, 3);
});

function routeHarness(relativePath, mocks) {
  const middleware = [];
  const routes = [];
  const router = { use(handler) { middleware.push(handler); } };
  for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const upload = () => ({ single() { return (req, res, next) => next(); } });
  upload.diskStorage = config => config;
  load(relativePath, {
    express: { Router() { return router; } },
    '../middleware/auth': (req, res, next) => next(),
    multer: upload, path,
    fs: { existsSync() { return true; }, unlink(file, callback) { callback(null); } },
    bcryptjs: { async hash() { return 'hash'; } },
    ...mocks
  });
  return async (method, url, input = {}) => {
    const route = routes.find(row => row.method === method && row.url === url);
    assert.ok(route, `${method} ${url} exists`);
    const req = { path: url, body: {}, query: {}, params: {}, adminRole: 'admin', ...input };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = copy(data); this.finished = true; return this; } };
    const handlers = [...middleware, ...route.handlers];
    async function run(index) {
      if (res.finished || index >= handlers.length) return;
      let next;
      await handlers[index](req, res, () => { next = run(index + 1); });
      await next;
    }
    await run(0);
    return res;
  };
}

test('MikroTik routes reject customer roles, honor body/query IDs, redact secrets, and keep health independent', async () => {
  const selected = [];
  const filters = [];
  const actions = [];
  const request = routeHarness('routes/mikrotik.js', {
    '../services/mikrotik': {
      async forRouter(id) {
        selected.push(id);
        if (Number(id) !== 2) throw new Error('Invalid router');
        return {
          id_router: 2,
          async getSecrets() { return [{ name: 'shared', password: 'private', pass: 'private' }]; },
          async getActiveConnections() { return [{ name: 'shared' }]; },
          async disableSecret(username) { actions.push({ id: 2, username }); return { success: true }; }
        };
      },
      async getServerHealth() { return { db_status: 'connected' }; }
    },
    '../models/Pelanggan': { getAll(callback, options) { filters.push(copy(options)); callback(null, [{ id_router: 1, pppoe_username: 'shared' }]); } },
    '../config/db': { query(sql, params, callback) { assert.match(sql, /id_router = \?/); assert.deepEqual(copy(params), [2]); callback(null, []); } }
  });
  const forbidden = await request('get', '/secrets', { adminRole: 'customer', query: { id_router: 2 } });
  assert.equal(forbidden.statusCode, 403);
  assert.deepEqual(selected, []);
  const secrets = await request('get', '/secrets', { query: { id_router: '2' } });
  assert.deepEqual(secrets.body.data, [{ name: 'shared', id_router: 2, is_registered: false }]);
  const unregistered = await request('get', '/unregistered', { query: { id_router: 2 } });
  assert.deepEqual(unregistered.body.data, [{ name: 'shared' }]);
  assert.deepEqual(filters, [{ id_router: 2 }]);
  const isolate = await request('post', '/isolir', { query: { id_router: 1 }, body: { id_router: 2, username: 'shared' } });
  assert.equal(isolate.body.success, true);
  assert.deepEqual(actions, [{ id: 2, username: 'shared' }]);
  const invalid = await request('post', '/isolir', { body: { id_router: 999, username: 'shared' } });
  assert.equal(invalid.statusCode, 400);
  const beforeHealth = selected.length;
  assert.equal((await request('get', '/server-health', { query: { id_router: 999 } })).body.data.db_status, 'connected');
  assert.equal(selected.length, beforeHealth);
});

function customerHarness({ duplicate = false, invalid = false } = {}) {
  const selected = [];
  const validations = [];
  const duplicates = [];
  const updates = [];
  const created = [];
  const isolated = [];
  const events = [];
  const queries = [];
  const request = routeHarness('routes/pelanggan.js', {
    '../models/Router': { async initialize() {} },
    '../models/Pelanggan': {
      getById(id, callback) { callback(null, { id_pelanggan: 7, id_router: 1, pppoe_username: 'shared', pppoe_status: 'active', status_tagihan: 'merah' }); },
      findByPppoe(username, id, callback) { duplicates.push({ username, id }); callback(null, duplicate ? { id_pelanggan: 88, id_router: id } : null); },
      findByNoHp(value, callback) { callback(null, null); },
      findByEmail(value, callback) { callback(null, null); },
      create(data, callback) { created.push(copy(data)); callback(null, { ...data, id_pelanggan: 8 }); },
      update(id, data, callback) { updates.push({ id, data: copy(data) }); callback(null, { affectedRows: 1 }); }
    },
    '../services/mikrotik': { async forRouter(id) {
      selected.push(id);
      if (invalid) throw new Error('Router disabled');
      return {
        id_router: id == null ? 1 : Number(id),
        async validateSecret(username) { validations.push({ id: Number(id), username }); return true; },
        async disableSecret(username) { isolated.push({ id: Number(id), username }); return { success: true }; }
      };
    } },
    '../config/db': { query(sql, params, callback) { queries.push({ sql, params: copy(params) }); assert.match(sql, /WHERE nik =/); callback(null, []); } },
    '../services/cronService': { checkAndSendReminders() {} },
    '../services/socket': { broadcast(event, data) { events.push({ event, data: copy(data) }); } },
    '../services/emailService': { async sendPppoeActivatedEmail() {} },
    '../services/configService': { get() { return 'http://example.test'; } }
  });
  return { request, selected, validations, duplicates, updates, created, isolated, events, queries };
}

test('customer reassignment validates the new router even with an unchanged username, resets status, and never invents telemetry', async () => {
  const harness = customerHarness();
  const response = await harness.request('put', '/:id', { params: { id: '7' }, body: { id_router: '2' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id_router, 2);
  assert.deepEqual(harness.duplicates, [{ username: 'shared', id: 2 }]);
  assert.deepEqual(harness.validations, [{ username: 'shared', id: 2 }]);
  assert.deepEqual(harness.updates, [{ id: '7', data: { id_router: 2, pppoe_status: 'unknown' } }]);
  assert.deepEqual(harness.isolated, [{ id: 2, username: 'shared' }]);
  assert.equal(harness.queries.length, 0);
  for (const event of harness.events) {
    assert.equal(event.data.id_router, 2);
    if (event.data.pppoe_status) assert.equal(event.data.pppoe_status, 'unknown');
  }
});

for (const scenario of [{ duplicate: true }, { invalid: true }]) {
  test(`customer reassignment rejects ${scenario.duplicate ? 'same-router duplicates' : 'disabled routers'} before writes`, async () => {
    const harness = customerHarness(scenario);
    const response = await harness.request('put', '/:id', { params: { id: '7' }, body: { id_router: 2 } });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(harness.updates, []);
    assert.deepEqual(harness.isolated, []);
    assert.equal(harness.queries.length, 0);
  });
}

for (const connected of [true, false]) {
  test(`customer creation ${connected ? 'persists selected router and checks its secret' : 'permits unassigned pending customers'}`, async () => {
    const harness = customerHarness();
    const response = await harness.request('post', '/', {
      body: { nama: 'Customer', no_hp: '08123456789', email: 'test@example.test', password: 'abcdef', nik: '1234567890123456', ...(connected ? { id_router: 2, pppoe_username: 'shared' } : {}) },
      file: { filename: 'fake.jpg', path: 'not-written.jpg' }
    });
    assert.equal(response.statusCode, 201);
    assert.equal(harness.created[0].id_router, connected ? 2 : null);
    assert.deepEqual(harness.selected, connected ? [2] : []);
    assert.deepEqual(harness.duplicates, connected ? [{ username: 'shared', id: 2 }] : []);
  });
}

test('registration approval scopes both duplicate checks and persists the selected router without changing the bill', async () => {
  const queries = [];
  const validations = [];
  let committed = false;
  let released = false;
  const connection = {
    beginTransaction(callback) { callback(null); },
    query(sql, params, callback) {
      queries.push({ sql, params: copy(params) });
      if (/FOR UPDATE/.test(sql)) return callback(null, [{ id_pelanggan: 7, nama: 'Pending', paket: 'Basic' }]);
      if (/SELECT harga/.test(sql)) return callback(null, [{ harga: 150000 }]);
      if (/SELECT id_pelanggan/.test(sql)) { assert.match(sql, /id_router = \?/); assert.deepEqual(copy(params), ['shared', 2, 7]); return callback(null, []); }
      callback(null, { affectedRows: 1 });
    },
    commit(callback) { committed = true; callback(null); },
    release() { released = true; },
    rollback() { assert.fail('Should not rollback successful approval'); }
  };
  const request = routeHarness('routes/pelanggan.js', {
    '../models/Router': { async initialize() {} },
    '../models/Pelanggan': {},
    '../services/mikrotik': { async forRouter(id) { assert.equal(id, 2); return { id_router: 2, async validateSecret(username) { validations.push(username); return true; } }; } },
    '../services/socket': { broadcast() {} },
    '../config/db': {
      query(sql, params, callback) {
        queries.push({ sql, params: copy(params) });
        if (/LIKE 'REG-%'/.test(sql)) return callback(null, [{ id_pelanggan: 7 }]);
        assert.match(sql, /id_router = \?/);
        assert.deepEqual(copy(params), ['shared', 2]);
        callback(null, []);
      },
      getConnection(callback) { callback(null, connection); }
    }
  });
  const response = await request('post', '/registrasi/:id/approve', { params: { id: '7' }, body: { id_router: 2, pppoe_username: 'shared', due_date: '2026-12-01' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id_router, 2);
  assert.deepEqual(validations, ['shared']);
  const customerWrite = queries.find(row => /UPDATE pelanggan/.test(row.sql));
  assert.match(customerWrite.sql, /id_router = \?/);
  assert.match(customerWrite.sql, /pppoe_status = 'unknown'/);
  assert.deepEqual(customerWrite.params, ['shared', 2, '2026-12-01', 7]);
  assert.deepEqual(queries.find(row => /INSERT INTO tagihan/.test(row.sql)).params, [7, '2026-12', 150000, '2026-12-01']);
  assert.equal(committed, true);
  assert.equal(released, true);
});

test('customer and bill models await registry initialization and use router-scoped SQL', async () => {
  let initialized = false;
  const queries = [];
  const registry = {
    async initialize() { await Promise.resolve(); initialized = true; },
    async list() { return [{ id_router: 2, nama_router: 'Two' }]; },
    async getDefaultId() { return 1; }
  };
  const db = { query(sql, params, callback) {
    assert.equal(initialized, true);
    if (typeof params === 'function') { callback = params; params = []; }
    queries.push({ sql, params: copy(params) });
    callback(null, /UPDATE/.test(sql) ? { affectedRows: 1 } : [{ id_pelanggan: 7, id_router: 2 }]);
  } };
  const customers = load('models/Pelanggan.js', { '../config/db': db, './Router': registry });
  const bills = load('models/Tagihan.js', { '../config/db': db, './Router': registry });
  const rows = await new Promise((resolve, reject) => customers.getAll((err, value) => err ? reject(err) : resolve(value), { id_router: 2 }));
  assert.equal(rows[0].nama_router, 'Two');
  assert.match(queries[0].sql, /p.id_router = \?/);
  assert.deepEqual(queries[0].params, [2]);
  await new Promise((resolve, reject) => customers.findByPppoe('shared', 2, err => err ? reject(err) : resolve()));
  assert.deepEqual(queries.at(-1).params, ['shared', 2]);
  await new Promise((resolve, reject) => customers.update(7, { pppoe_status: 'active' }, err => err ? reject(err) : resolve(), { id_router: 2 }));
  assert.match(queries.at(-1).sql, /WHERE id_pelanggan = \? AND id_router = \?/);
  assert.deepEqual(queries.at(-1).params, ['active', 7, 2]);
  await new Promise((resolve, reject) => bills.getUnpaid(err => err ? reject(err) : resolve()));
  assert.match(queries.at(-1).sql, /p.id_router/);
});

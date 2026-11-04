const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const logger = {
  info() {},
  warn() {},
  error() {},
  once() {},
  box() {},
  stateChange(key, value, callback) { callback(value); }
};

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadService(filename, mocks) {
  const fullPath = path.join(__dirname, '..', 'services', filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(fullPath, 'utf8'), {
    module,
    console,
    Date,
    process: { env: {} },
    require(name) {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    }
  }, { filename: fullPath });
  return module.exports;
}

function createSocket(events) {
  return {
    broadcast(event, data) { events.push({ event, data: snapshot(data) }); }
  };
}

const registry = {
  async initialize() {},
  async list() { return [{ id_router: 1, nama_router: 'Router Utama' }]; }
};

const cronCases = [
  { name: 'overdue with successful isolir', days: -30, online: true, isolir: 'success', expected: 'merah' },
  { name: 'overdue with unsuccessful isolir', days: -30, online: true, isolir: 'failure', expected: 'merah' },
  { name: 'overdue with isolir error', days: -30, online: true, isolir: 'error', expected: 'merah' },
  { name: 'overdue with offline router', days: -30, online: false, expected: 'merah' },
  { name: 'upcoming bill', days: 2, online: true, expected: 'kuning' },
  { name: 'future bill', days: 30, online: true, expected: 'hijau' },
  { name: 'unchanged overdue status still isolates', days: -30, online: true, isolir: 'success', expected: 'merah', unchanged: true }
];

for (const scenario of cronCases) {
  test(`cron updates billing only: ${scenario.name}`, async () => {
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + scenario.days);
    const bill = {
      id_tagihan: 11,
      id_pelanggan: 7,
      id_router: 1,
      nama: 'Customer',
      due_date: dueDate.toISOString(),
      status: 'belum_bayar',
      status_tagihan: scenario.unchanged ? scenario.expected : 'kuning',
      pppoe_username: 'customer',
      pppoe_status: 'active'
    };
    if (bill.status_tagihan === scenario.expected && !scenario.unchanged) {
      bill.status_tagihan = 'merah';
    }
    const events = [];
    const writes = [];
    const billStatuses = [];
    const isolated = [];
    const reminders = [];
    let evaluation;
    const service = loadService('cronService.js', {
      'node-cron': {},
      '../models/Tagihan': {
        getUnpaid(callback) { evaluation = callback(null, [bill]); },
        updateStatus(id, status, callback) {
          billStatuses.push({ id, status });
          callback(null);
        }
      },
      '../models/Pelanggan': {
        update(id, data, callback) {
          writes.push({ id, data: snapshot(data) });
          callback(null);
        }
      },
      '../models/ReminderLog': {},
      './emailService': {},
      './pdfService': {},
      './socket': createSocket(events),
      './mikrotik': {
        async forRouter(id) { assert.equal(id, 1); return this; },
        async ping() { return { online: scenario.online }; },
        async disableSecret(username) {
          isolated.push(username);
          if (scenario.isolir === 'error') throw new Error('Router write failed');
          return { success: scenario.isolir === 'success' };
        }
      },
      './billingService': {},
      '../utils/logger': logger
    });
    service.processEmailReminder = async (currentBill, days) => {
      reminders.push({ id: currentBill.id_tagihan, days });
    };

    await service.checkAndSendReminders();
    // The production method uses an async callback rather than returning its work.
    await evaluation;

    assert.deepEqual(writes, scenario.unchanged ? [] : [
      { id: 7, data: { status_tagihan: scenario.expected } }
    ]);
    assert.deepEqual(events, scenario.unchanged ? [] : [
      { event: 'pelanggan_updated', data: { id_pelanggan: 7, id_router: 1, status_tagihan: scenario.expected } }
    ]);
    assert.equal(bill.pppoe_status, 'active');
    assert.deepEqual(isolated, scenario.days < 0 && scenario.online ? ['customer'] : []);
    assert.deepEqual(billStatuses, scenario.days < 0 ? [{ id: 11, status: 'terlambat' }] : []);
    assert.equal(reminders.length, scenario.days <= 3 ? 1 : 0);
  });
}

for (const outcome of ['success', 'failure', 'error', 'no username']) {
  test(`settlement broadcasts billing only after enableSecret: ${outcome}`, async () => {
    const events = [];
    const queries = [];
    const enabled = [];
    const bill = {
      id_tagihan: 11,
      id_pelanggan: 7,
      id_router: 1,
      tagihan_status: 'terlambat',
      nama: 'Customer',
      pppoe_username: outcome === 'no username' ? null : 'customer',
      periode: '2026-01',
      nominal: 150000,
      due_date: '2026-01-15',
      cust_status: 'merah'
    };
    let committed = false;
    let released = false;
    const connection = {
      beginTransaction(callback) { callback(null); },
      query(sql, params, callback) {
        queries.push({ sql, params: snapshot(params) });
        if (/FOR UPDATE/.test(sql)) return callback(null, [bill]);
        if (/SELECT id_tagihan FROM tagihan/.test(sql)) return callback(null, [{ id_tagihan: 12 }]);
        assert.match(sql.trim(), /^(UPDATE (pembayaran|tagihan|pelanggan)|INSERT INTO notifikasi)/);
        callback(null, { affectedRows: 1 });
      },
      commit(callback) { committed = true; callback(null); },
      release() { released = true; },
      rollback() { assert.fail('Settlement should not roll back'); }
    };
    const service = loadService('billingService.js', {
      '../models/Router': registry,
      '../config/db': { getConnection(callback) { callback(null, connection); } },
      './mikrotik': {
        async forRouter(id) { assert.equal(id, 1); return this; },
        async enableSecret(username) {
          assert.equal(committed, true);
          assert.equal(released, true);
          enabled.push(username);
          if (outcome === 'error') throw new Error('Router unavailable');
          return { success: outcome === 'success' };
        }
      },
      './emailService': {},
      './pdfService': {},
      './socket': createSocket(events),
      '../models/Pelanggan': {},
      '../utils/logger': logger
    });

    const result = await service.settlePayment({ id_tagihan: 11, id_pembayaran: 21 });

    assert.equal(result.success, true);
    assert.equal(committed, true);
    assert.equal(released, true);
    assert.deepEqual(enabled, outcome === 'no username' ? [] : ['customer']);
    assert.deepEqual(events.filter(item => item.event === 'pelanggan_updated'), [{
      event: 'pelanggan_updated',
      data: { id_pelanggan: 7, id_router: 1, status_tagihan: 'hijau', due_date: result.data.new_due_date }
    }]);
    assert.equal(events.filter(item => item.event === 'pembayaran_masuk').length, 1);
    assert.equal(queries.some(query => /pppoe_status/i.test(query.sql)), false);
    assert.equal(queries.filter(query => /UPDATE pelanggan/.test(query.sql)).length, 1);
  });
}

function createSync(customers, router) {
  customers.forEach(customer => { customer.id_router = 1; });
  const events = [];
  const writes = [];
  let reads = 0;
  const service = loadService('syncService.js', {
    '../models/Router': registry,
    './mikrotik': {
      async forRouter(id) { assert.equal(id, 1); return router; }
    },
    '../models/Pelanggan': {
      getAll(callback, options) { assert.equal(options.id_router, 1); reads += 1; callback(null, customers); },
      update(id, data, callback, options) {
        assert.equal(options.id_router, 1);
        writes.push({ id, data: snapshot(data) });
        Object.assign(customers.find(customer => customer.id_pelanggan === id), data);
        callback(null);
      }
    },
    './socket': createSocket(events),
    '../utils/logger': logger
  });
  return { service, events, writes, get reads() { return reads; } };
}

function lastSummary(events) {
  return events.filter(item => item.event === 'pppoe_summary').at(-1).data;
}

test('sync publishes actual raw session names, including unchanged active customers', async () => {
  const customers = [
    { id_pelanggan: 1, pppoe_username: 'OVERDUE.User', pppoe_status: 'active', status_tagihan: 'merah' },
    { id_pelanggan: 2, pppoe_username: 'paid-but-offline', pppoe_status: 'active', status_tagihan: 'hijau' },
    { id_pelanggan: 3, pppoe_username: ' newly-online ', pppoe_status: 'inactive', status_tagihan: 'kuning' },
    { id_pelanggan: 4, pppoe_username: null, pppoe_status: 'unknown', status_tagihan: 'hijau' }
  ];
  const sessions = [
    { name: 'OVERDUE.User', address: '192.0.2.1' },
    { name: ' newly-online ', address: '192.0.2.2' },
    { name: 'Unregistered@isp', address: '192.0.2.3' }
  ];
  const beforeBilling = customers.map(customer => customer.status_tagihan);
  const harness = createSync(customers, {
    async ping() { return { online: true }; },
    async getActiveConnections() { return sessions; }
  });

  await harness.service.sync();

  assert.deepEqual(harness.writes, [
    { id: 2, data: { pppoe_status: 'inactive' } },
    { id: 3, data: { pppoe_status: 'active' } }
  ]);
  const expectedSummary = {
    id_router: 1,
    telemetry_available: true,
    active_usernames: ['OVERDUE.User', ' newly-online ', 'Unregistered@isp'],
    active_count: 3,
    unregistered_count: 1,
    unregistered_list: [sessions[2]]
  };
  assert.deepEqual(lastSummary(harness.events), expectedSummary);
  assert.deepEqual(customers.map(customer => customer.status_tagihan), beforeBilling);
  assert.deepEqual(harness.events.filter(item => item.event === 'pelanggan_updated'), [
    { event: 'pelanggan_updated', data: { id_pelanggan: 2, id_router: 1, pppoe_status: 'inactive', telemetry_available: true, active_usernames: sessions.map(session => session.name) } },
    { event: 'pelanggan_updated', data: { id_pelanggan: 3, id_router: 1, pppoe_status: 'active', telemetry_available: true, active_usernames: sessions.map(session => session.name) } }
  ]);

  harness.writes.length = 0;
  harness.events.length = 0;
  await harness.service.sync();
  assert.deepEqual(harness.writes, []);
  assert.deepEqual(lastSummary(harness.events), expectedSummary);
});

test('reachable router with no sessions is available telemetry and can mark inactive', async () => {
  const customers = [{ id_pelanggan: 1, pppoe_username: 'customer', pppoe_status: 'active', status_tagihan: 'hijau' }];
  const harness = createSync(customers, {
    async ping() { return { online: true }; },
    async getActiveConnections() { return []; }
  });

  await harness.service.sync();

  assert.deepEqual(lastSummary(harness.events), {
    id_router: 1,
    telemetry_available: true,
    active_usernames: [],
    active_count: 0,
    unregistered_count: 0,
    unregistered_list: []
  });
  assert.deepEqual(harness.writes, [{ id: 1, data: { pppoe_status: 'inactive' } }]);
  assert.equal(customers[0].status_tagihan, 'hijau');
});

for (const failure of ['offline', 'session error', 'ping error']) {
  test(`sync clears stale telemetry without DB changes on ${failure}, then recovers`, async () => {
    const customers = [{ id_pelanggan: 1, pppoe_username: 'customer', pppoe_status: 'active', status_tagihan: 'merah' }];
    let failing = false;
    let sessionReads = 0;
    const harness = createSync(customers, {
      async ping() {
        if (failing && failure === 'ping error') throw new Error('Ping failed');
        return { online: !(failing && failure === 'offline'), error: 'Router unreachable' };
      },
      async getActiveConnections() {
        sessionReads += 1;
        if (failing) throw new Error('Session read failed');
        return [{ name: 'customer' }];
      }
    });

    await harness.service.sync();
    assert.deepEqual(lastSummary(harness.events).active_usernames, ['customer']);
    const before = snapshot(customers);
    const beforeReads = harness.reads;
    harness.events.length = 0;
    failing = true;

    await harness.service.sync();

    assert.deepEqual(lastSummary(harness.events), {
      id_router: 1,
      telemetry_available: false,
      active_usernames: [],
      active_count: 0,
      unregistered_count: 0,
      unregistered_list: []
    });
    assert.deepEqual(customers, before);
    assert.deepEqual(harness.writes, []);
    assert.equal(harness.reads, beforeReads);
    assert.equal(sessionReads, failure === 'session error' ? 2 : 1);
    assert.deepEqual(harness.events.filter(item => item.event === 'pelanggan_updated'), []);

    failing = false;
    await harness.service.sync();
    assert.equal(lastSummary(harness.events).telemetry_available, true);
    assert.deepEqual(lastSummary(harness.events).active_usernames, ['customer']);
    assert.deepEqual(customers, before);
  });
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCronService(mocks) {
  const filename = path.join(__dirname, '..', 'services', 'cronService.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    console,
    Date,
    process: { env: {} },
    require(name) {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    }
  }, { filename });
  return module.exports;
}

function createBill(overrides = {}) {
  return {
    id_tagihan: 1,
    id_pelanggan: 1,
    nama: 'Pelanggan Uji',
    email: 'pelanggan@example.test',
    periode: '2026-11',
    nominal: 150000,
    status: 'belum_bayar',
    due_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides
  };
}

function createService(bills, sentToday = false) {
  const sentEmails = [];
  const loggedStatuses = [];
  const mocks = {
    'node-cron': { schedule() {} },
    '../models/Tagihan': {
      getUnpaid(callback) { callback(null, bills); }
    },
    '../models/Pelanggan': {},
    '../models/ReminderLog': {
      hasBeenSentToday(id, callback) { callback(null, sentToday); },
      create(data, callback) {
        loggedStatuses.push(data.status_kirim);
        callback(null);
      }
    },
    './emailService': {
      async sendReminderEmail(email) {
        sentEmails.push(email);
        return { success: true };
      }
    },
    './pdfService': { async generateInvoicePdf() { return Buffer.from('pdf'); } },
    './socket': {},
    './mikrotik': {},
    './billingService': {},
    './configService': {},
    '../utils/logger': { error() {}, success() {} }
  };
  return { service: loadCronService(mocks), sentEmails, loggedStatuses };
}

test('manual send attempts unpaid invoices even when they are outside the scheduled window', async () => {
  const { service, sentEmails, loggedStatuses } = createService([createBill()]);
  const result = await service.sendInvoicesNow();

  assert.equal(result.total, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(sentEmails, ['pelanggan@example.test']);
  assert.deepEqual(loggedStatuses, ['terkirim']);
});

test('manual send avoids duplicate emails and skips customers without email', async () => {
  const { service, sentEmails, loggedStatuses } = createService([
    createBill(),
    createBill({ id_tagihan: 2, id_pelanggan: 2, email: '' })
  ], true);
  const result = await service.sendInvoicesNow();

  assert.equal(result.skipped, 2);
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(sentEmails, []);
  assert.deepEqual(loggedStatuses, []);
});

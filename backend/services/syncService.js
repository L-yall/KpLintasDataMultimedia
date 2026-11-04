var MikrotikService = require('./mikrotik');
var Router = require('../models/Router');
var Pelanggan = require('../models/Pelanggan');
var SocketService = require('./socket');
var logger = require('../utils/logger');

var syncInterval = null;
var startupTimer = null;
var syncingRouters = new Map();

async function syncRouter(router) {
  var id = router.id_router;
  var key = String(id);
  if (syncingRouters.has(key)) return syncingRouters.get(key);
  var task = (async function() {
    var ping = { online: false };
    try {
      var client = await MikrotikService.forRouter(id);
      ping = await client.ping();
      if (!ping.online) throw new Error(ping.error || 'Router offline');
      var activeConns = await client.getActiveConnections();
      var activeUsernames = new Set(activeConns.map(function(conn) { return conn.name; }).filter(function(name) { return typeof name === 'string'; }));
      var names = Array.from(activeUsernames);
      var customers = await new Promise(function(resolve, reject) {
        Pelanggan.getAll(function(err, rows) { err ? reject(err) : resolve(rows); }, { id_router: id });
      });
      // Keep the ownership check even when a model adapter ignores the SQL filter.
      customers = customers.filter(function(customer) { return String(customer.id_router) === key; });
      var registered = new Set(customers.map(function(customer) { return customer.pppoe_username; }).filter(Boolean));
      await Promise.all(customers.map(function(customer) {
        if (!customer.pppoe_username) return;
        var status = activeUsernames.has(customer.pppoe_username) ? 'active' : 'inactive';
        if (status === customer.pppoe_status) return;
        return new Promise(function(resolve) {
          // Guard against a reassignment while this router's telemetry was in flight.
          Pelanggan.update(customer.id_pelanggan, { pppoe_status: status }, function(err, result) {
            if (err) {
              logger.error('SYNC', `Router #${id}: gagal update PPPoE ${customer.nama}: ${err.message}`);
            } else if (!result || result.affectedRows !== 0) {
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: customer.id_pelanggan,
                id_router: id,
                pppoe_status: status,
                telemetry_available: true,
                active_usernames: names
              });
            }
            resolve();
          }, { id_router: id });
        });
      }));
      var unregistered = activeConns.filter(function(conn) { return !registered.has(conn.name); });
      var summary = {
        id_router: id,
        telemetry_available: true,
        active_usernames: names,
        active_count: activeConns.length,
        unregistered_count: unregistered.length,
        unregistered_list: unregistered
      };
      SocketService.broadcast('mikrotik_ping', { ...ping, id_router: id, telemetry_available: true, active_usernames: names });
      SocketService.broadcast('pppoe_summary', summary);
      logger.stateChange('mikrotik_status_' + key, 'online', function() {
        logger.info('SYNC', `Router #${id} (${router.nama_router || 'MikroTik'}) online.`);
      });
      return summary;
    } catch (err) {
      var unavailable = {
        id_router: id,
        telemetry_available: false,
        active_usernames: [],
        active_count: 0,
        unregistered_count: 0,
        unregistered_list: []
      };
      SocketService.broadcast('mikrotik_ping', { ...ping, id_router: id, error: err.message, telemetry_available: false, active_usernames: [] });
      SocketService.broadcast('pppoe_summary', unavailable);
      logger.once('sync_exec_err_' + key, 'error', 'SYNC', `Router #${id}: ${err.message}`);
      return unavailable;
    }
  })();
  syncingRouters.set(key, task);
  try {
    return await task;
  } finally {
    syncingRouters.delete(key);
  }
}

var SyncService = {
  start: function() {
    if (syncInterval) return;
    logger.info('SYNC', 'Background PPPoE Sync aktif (interval: 30s, per-router)');
    startupTimer = setTimeout(function() { SyncService.sync(); }, 1500);
    syncInterval = setInterval(function() { SyncService.sync(); }, 30000);
  },

  stop: function() {
    if (startupTimer) clearTimeout(startupTimer);
    startupTimer = null;
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = null;
  },

  // Missing ID is the scheduler's all-active-routers mode. HTTP callers pass the
  // already selected facade ID, including the legacy default when omitted.
  sync: async function(idRouter) {
    try {
      await Router.initialize();
      var routers;
      if (idRouter !== undefined && idRouter !== null) {
        var client = await MikrotikService.forRouter(idRouter);
        routers = [{ id_router: client.id_router, nama_router: client.nama_router }];
      } else {
        routers = await Router.list({ activeOnly: true });
      }
      return await Promise.all(routers.map(syncRouter));
    } catch (err) {
      if (idRouter !== undefined && idRouter !== null) throw err;
      logger.once('sync_registry_err', 'error', 'SYNC', `Gagal memuat router: ${err.message}`);
      return [];
    }
  }
};

module.exports = SyncService;

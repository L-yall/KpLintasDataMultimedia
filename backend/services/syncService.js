var MikrotikService = require('./mikrotik');
var Pelanggan = require('../models/Pelanggan');
var SocketService = require('./socket');
var logger = require('../utils/logger');

var syncInterval = null;
var isSyncing = false;

var SyncService = {
  start: function() {
    if (syncInterval) return;

    logger.info('SYNC', 'Background PPPoE Sync aktif (interval: 30s)');
    
    // Beri jeda 1.5 detik agar server HTTP selesai binding port sebelum sync pertama
    setTimeout(() => {
      this.sync();
    }, 1500);

    syncInterval = setInterval(() => {
      this.sync();
    }, 30000);
  },

  stop: function() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      logger.info('SYNC', 'Background PPPoE Sync dihentikan.');
    }
  },

  sync: async function() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      // 1. Check router health
      var pingRes = await MikrotikService.ping();
      SocketService.broadcast('mikrotik_ping', pingRes);
      
      // Catat log HANYA saat ada perubahan status router (mencegah spam 30s)
      var statusKey = pingRes.online 
        ? 'online' 
        : ((pingRes.error && pingRes.error.includes('belum dikonfigurasi')) ? 'unconfigured' : 'offline');

      logger.stateChange('mikrotik_status', statusKey, (current) => {
        if (current === 'online') {
          logger.box({
            title: 'MIKROTIK ROUTER SERVICE',
            subtitle: 'RouterOS API & PPPoE Telemetry',
            color: 'cyan',
            items: [
              { label: 'Status Router', value: 'Terhubung (Online)', color: 'green' },
              { label: 'Perangkat', value: `${pingRes.board || 'MikroTik'} (${pingRes.version || 'RouterOS'})` },
              { label: 'Uptime', value: pingRes.uptime || '-' },
              { label: 'Auto-Sync', value: 'PPPoE Real-Time Sync Aktif (30s)' }
            ]
          });
        } else if (current === 'unconfigured') {
          logger.box({
            title: 'MIKROTIK ROUTER SERVICE',
            subtitle: 'RouterOS API & PPPoE Telemetry',
            color: 'yellow',
            items: [
              { label: 'Status Router', value: 'Belum Dikonfigurasi', color: 'yellow' },
              { label: 'Auto-Sync', value: 'PPPoE Sync Dijeda (Standby)' },
              { label: 'Petunjuk', value: 'Konfigurasi di Menu Pengaturan Admin' }
            ]
          });
        } else {
          logger.box({
            title: 'MIKROTIK ROUTER SERVICE',
            subtitle: 'RouterOS API & PPPoE Telemetry',
            color: 'yellow',
            items: [
              { label: 'Status Router', value: 'Offline / Tidak Terjangkau', color: 'yellow' },
              { label: 'Keterangan', value: pingRes.error || 'Connection Timeout' },
              { label: 'Auto-Sync', value: 'Dijeda Sampai Router Terhubung' }
            ]
          });
        }
      });

      if (!pingRes.online) {
        return;
      }

      // 2. Fetch active connections from Mikrotik
      var activeConns = await MikrotikService.getActiveConnections();
      var activeUsernames = new Set(activeConns.map(conn => conn.name));

      // 3. Fetch all customers from DB
      await new Promise((resolve) => {
        Pelanggan.getAll(function(err, customers) {
          if (err) {
            logger.once('sync_cust_err', 'error', 'SYNC', `Gagal mengambil data pelanggan: ${err.message}`);
            resolve();
            return;
          }

          var registeredPppoe = new Set();
          var updatePromises = [];

          customers.forEach(function(cust) {
            if (!cust.pppoe_username) return;
            
            registeredPppoe.add(cust.pppoe_username);
            var isCurrentlyActive = activeUsernames.has(cust.pppoe_username);
            var newStatus = isCurrentlyActive ? 'active' : 'inactive';

            // If status changed in DB
            if (cust.pppoe_status !== newStatus) {
              var updatePromise = new Promise((resolveUpdate) => {
                Pelanggan.update(cust.id_pelanggan, { pppoe_status: newStatus }, function(updateErr) {
                  if (updateErr) {
                    logger.error('SYNC', `Gagal update status PPPoE ${cust.nama}: ${updateErr.message}`);
                  } else {
                    logger.info('SYNC', `Status PPPoE '${cust.pppoe_username}' (${cust.nama}) -> ${newStatus}`);
                    
                    // Broadcast change via Socket.IO
                    SocketService.broadcast('pelanggan_updated', {
                      id_pelanggan: cust.id_pelanggan,
                      pppoe_status: newStatus
                    });
                  }
                  resolveUpdate();
                });
              });
              updatePromises.push(updatePromise);
            }
          });

          // Wait for all database updates to complete before wrapping up this sync cycle
          Promise.all(updatePromises).then(() => {
            // 4. Find unregistered PPPoE active connections (Tahap 2)
            var unregistered = activeConns.filter(function(conn) {
              return !registeredPppoe.has(conn.name);
            });

            // Log hanya jika terjadi perubahan jumlah unregistered connection
            logger.stateChange('unregistered_pppoe_count', unregistered.length, (count) => {
              if (count > 0) {
                logger.warn('SYNC', `Terdeteksi ${count} koneksi PPPoE aktif router yang belum terdaftar di database.`);
              }
            });

            // Broadcast current active status summary to frontend
            SocketService.broadcast('pppoe_summary', {
              active_count: activeConns.length,
              unregistered_count: unregistered.length,
              unregistered_list: unregistered
            });

            resolve();
          });
        });
      });

    } catch (err) {
      logger.once('sync_exec_err', 'error', 'SYNC', `Error pada eksekusi sync: ${err.message}`);
    } finally {
      isSyncing = false;
    }
  }
};

module.exports = SyncService;

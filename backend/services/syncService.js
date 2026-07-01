var MikrotikService = require('./mikrotik');
var Pelanggan = require('../models/Pelanggan');
var SocketService = require('./socket');

var syncInterval = null;

var SyncService = {
  start: function() {
    if (syncInterval) return;

    console.log('Background Sync Service for Mikrotik PPPoE started.');
    
    // Run sync immediately on startup, then every 30 seconds
    this.sync();
    syncInterval = setInterval(() => {
      this.sync();
    }, 30000);
  },

  stop: function() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      console.log('Background Sync Service stopped.');
    }
  },

  sync: async function() {
    try {
      // 1. Check router health
      var pingRes = await MikrotikService.ping();
      SocketService.broadcast('mikrotik_ping', pingRes);
      
      if (!pingRes.online) {
        console.log('Mikrotik is offline. Skipping PPPoE status sync.');
        return;
      }

      // 2. Fetch active connections from Mikrotik
      var activeConns = await MikrotikService.getActiveConnections();
      var activeUsernames = new Set(activeConns.map(conn => conn.name));

      // 3. Fetch all customers from DB
      Pelanggan.getAll(function(err, customers) {
        if (err) {
          console.error('Error fetching customers for sync:', err.message);
          return;
        }

        var registeredPppoe = new Set();

        customers.forEach(function(cust) {
          if (!cust.pppoe_username) return;
          
          registeredPppoe.add(cust.pppoe_username);
          var isCurrentlyActive = activeUsernames.has(cust.pppoe_username);
          var newStatus = isCurrentlyActive ? 'active' : 'inactive';

          // If status changed in DB
          if (cust.pppoe_status !== newStatus) {
            Pelanggan.update(cust.id_pelanggan, { pppoe_status: newStatus }, function(updateErr) {
              if (updateErr) {
                console.error(`Failed to update pppoe status for ${cust.nama}:`, updateErr.message);
                return;
              }
              console.log(`Updated status of PPPoE user "${cust.pppoe_username}" (${cust.nama}) to ${newStatus}`);
              
              // Broadcast change via Socket.IO
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: cust.id_pelanggan,
                pppoe_status: newStatus
              });
            });
          }
        });

        // 4. Find unregistered PPPoE active connections (Tahap 2)
        var unregistered = activeConns.filter(function(conn) {
          return !registeredPppoe.has(conn.name);
        });

        if (unregistered.length > 0) {
          console.log(`Detected ${unregistered.length} unregistered active PPPoE connection(s) on router.`);
        }

        // Broadcast current active status summary to frontend
        SocketService.broadcast('pppoe_summary', {
          active_count: activeConns.length,
          unregistered_count: unregistered.length,
          unregistered_list: unregistered
        });
      });

    } catch (err) {
      console.error('Error in Sync Service execution:', err.message);
    }
  }
};

module.exports = SyncService;

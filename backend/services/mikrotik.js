var RouterOSAPI = require('node-routeros').RouterOSAPI;
var ConfigService = require('./configService');
var logger = require('../utils/logger');

var cachedPing = null;
var lastPingTime = 0;

// Helper function to establish connection, write command, close connection, and return data
async function executeCommand(command, params, customConfig, customTimeout) {
  var host = (customConfig && customConfig.host) || ConfigService.get('MIKROTIK_HOST', process.env.MIKROTIK_HOST);
  var user = (customConfig && customConfig.user) || ConfigService.get('MIKROTIK_USER', process.env.MIKROTIK_USER);
  var pass = (customConfig && customConfig.pass) || ConfigService.get('MIKROTIK_PASS', process.env.MIKROTIK_PASS);
  var port = parseInt((customConfig && customConfig.port) || ConfigService.get('MIKROTIK_PORT', process.env.MIKROTIK_PORT) || '8728', 10);

  if (!host || !user || !pass) {
    throw new Error('Kredensial Mikrotik belum dikonfigurasi.');
  }

  var conn = new RouterOSAPI({
    host: host,
    user: user,
    password: pass,
    port: port,
    timeout: customTimeout || 5
  });

  try {
    await conn.connect();
    var data = params ? await conn.write(command, params) : await conn.write(command);
    await conn.close();
    return data;
  } catch (err) {
    try {
      await conn.close();
    } catch (e) {}
    throw err;
  }
}

var MikrotikService = {
  // Check if router is reachable (ping)
  ping: async function(customConfig, skipCache) {
    // Gunakan cache singkat (10s) jika status router sedang offline/stabil untuk mencegah spam socket timeout
    if (!customConfig && !skipCache && cachedPing && (Date.now() - lastPingTime < 10000)) {
      return cachedPing;
    }

    try {
      // Gunakan timeout cepat (2s) untuk ping agar tidak menghambat sistem jika router offline
      var data = await executeCommand('/system/resource/print', null, customConfig, 2);
      if (data && data.length > 0) {
        var resOnline = {
          online: true,
          version: data[0].version || 'Unknown',
          board: data[0]['board-name'] || 'Mikrotik',
          uptime: data[0].uptime || '00:00:00',
          cpu_load: parseInt(data[0]['cpu-load'] || 0, 10),
          architecture: data[0]['architecture-name'] || 'MMIPS'
        };
        cachedPing = resOnline;
        lastPingTime = Date.now();
        return resOnline;
      }
      var resEmpty = { online: false, error: 'Respon router kosong' };
      cachedPing = resEmpty;
      lastPingTime = Date.now();
      return resEmpty;
    } catch (err) {
      var resErr = {
        online: false,
        error: err.message || 'Koneksi gagal'
      };
      cachedPing = resErr;
      lastPingTime = Date.now();
      return resErr;
    }
  },

  // Get full hardware resources & telemetry (/system/resource)
  getResources: async function() {
    try {
      var data = await executeCommand('/system/resource/print');
      if (data && data.length > 0) {
        var r = data[0];
        var totalMem = parseInt(r['total-memory'] || 0, 10);
        var freeMem = parseInt(r['free-memory'] || 0, 10);
        var usedMem = Math.max(0, totalMem - freeMem);
        var totalHdd = parseInt(r['total-hdd-space'] || 0, 10);
        var freeHdd = parseInt(r['free-hdd-space'] || 0, 10);
        var usedHdd = Math.max(0, totalHdd - freeHdd);

        return {
          online: true,
          board: r['board-name'] || 'MikroTik Router',
          version: r.version || 'RouterOS',
          uptime: r.uptime || '0d 00:00:00',
          cpu: r.cpu || 'MIPS Processor',
          cpu_count: parseInt(r['cpu-count'] || 2, 10),
          cpu_frequency: r['cpu-frequency'] ? r['cpu-frequency'] + ' MHz' : '880 MHz',
          cpu_load: parseInt(r['cpu-load'] || 0, 10),
          total_memory: totalMem,
          free_memory: freeMem,
          used_memory: usedMem,
          memory_percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
          total_hdd: totalHdd,
          free_hdd: freeHdd,
          used_hdd: usedHdd,
          hdd_percent: totalHdd > 0 ? Math.round((usedHdd / totalHdd) * 100) : 0,
          architecture: r['architecture-name'] || 'MMIPS',
          platform: r.platform || 'MikroTik'
        };
      }
      throw new Error('Respon router kosong');
    } catch (err) {
      // Diagnostic fallback data untuk lab testing & showcase NOC
      return {
        online: false,
        is_fallback: true,
        error: err.message,
        board: 'RB750Gr3 (hEX Core Gateway)',
        version: 'RouterOS v7.14.2 (Stable)',
        uptime: '4d 18:42:15',
        cpu: 'MediaTek MT7621A Dual-Core (4 Threads)',
        cpu_count: 4,
        cpu_frequency: '880 MHz',
        cpu_load: 14,
        total_memory: 268435456, // 256 MB
        free_memory: 186646528,  // ~178 MB
        used_memory: 81788928,
        memory_percent: 31,
        total_hdd: 16777216,     // 16 MB NAND
        free_hdd: 9437184,
        used_hdd: 7340032,
        hdd_percent: 44,
        architecture: 'MMIPS 32-bit',
        platform: 'MikroTik RouterOS'
      };
    }
  },

  // Get Interfaces telemetry (/interface/print)
  getInterfaces: async function() {
    try {
      var data = await executeCommand('/interface/print');
      if (Array.isArray(data) && data.length > 0) {
        return {
          data: data.map(function(item) {
          return {
            id: item['.id'],
            name: item.name,
            type: item.type,
            running: item.running === 'true' || item.running === true,
            disabled: item.disabled === 'true' || item.disabled === true,
            mtu: item.mtu || 1500,
            mac_address: item['mac-address'] || '-',
            rx_byte: parseInt(item['rx-byte'] || 0, 10),
            tx_byte: parseInt(item['tx-byte'] || 0, 10),
            rx_packet: parseInt(item['rx-packet'] || 0, 10),
            tx_packet: parseInt(item['tx-packet'] || 0, 10),
            comment: item.comment || ''
          };
          }),
          source: 'router'
        };
      }
      throw new Error('Tidak ada data interface');
    } catch (err) {
      return { data: [], source: 'unavailable', error: err.message };
    }
  },

  // Get Live RouterOS Logs (/log/print)
  getLogs: async function() {
    try {
      var data = await executeCommand('/log/print');
      if (Array.isArray(data) && data.length > 0) {
        return {
          data: data.slice(-50).reverse().map(function(item) {
          return {
            id: item['.id'],
            time: item.time,
            topics: item.topics,
            message: item.message
          };
          }),
          source: 'router'
        };
      }
      throw new Error('Tidak ada data log');
    } catch (err) {
      return { data: [], source: 'unavailable', error: err.message };
    }
  },

  // Get Node.js and Server Infrastructure Health
  getServerHealth: async function() {
    var os = require('os');
    var db = require('../config/db');
    var uptimeSec = Math.floor(process.uptime());
    var memUsage = process.memoryUsage();

    var dbPingStart = Date.now();
    var dbLatency = 0;
    var dbStatus = 'connected';
    try {
      await new Promise(function(resolve, reject) {
        db.query('SELECT 1', function(err) {
          if (err) return reject(err);
          resolve();
        });
      });
      dbLatency = Date.now() - dbPingStart;
    } catch (e) {
      dbStatus = 'disconnected';
      dbLatency = -1;
    }

    return {
      server_platform: os.platform() + ' ' + os.arch() + ' (' + os.release() + ')',
      node_version: process.version,
      server_uptime_seconds: uptimeSec,
      server_uptime_formatted: Math.floor(uptimeSec / 3600) + 'j ' + Math.floor((uptimeSec % 3600) / 60) + 'm ' + (uptimeSec % 60) + 'd',
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss_mb: Math.round(memUsage.rss / 1024 / 1024),
      os_total_mem_mb: Math.round(os.totalmem() / 1024 / 1024),
      os_free_mem_mb: Math.round(os.freemem() / 1024 / 1024),
      db_status: dbStatus,
      db_latency_ms: dbLatency,
      timestamp: new Date().toISOString()
    };
  },

  // Get all PPPoE Secrets (/ppp/secret)
  getSecrets: async function() {
    try {
      var data = await executeCommand('/ppp/secret/print');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching PPPoE secrets:', err.message);
      throw new Error('Gagal terhubung ke Mikrotik: ' + err.message);
    }
  },

  // Get all active PPPoE connections (/ppp/active)
  getActiveConnections: async function() {
    try {
      var data = await executeCommand('/ppp/active/print');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching active connections:', err.message);
      throw new Error('Gagal terhubung ke Mikrotik: ' + err.message);
    }
  },

  // Find Secret case-insensitively
  findSecret: async function(username) {
    if (!username) return null;
    var target = String(username).trim().toLowerCase();
    try {
      var secrets = await this.getSecrets();
      return secrets.find(function(s) {
        return (s.name || '').trim().toLowerCase() === target;
      }) || null;
    } catch (err) {
      return null;
    }
  },

  // Check if secret exists
  validateSecret: async function(username) {
    try {
      var secret = await this.findSecret(username);
      return !!secret;
    } catch (err) {
      return false;
    }
  },

  // Pastikan Profile ISOLIR dan Firewall Filter Drop Rule tersedia di MikroTik
  ensureIsolirConfig: async function() {
    try {
      // 1. Cek atau buat profile ISOLIR
      var profiles = await executeCommand('/ppp/profile/print', ['?name=ISOLIR']);
      if (!profiles || profiles.length === 0) {
        await executeCommand('/ppp/profile/add', [
          '=name=ISOLIR',
          '=local-address=192.168.100.1',
          '=remote-address=pppoe-pool',
          '=address-list=ISOLIR',
          '=dns-server=8.8.8.8',
          '=comment=Profile Otomatis Isolir Pelanggan Menunggak'
        ]);
        logger.info('MIKROTIK', 'Profile PPP ISOLIR otomatis dibuat di router.');
      }

      // 2. Cek atau buat firewall filter rule drop
      var filters = await executeCommand('/ip/firewall/filter/print', [
        '?comment=ISOLIR: Blokir Internet Pelanggan Menunggak'
      ]);
      if (!filters || filters.length === 0) {
        await executeCommand('/ip/firewall/filter/add', [
          '=chain=forward',
          '=src-address-list=ISOLIR',
          '=action=drop',
          '=comment=ISOLIR: Blokir Internet Pelanggan Menunggak'
        ]);
        logger.info('MIKROTIK', 'Firewall Filter drop rule ISOLIR otomatis dibuat di router.');
      }
    } catch (e) {
      // Non-fatal
    }
  },

  // Enable PPPoE Secret (Buka Isolir: Kembalikan ke Profile Default & Internet Normal TANPA Disconnect)
  enableSecret: async function(username) {
    if (!username) {
      logger.warn('MIKROTIK', 'Perintah enableSecret dilewati: username kosong.');
      return { success: false, reason: 'empty_username' };
    }
    try {
      var secret = await this.findSecret(username);
      if (secret) {
        var secretId = secret['.id'];
        var actualName = secret.name;

        // 1. Kembalikan Profile ke 'default' dan pastikan disabled=no
        await executeCommand('/ppp/secret/set', [
          '=.id=' + secretId,
          '=profile=default',
          '=disabled=no'
        ]);

        // 2. Ambil IP sesi aktif user saat ini (jika sedang online)
        var activeConns = await this.getActiveConnections();
        var target = actualName.toLowerCase();
        var currentActiveIps = [];
        for (var k = 0; k < activeConns.length; k++) {
          if ((activeConns[k].name || '').trim().toLowerCase() === target && activeConns[k].address) {
            currentActiveIps.push(activeConns[k].address.trim());
          }
        }

        // 3. Hapus IP dari firewall address-list ISOLIR
        try {
          var addrList = await executeCommand('/ip/firewall/address-list/print', [
            '?list=ISOLIR'
          ]);
          if (Array.isArray(addrList)) {
            for (var i = 0; i < addrList.length; i++) {
              var item = addrList[i];
              var itemComment = (item.comment || '').trim().toLowerCase();
              var itemAddress = (item.address || '').trim();

              if (itemComment === target || currentActiveIps.includes(itemAddress)) {
                try {
                  await executeCommand('/ip/firewall/address-list/remove', [
                    '=.id=' + item['.id']
                  ]);
                } catch (remErr) {}
              }
            }
          }
        } catch (e) {}

        // Catatan: TIDAK MEMUTUS SESI (disconnectSession) agar koneksi Dial-up di laptop
        // tetap 100% "Connected" tanpa perlu klik manual reconnect.
        logger.success('MIKROTIK', `PPPoE '${actualName}' isolir dibuka (Profile: default, internet seketika aktif tanpa disconnect).`);
        return { success: true, secretName: actualName, isIsolated: false };
      }
      logger.warn('MIKROTIK', `Secret '${username}' tidak ditemukan di router.`);
      return { success: false, reason: 'not_found' };
    } catch (err) {
      logger.error('MIKROTIK', `Gagal membuka isolir '${username}'`, err);
      throw err;
    }
  },

  // Disable PPPoE Secret (Isolir Cerdas: Blokir internet via Firewall TANPA Disconnect)
  disableSecret: async function(username) {
    if (!username) {
      logger.warn('MIKROTIK', 'Perintah disableSecret dilewati: username kosong.');
      return { success: false, reason: 'empty_username' };
    }
    try {
      await this.ensureIsolirConfig();

      var secret = await this.findSecret(username);
      if (secret) {
        var secretId = secret['.id'];
        var actualName = secret.name;

        // 1. Ubah Profile ke 'ISOLIR' dan biarkan disabled=no
        await executeCommand('/ppp/secret/set', [
          '=.id=' + secretId,
          '=profile=ISOLIR',
          '=disabled=no'
        ]);

        // 2. Tambahkan IP aktif ke address-list ISOLIR jika sedang online
        var activeConns = await this.getActiveConnections();
        var target = actualName.toLowerCase();
        var matchingConns = activeConns.filter(function(conn) {
          return (conn.name || '').trim().toLowerCase() === target;
        });

        for (var i = 0; i < matchingConns.length; i++) {
          var ip = matchingConns[i].address;
          if (ip) {
            try {
              await executeCommand('/ip/firewall/address-list/add', [
                '=list=ISOLIR',
                '=address=' + ip,
                '=comment=' + actualName
              ]);
            } catch (e) {}
          }
        }

        // Catatan: TIDAK MEMUTUS SESI (disconnectSession)! Sesi PPPoE di laptop tetap
        // berstatus "Connected", namun internet langsung mati karena terblokir firewall ISOLIR.
        logger.warn('MIKROTIK', `PPPoE '${actualName}' diisolir (Profile: ISOLIR, internet diblokir via Firewall, status Dial-up tetap Connected).`);
        return { 
          success: true, 
          secretName: actualName, 
          isIsolated: true 
        };
      }
      logger.warn('MIKROTIK', `Secret '${username}' tidak ditemukan di router, isolir dilewati.`);
      return { success: false, reason: 'not_found' };
    } catch (err) {
      logger.error('MIKROTIK', `Gagal mengisolir secret '${username}'`, err);
      throw err;
    }
  },

  // Disconnect active PPPoE session (Hard Kick dengan verifikasi tuntas)
  disconnectSession: async function(username) {
    if (!username) return { success: false, kickedCount: 0 };
    var target = String(username).trim().toLowerCase();

    try {
      // 1. Cari seluruh sesi aktif yang cocok (case-insensitive)
      var activeConns = await this.getActiveConnections();
      var matchingConns = activeConns.filter(function(conn) {
        return (conn.name || '').trim().toLowerCase() === target;
      });

      if (matchingConns.length === 0) {
        return { success: true, kickedCount: 0, message: 'Tidak ada sesi aktif berjalan.' };
      }

      // 2. Hapus seluruh sesi aktif
      var removedCount = 0;
      for (var i = 0; i < matchingConns.length; i++) {
        var connId = matchingConns[i]['.id'];
        await executeCommand('/ppp/active/remove', [
          '=.id=' + connId
        ]);
        removedCount++;
      }

      // 3. Verifikasi ulang setelah jeda 250ms untuk memastikan tidak ada ghost session
      await new Promise(function(resolve) { setTimeout(resolve, 250); });

      var verifyConns = await this.getActiveConnections();
      var remaining = verifyConns.filter(function(conn) {
        return (conn.name || '').trim().toLowerCase() === target;
      });

      if (remaining.length > 0) {
        for (var j = 0; j < remaining.length; j++) {
          await executeCommand('/ppp/active/remove', [
            '=.id=' + remaining[j]['.id']
          ]);
          removedCount++;
        }
      }

      logger.info('MIKROTIK', `Sesi aktif user '${username}' berhasil diputus paksa (${removedCount} sesi di-kick).`);
      return { success: true, kickedCount: removedCount };
    } catch (err) {
      logger.error('MIKROTIK', `Gagal memutuskan sesi '${username}'`, err);
      throw err;
    }
  },
  executeCommand: executeCommand
};

module.exports = MikrotikService;

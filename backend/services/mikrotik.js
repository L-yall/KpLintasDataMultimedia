var RouterOSAPI = require('node-routeros').RouterOSAPI;

var host = process.env.MIKROTIK_HOST || '192.168.50.1';
var user = process.env.MIKROTIK_USER || 'api_isp';
var pass = process.env.MIKROTIK_PASS || '190925Da';
var port = parseInt(process.env.MIKROTIK_PORT || '8728', 10);

// Helper function to establish connection, write command, close connection, and return data
async function executeCommand(command, params) {
  var conn = new RouterOSAPI({
    host: host,
    user: user,
    password: pass,
    port: port,
    timeout: 5
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
  ping: async function() {
    try {
      var data = await executeCommand('/system/resource/print');
      if (data && data.length > 0) {
        return {
          online: true,
          version: data[0].version || 'Unknown',
          board: data[0]['board-name'] || 'Mikrotik'
        };
      }
      return { online: false, error: 'Respon router kosong' };
    } catch (err) {
      console.error('Mikrotik Connection Error detail:', err);
      return {
        online: false,
        error: err.message
      };
    }
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

  // Check if secret exists
  validateSecret: async function(username) {
    try {
      var secrets = await this.getSecrets();
      return secrets.some(function(secret) {
        return secret.name === username;
      });
    } catch (err) {
      return false;
    }
  }
};

module.exports = MikrotikService;

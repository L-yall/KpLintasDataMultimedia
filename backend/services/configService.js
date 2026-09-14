var db = require('../config/db');

var cache = {};
var isInitialized = false;

var ConfigService = {
  /**
   * Inisialisasi tabel pengaturan jika belum ada, dan muat data ke memori cache
   */
  init: function () {
    return new Promise(function (resolve, reject) {
      var createTableSql = `
        CREATE TABLE IF NOT EXISTS pengaturan (
          kunci VARCHAR(100) PRIMARY KEY,
          nilai TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      db.query(createTableSql, function (err) {
        if (err) {
          console.error('[ConfigService] Gagal membuat tabel pengaturan:', err.message);
          return resolve(false);
        }

        db.query('SELECT kunci, nilai FROM pengaturan', function (selectErr, rows) {
          if (selectErr) {
            console.error('[ConfigService] Gagal memuat data dari tabel pengaturan:', selectErr.message);
            return resolve(false);
          }

          rows.forEach(function (row) {
            cache[row.kunci] = row.nilai;
            // Overwrite process.env agar modul yang baca process.env tetap mendapatkan nilai terbaru
            process.env[row.kunci] = row.nilai;
          });

          isInitialized = true;
          console.log(`[ConfigService] Terinisialisasi. ${rows.length} konfigurasi dimuat dari database.`);
          resolve(true);
        });
      });
    });
  },

  /**
   * Mengambil nilai konfigurasi berdasarkan key.
   * Urutan pencarian: Database Cache -> process.env -> defaultValue
   */
  get: function (key, defaultValue) {
    if (cache[key] !== undefined && cache[key] !== null && cache[key] !== '') {
      return cache[key];
    }
    if (process.env[key] !== undefined && process.env[key] !== null && process.env[key] !== '') {
      return process.env[key];
    }
    return defaultValue !== undefined ? defaultValue : '';
  },

  /**
   * Simpan satu key-value ke database dan cache
   */
  set: function (key, value) {
    return new Promise(function (resolve, reject) {
      var valStr = value !== undefined && value !== null ? String(value) : '';
      var sql = `
        INSERT INTO pengaturan (kunci, nilai) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)
      `;
      db.query(sql, [key, valStr], function (err) {
        if (err) {
          console.error(`[ConfigService] Gagal menyimpan key ${key}:`, err.message);
          return reject(err);
        }
        cache[key] = valStr;
        process.env[key] = valStr;
        resolve(true);
      });
    });
  },

  /**
   * Simpan beberapa key-value sekaligus
   */
  setMany: async function (settingsObj) {
    var keys = Object.keys(settingsObj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      await this.set(k, settingsObj[k]);
    }
    return true;
  },

  /**
   * Mengambil seluruh konfigurasi aktif
   */
  getAll: function () {
    return {
      // General ISP Profile
      NAMA_ISP: this.get('NAMA_ISP', 'Lintas Data Multimedia'),
      EMAIL_CS: this.get('EMAIL_CS', 'helpdesk@ldm.net.id'),
      TELP_CS: this.get('TELP_CS', '+62 857-2242-2448'),
      ALAMAT_ISP: this.get('ALAMAT_ISP', 'Intiland Tower 11th Floor 3A Jl. Panglima Sudirman 101-103  Surabaya, Jawa Timur, Indonesia 60271'),

      // Mikrotik Router
      MIKROTIK_HOST: this.get('MIKROTIK_HOST', '192.168.50.1'),
      MIKROTIK_PORT: this.get('MIKROTIK_PORT', '8728'),
      MIKROTIK_USER: this.get('MIKROTIK_USER', 'api_isp'),
      MIKROTIK_PASS: this.get('MIKROTIK_PASS', '190925Da'),

      // Email SMTP
      EMAIL_USER: this.get('EMAIL_USER', '24percobaan24@gmail.com'),
      EMAIL_PASS: this.get('EMAIL_PASS', 'jacb ramz jsmh urkf'),
      EMAIL_FROM: this.get('EMAIL_FROM', 'ESP Lintas Data <24percobaan24@gmail.com>'),

      // Midtrans Payment Gateway
      MIDTRANS_MERCHANT_ID: this.get('MIDTRANS_MERCHANT_ID', ''),
      MIDTRANS_CLIENT_KEY: this.get('MIDTRANS_CLIENT_KEY', ''),
      MIDTRANS_SERVER_KEY: this.get('MIDTRANS_SERVER_KEY', ''),
      MIDTRANS_IS_SANDBOX: this.get('MIDTRANS_IS_SANDBOX', 'true'),

      // Duitku Payment Gateway
      DUITKU_MERCHANT_CODE: this.get('DUITKU_MERCHANT_CODE', ''),
      DUITKU_API_KEY: this.get('DUITKU_API_KEY', ''),
      DUITKU_IS_SANDBOX: this.get('DUITKU_IS_SANDBOX', 'true'),

      // Manual Payment Methods
      MANUAL_PAYMENT_ENABLED: this.get('MANUAL_PAYMENT_ENABLED', 'true'),

      // Webhook / Callback Base URL (ngrok URL untuk development)
      APP_URL: this.get('APP_URL', ''),

      // Reminder Settings
      REMINDER_DUE_DAYS: this.get('REMINDER_DUE_DAYS', '3'),
      REMINDER_AUTO_SEND: this.get('REMINDER_AUTO_SEND', 'true'),
      REMINDER_WA_TEMPLATE: this.get('REMINDER_WA_TEMPLATE', 'Halo [Nama],\n\nIni adalah pengingat otomatis dari Lintas Data Multimedia.\nTagihan internet Anda untuk periode [Periode] sebesar Rp [Nominal] akan jatuh tempo pada [JatuhTempo].\n\nSilakan lakukan pembayaran agar layanan tidak terputus. Terima kasih.')
    };
  }
};

// Panggil inisialisasi awal
ConfigService.init();

module.exports = ConfigService;

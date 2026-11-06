/**
 * Elegant & Clean Logger Utility for ESP Lintas Data Multimedia
 * Menyediakan layout output konsol yang terstruktur, rapi, dan konsisten berbentuk Box Card.
 */

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m'
};

// Menghapus kode escape ANSI untuk menghitung panjang karakter visual sebenarnya
function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function getTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${colors.gray}[${h}:${m}:${s}]${colors.reset}`;
}

function padTag(tag) {
  return `[${tag.padEnd(8)}]`;
}

// Penyimpanan status untuk deduplikasi log berulang (menghindari spam)
const stateCache = new Map();
const loggedOnceKeys = new Set();

const Logger = {
  colors,

  /**
   * Log level Informasi umum
   */
  info: function (tag, message) {
    console.log(`${getTimestamp()} ${colors.cyan}${colors.bold}${padTag(tag)}${colors.reset} ${message}`);
  },

  /**
   * Log level Sukses
   */
  success: function (tag, message) {
    console.log(`${getTimestamp()} ${colors.green}${colors.bold}${padTag(tag)}${colors.reset} ${colors.green}${message}${colors.reset}`);
  },

  /**
   * Log level Peringatan
   */
  warn: function (tag, message) {
    console.log(`${getTimestamp()} ${colors.yellow}${colors.bold}${padTag(tag)}${colors.reset} ${colors.yellow}${message}${colors.reset}`);
  },

  /**
   * Log level Error
   */
  error: function (tag, message, err) {
    const errMsg = err && err.message ? ` (${err.message})` : '';
    console.error(`${getTimestamp()} ${colors.red}${colors.bold}${padTag(tag)}${colors.reset} ${colors.red}${message}${errMsg}${colors.reset}`);
  },

  /**
   * Log satu kali seumur hidup aplikasi
   */
  once: function (key, level, tag, message) {
    if (loggedOnceKeys.has(key)) return;
    loggedOnceKeys.add(key);
    if (this[level]) {
      this[level](tag, message);
    } else {
      this.info(tag, message);
    }
  },

  /**
   * Log hanya jika terjadi perubahan status
   */
  stateChange: function (stateKey, currentVal, onChangeCallback) {
    const prevVal = stateCache.get(stateKey);
    if (prevVal !== currentVal) {
      stateCache.set(stateKey, currentVal);
      if (typeof onChangeCallback === 'function') {
        onChangeCallback(currentVal, prevVal);
      }
    }
  },

  /**
   * Cetak Box Layout Simetris & Rapi (Sama persis seperti banner utama)
   */
  box: function (options = {}) {
    const title = options.title || '';
    const subtitle = options.subtitle || '';
    const items = options.items || [];
    const colorKey = options.color || 'cyan';
    const borderColor = colors[colorKey] || colors.cyan;
    const width = 68;

    const printRow = (rawContent) => {
      const visualLength = stripAnsi(rawContent).length;
      const padding = Math.max(0, width - 4 - visualLength);
      console.log(`${borderColor}║  ${colors.reset}${rawContent}${' '.repeat(padding)}${borderColor}║${colors.reset}`);
    };

    const printCenter = (rawContent) => {
      const visualLength = stripAnsi(rawContent).length;
      const totalPad = Math.max(0, width - 2 - visualLength);
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      console.log(`${borderColor}║${' '.repeat(leftPad)}${rawContent}${' '.repeat(rightPad)}${borderColor}║${colors.reset}`);
    };

    const topBorder = `╔${'═'.repeat(width - 2)}╗`;
    const midBorder = `╠${'─'.repeat(width - 2)}╣`;
    const botBorder = `╚${'═'.repeat(width - 2)}╝`;

    console.log('');
    console.log(`${borderColor}${topBorder}${colors.reset}`);
    if (title) {
      printCenter(`${colors.bold}${colors.white}${title}${colors.reset}`);
    }
    if (subtitle) {
      printCenter(`${colors.dim}${subtitle}${colors.reset}`);
    }
    if (title || subtitle) {
      console.log(`${borderColor}${midBorder}${colors.reset}`);
    }

    // Hitung max label length agar titik dua (:) sejajar rapi
    const maxLabelLen = items.reduce((max, it) => {
      if (typeof it === 'object' && it.label) {
        return Math.max(max, it.label.length);
      }
      return max;
    }, 0);

    items.forEach((it) => {
      if (typeof it === 'string') {
        printRow(it);
      } else {
        const paddedLabel = it.label.padEnd(maxLabelLen);
        const valColor = it.color && colors[it.color] ? colors[it.color] : colors.reset;
        printRow(`${colors.bold}• ${paddedLabel} :${colors.reset} ${valColor}${it.value}${colors.reset}`);
      }
    });

    console.log(`${borderColor}${botBorder}${colors.reset}`);
  },

  /**
   * Cetak Layout Startup Banner Utama
   */
  banner: function (details = {}) {
    const port = details.port || 3000;
    const env = process.env.NODE_ENV || 'development';
    const dbName = details.dbName || process.env.DB_NAME || 'billing_pembayaran_isp';

    this.box({
      title: 'ESP LINTAS DATA MULTIMEDIA - BACKEND API',
      subtitle: 'ISP Billing & Mikrotik PPPoE Management Server',
      color: 'cyan',
      items: [
        { label: 'API URL', value: `http://localhost:${port}`, color: 'green' },
        { label: 'Environment', value: env },
        { label: 'Database', value: `MySQL (${dbName})` },
        { label: 'Scheduler', value: 'Cron Evaluator (07:00 WIB)' },
        { label: 'Auto-Sync', value: 'MikroTik PPPoE (30s)' }
      ]
    });
  }
};

module.exports = Logger;

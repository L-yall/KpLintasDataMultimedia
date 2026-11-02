const mysql = require('mysql2');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '', 
  database: process.env.DB_NAME || 'dashboard_isp'
});

pool.getConnection((err, connection) => {
  if (err) {
    logger.box({
      title: 'KONEKSI DATABASE MYSQL',
      subtitle: 'Peringatan Koneksi Basis Data',
      color: 'yellow',
      items: [
        { label: 'Database', value: process.env.DB_NAME || 'dashboard_isp' },
        { label: 'Status', value: `Gagal Terhubung [${err.code || 'ETIMEDOUT'}]`, color: 'yellow' },
        { label: 'Solusi', value: 'Pastikan service MySQL di XAMPP / Laragon aktif' }
      ]
    });
  } else {
    logger.box({
      title: 'KONEKSI DATABASE MYSQL',
      subtitle: 'Status Koneksi & Database Pool',
      color: 'cyan',
      items: [
        { label: 'Host & Port', value: `${process.env.DB_HOST || 'localhost'}:3306` },
        { label: 'Nama Database', value: process.env.DB_NAME || 'dashboard_isp' },
        { label: 'Status Koneksi', value: 'Terhubung (Connected)', color: 'green' },
        { label: 'Struktur Tabel', value: 'Pengaturan, Rekening, & Tagihan Siap' }
      ]
    });

    // Pengecekan tabel pengaturan
    connection.query(`
      CREATE TABLE IF NOT EXISTS pengaturan (
        id_pengaturan VARCHAR(100) PRIMARY KEY,
        nilai TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, () => {});

    // Pengecekan tabel rekening_pembayaran
    connection.query(`
      CREATE TABLE IF NOT EXISTS rekening_pembayaran (
        id_rekening INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nama_bank VARCHAR(100) NOT NULL,
        nomor_rekening VARCHAR(50) NOT NULL,
        atas_nama VARCHAR(150) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, () => {
      // Seed data awal jika tabel masih kosong
      connection.query('SELECT COUNT(*) AS count FROM rekening_pembayaran', (cntErr, rows) => {
        if (!cntErr && rows && rows[0] && rows[0].count === 0) {
          var initialAccounts = [
            ['Bank BRI', '0346-01-001962-50-8', 'ESP Lintas Data Multimedia', 1],
            ['Bank Mandiri', '131-00-1572912-3', 'ESP Lintas Data Multimedia', 1],
            ['Bank BCA', '869-0577-888', 'ESP Lintas Data Multimedia', 1]
          ];
          connection.query(
            'INSERT INTO rekening_pembayaran (nama_bank, nomor_rekening, atas_nama, is_active) VALUES ?',
            [initialAccounts],
            (seedErr) => {
              if (!seedErr) logger.info('DATABASE', '[Migration] Inisialisasi 3 rekening pembayaran default (BRI, Mandiri, BCA).');
            }
          );
        }
      });
    });

    // Pengecekan kolom hidden_customer pada tabel pembayaran
    connection.query("SHOW COLUMNS FROM pembayaran LIKE 'hidden_customer'", (colErr, rows) => {
      if (!colErr && rows && rows.length === 0) {
        connection.query("ALTER TABLE pembayaran ADD COLUMN hidden_customer TINYINT(1) DEFAULT 0", (err) => {
          if (!err) logger.info('DATABASE', '[Migration] Kolom hidden_customer berhasil ditambahkan pada tabel pembayaran.');
        });
      }
    });

    // Pengecekan kolom tabel admin (password_hash -> password)
    connection.query("SHOW COLUMNS FROM admin LIKE 'password_hash'", (err, rows) => {
      if (!err && rows && rows.length > 0) {
        connection.query("ALTER TABLE admin CHANGE COLUMN password_hash password VARCHAR(255) NOT NULL", () => {});
      }
    });

    // Pengecekan kolom tabel paket_layanan (id -> id_paket)
    connection.query("SHOW COLUMNS FROM paket_layanan LIKE 'id'", (err, rows) => {
      if (!err && rows && rows.length > 0) {
        connection.query("ALTER TABLE paket_layanan CHANGE COLUMN id id_paket INT NOT NULL AUTO_INCREMENT", () => {});
      }
    });

    // Pengecekan kolom tabel rekening_pembayaran (id -> id_rekening)
    connection.query("SHOW COLUMNS FROM rekening_pembayaran LIKE 'id'", (err, rows) => {
      if (!err && rows && rows.length > 0) {
        connection.query("ALTER TABLE rekening_pembayaran CHANGE COLUMN id id_rekening INT NOT NULL AUTO_INCREMENT", () => {});
      }
    });

    // Pengecekan kolom tabel pengaturan (kunci -> id_pengaturan)
    connection.query("SHOW COLUMNS FROM pengaturan LIKE 'kunci'", (err, rows) => {
      if (!err && rows && rows.length > 0) {
        connection.query("ALTER TABLE pengaturan CHANGE COLUMN kunci id_pengaturan VARCHAR(100) NOT NULL", () => {});
      }
    });

    // Pengecekan kolom tabel pelanggan (nik & foto)
    connection.query("SHOW COLUMNS FROM pelanggan LIKE 'nik'", (err, rows) => {
      if (!err && rows && rows.length === 0) {
        connection.query("ALTER TABLE pelanggan ADD COLUMN nik VARCHAR(20) DEFAULT NULL", () => {});
      }
    });
    connection.query("SHOW COLUMNS FROM pelanggan LIKE 'foto'", (err, rows) => {
      if (!err && rows && rows.length === 0) {
        connection.query("ALTER TABLE pelanggan ADD COLUMN foto VARCHAR(255) DEFAULT NULL", () => {});
      }
    });

    // Pastikan pppoe_username dan due_date di pelanggan dapat bernilai NULL
    connection.query("ALTER TABLE pelanggan MODIFY pppoe_username VARCHAR(100) NULL DEFAULT NULL, MODIFY due_date DATE NULL DEFAULT NULL", () => {});

    // Pengecekan struktur tabel laporan_bulanan untuk riwayat unduhan
    connection.query(`
      CREATE TABLE IF NOT EXISTS laporan_bulanan (
        id_laporan INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        id_admin INT UNSIGNED NOT NULL,
        periode VARCHAR(7) NOT NULL,
        total_pemasukan DECIMAL(14,2) NOT NULL DEFAULT '0.00',
        total_pengeluaran DECIMAL(14,2) NOT NULL DEFAULT '0.00',
        file_path VARCHAR(255) DEFAULT NULL,
        tipe_generate ENUM('otomatis','manual') NOT NULL DEFAULT 'manual',
        generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_laporan_periode (periode),
        KEY fk_laporan_admin (id_admin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, () => {
      // Lepas UNIQUE index jika ada agar bisa mencatat unduhan berkali-kali untuk periode yang sama
      connection.query("SHOW INDEX FROM laporan_bulanan WHERE Key_name = 'uq_laporan_periode'", (idxErr, idxRows) => {
        if (!idxErr && idxRows && idxRows.length > 0) {
          connection.query("ALTER TABLE laporan_bulanan DROP INDEX uq_laporan_periode", (dropErr) => {
            if (!dropErr) logger.info('DATABASE', '[Migration] Index uq_laporan_periode dilepas untuk riwayat laporan.');
          });
        }
      });
    });

    // Pengecekan kolom tabel pengeluaran (bukti_nota, status, catatan_validasi, validated_by, validated_at)
    var pengeluaranCols = [
      ['bukti_nota', 'VARCHAR(255) DEFAULT NULL'],
      ['status', "ENUM('menunggu_persetujuan', 'disetujui', 'ditolak') DEFAULT 'menunggu_persetujuan'"],
      ['catatan_validasi', 'TEXT DEFAULT NULL'],
      ['validated_by', 'INT UNSIGNED DEFAULT NULL'],
      ['validated_at', 'DATETIME DEFAULT NULL']
    ];
    pengeluaranCols.forEach(function (item) {
      connection.query('SHOW COLUMNS FROM pengeluaran LIKE ?', [item[0]], function (err, rows) {
        if (!err && rows && rows.length === 0) {
          connection.query('ALTER TABLE pengeluaran ADD COLUMN ' + item[0] + ' ' + item[1], function () {});
        }
      });
    });

    connection.release(); 
  }
});

module.exports = pool;

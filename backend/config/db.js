const mysql = require('mysql2');

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '', 
  database: process.env.DB_NAME || 'dashboard_isp'
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error menghubungkan ke database dashboard_isp:', err.message);
  } else {
    console.log('Koneksi ke database dashboard_isp berhasil!');

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
              if (!seedErr) console.log('[DB Migration] Berhasil inisialisasi 3 rekening pembayaran default (BRI, Mandiri, BCA).');
            }
          );
        }
      });
    });

    // Pengecekan kolom hidden_customer pada tabel pembayaran
    connection.query("SHOW COLUMNS FROM pembayaran LIKE 'hidden_customer'", (colErr, rows) => {
      if (!colErr && rows && rows.length === 0) {
        connection.query("ALTER TABLE pembayaran ADD COLUMN hidden_customer TINYINT(1) DEFAULT 0", (err) => {
          if (!err) console.log('[DB Migration] Kolom hidden_customer berhasil ditambahkan pada tabel pembayaran.');
        });
      }
    });

    connection.release(); 
  }
});

module.exports = pool;

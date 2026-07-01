require('dotenv').config();
const mysql = require('mysql');

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
    connection.release(); 
  }
});

module.exports = pool;

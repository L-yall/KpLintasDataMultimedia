const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2');
const Router = require('../models/Router');

async function main() {
  // Do not import config/db: it starts unrelated schema changes and logging.
  const pool = mysql.createPool({
    connectionLimit: 1,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'dashboard_isp'
  });
  try {
    const model = Router.withDatabase(pool);
    const migration = await model.initialize();
    const routers = await model.list();
    const safeName = name => name.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 100);
    console.log(JSON.stringify({
      jumlah_router: routers.length,
      id_router_seed: migration.id_router_seed,
      jumlah_pelanggan_migrasi: migration.jumlah_pelanggan_migrasi,
      routers: routers.map(row => ({ id_router: row.id_router, nama_router: safeName(row.nama_router), jumlah_pelanggan: row.jumlah_pelanggan }))
    }));
  } finally {
    await pool.promise().end();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Driver errors can embed credential-bearing SQL. Do not print the exception.
    console.error('Migrasi router gagal; periksa database, skema, dan kunci enkripsi lalu coba kembali.');
    process.exitCode = 1;
  });
}

module.exports = main;

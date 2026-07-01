-- ============================================
-- ESP Lintas Data Multimedia - Dashboard ISP
-- Migration 001: Initial Schema
-- ============================================

-- Tabel Admin (login sistem)
CREATE TABLE IF NOT EXISTS admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nama VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel Paket Layanan ISP
CREATE TABLE IF NOT EXISTS paket_layanan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama_paket VARCHAR(100) NOT NULL,
  harga DECIMAL(12,0) NOT NULL,
  kecepatan VARCHAR(50),
  deskripsi TEXT,
  aktif TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel Pelanggan
CREATE TABLE IF NOT EXISTS pelanggan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  alamat TEXT,
  no_hp VARCHAR(20) UNIQUE NOT NULL,
  paket_id INT,
  pppoe_username VARCHAR(100),
  pppoe_status ENUM('active','inactive','unknown') DEFAULT 'unknown',
  status_tagihan ENUM('hijau','kuning','merah','abu') DEFAULT 'hijau',
  tanggal_daftar DATE,
  tanggal_jatuh_tempo INT DEFAULT 1,
  aktif TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (paket_id) REFERENCES paket_layanan(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index untuk pencarian cepat
CREATE INDEX idx_pelanggan_no_hp ON pelanggan(no_hp);
CREATE INDEX idx_pelanggan_pppoe ON pelanggan(pppoe_username);
CREATE INDEX idx_pelanggan_status ON pelanggan(status_tagihan);

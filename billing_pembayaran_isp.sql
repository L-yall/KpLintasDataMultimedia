-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 06, 2026 at 08:28 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `billing_pembayaran_isp`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `id_admin` int UNSIGNED NOT NULL,
  `nama` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('superadmin','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `status` enum('aktif','nonaktif') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktif',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`id_admin`, `nama`, `password`, `role`, `status`, `created_at`, `updated_at`, `email`) VALUES
(1, 'Administrator', '$2b$10$L4siK.NKLGUV76soKiRiyO9k8MebLarYOyiG7TMRhPnvQ0.tLv9va', 'superadmin', 'aktif', '2026-07-01 10:46:15', '2026-09-21 14:51:21', 'alfanetvalorant@gmail.com');

-- --------------------------------------------------------

--
-- Table structure for table `laporan_bulanan`
--

CREATE TABLE `laporan_bulanan` (
  `id_laporan` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `periode` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_pemasukan` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_pengeluaran` decimal(14,2) NOT NULL DEFAULT '0.00',
  `file_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipe_generate` enum('otomatis','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'otomatis',
  `generated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifikasi`
--

CREATE TABLE `notifikasi` (
  `id_notifikasi` int UNSIGNED NOT NULL,
  `id_pembayaran` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED DEFAULT NULL,
  `status_baca` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paket_layanan`
--

CREATE TABLE `paket_layanan` (
  `id_paket` int NOT NULL,
  `nama_paket` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `harga` decimal(12,0) NOT NULL,
  `kecepatan` varchar(50) DEFAULT NULL,
  `deskripsi` text,
  `aktif` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `paket_layanan`
--

INSERT INTO `paket_layanan` (`id_paket`, `nama_paket`, `harga`, `kecepatan`, `deskripsi`, `aktif`, `created_at`) VALUES
(2, 'Paket 20 Mbps', 185000, '20 Mbps', '\nKecepatan 20 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis\n', 1, '2026-07-01 03:48:02'),
(3, 'Paket 30 Mbps', 200000, '30 Mbps', '\nKecepatan 30 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis\n', 1, '2026-07-01 03:48:02'),
(4, 'Paket 50 Mbps', 250000, '50 Mbps', '\nKecepatan 50 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis', 1, '2026-07-06 06:27:05'),
(5, 'Paket 75 Mbps', 330000, '75 Mbps', '\nKecepatan 75 Mbps\nUnlimited tanpa FUP\nDukungan 24/7\nInstalasi Gratis', 1, '2026-07-06 06:27:38'),
(6, 'Paket Gamer 100 Mbps', 385000, '100Mbps', '\nKecepatan 100 Mbps\nUnlimited tanpa FUP\nDukungan Prioritas 24/7\nInstalasi Gratis', 1, '2026-07-06 06:28:10');

-- --------------------------------------------------------

--
-- Table structure for table `pelanggan`
--

CREATE TABLE `pelanggan` (
  `id_pelanggan` int UNSIGNED NOT NULL,
  `nama` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `alamat` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_hp` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pppoe_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pppoe_status` enum('active','inactive','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `paket` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_tagihan` enum('hijau','kuning','merah','abu_abu') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hijau',
  `due_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_router` int UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pembayaran`
--

CREATE TABLE `pembayaran` (
  `id_pembayaran` int UNSIGNED NOT NULL,
  `id_tagihan` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED DEFAULT NULL,
  `bukti_file` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','diterima','ditolak') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `alasan_tolak` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_upload` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` datetime DEFAULT NULL,
  `hidden_customer` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pengaturan`
--

CREATE TABLE `pengaturan` (
  `id_pengaturan` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `nilai` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `pengaturan`
--

INSERT INTO `pengaturan` (`id_pengaturan`, `nilai`, `updated_at`) VALUES
('ALAMAT_ISP', 'Intiland Tower 11th Floor 3A, Jl. Panglima Sudirman No.101-103, Embong Kaliasin, Kec. Genteng, Surabaya, Jawa Timur 60271', '2026-11-06 08:24:52'),
('APP_URL', 'https://retract-gratitude-unwind.ngrok-free.dev', '2026-09-10 06:03:21'),
('DUITKU_API_KEY', 'd4e37143fbf2da8a1274c3d99911cec9', '2026-07-31 08:07:30'),
('DUITKU_IS_SANDBOX', 'true', '2026-07-31 08:07:30'),
('DUITKU_MERCHANT_CODE', 'DS33629', '2026-07-31 08:07:30'),
('EMAIL_CS', 'cs@lintasdata.net', '2026-07-31 08:07:30'),
('EMAIL_FROM', 'ESP Lintas Data <24percobaan24@gmail.com>', '2026-07-31 08:07:30'),
('EMAIL_PASS', 'jacb ramz jsmh urkf', '2026-07-31 08:07:30'),
('EMAIL_USER', '24percobaan24@gmail.com', '2026-07-31 08:07:30'),
('MANUAL_PAYMENT_ENABLED', 'true', '2026-11-05 06:24:30'),
('MIDTRANS_CLIENT_KEY', 'Mid-client-olcy1ykJ6rKhm0FV', '2026-07-31 08:07:30'),
('MIDTRANS_IS_SANDBOX', 'true', '2026-07-31 08:07:30'),
('MIDTRANS_MERCHANT_ID', '', '2026-07-31 08:07:30'),
('MIDTRANS_SERVER_KEY', 'Mid-server-ui3hxC6xZBLZ7gy7zNK4z3vD', '2026-07-31 08:07:30'),
('MIKROTIK_HOST', '192.168.50.1', '2026-09-10 06:03:21'),
('MIKROTIK_PASS', '190925Da', '2026-07-31 08:07:30'),
('MIKROTIK_PORT', '8728', '2026-07-31 08:07:30'),
('MIKROTIK_USER', 'api_isp', '2026-09-07 05:45:57'),
('NAMA_ISP', 'Lintas Data Multimedia', '2026-07-31 08:07:29'),
('PAYMENT_GATEWAY_ACTIVE', 'none', '2026-11-05 06:24:31'),
('REMINDER_AUTO_SEND', 'true', '2026-07-31 08:07:30'),
('REMINDER_DUE_DAYS', '14', '2026-11-04 08:33:38'),
('REMINDER_WA_TEMPLATE', 'Halo [Nama],\n\nIni adalah pengingat otomatis dari Lintas Data Multimedia.\nTagihan internet Anda untuk periode [Periode] sebesar Rp [Nominal] akan jatuh tempo pada [JatuhTempo].\n\nSilakan lakukan pembayaran agar layanan tidak terputus. Terima kasih.', '2026-07-31 08:07:30'),
('TELP_CS', '+62 851-8200-1676', '2026-07-31 08:07:30');

-- --------------------------------------------------------

--
-- Table structure for table `pengeluaran`
--

CREATE TABLE `pengeluaran` (
  `id_pengeluaran` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `kategori` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nominal` decimal(12,2) NOT NULL,
  `tipe` enum('fix','tidak_fix') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal` date NOT NULL,
  `keterangan` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bukti_nota` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('menunggu_persetujuan','disetujui','ditolak') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'menunggu_persetujuan',
  `catatan_validasi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `validated_by` int UNSIGNED DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rekening_pembayaran`
--

CREATE TABLE `rekening_pembayaran` (
  `id_rekening` int NOT NULL,
  `nama_bank` varchar(100) NOT NULL,
  `nomor_rekening` varchar(50) NOT NULL,
  `atas_nama` varchar(150) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `logo_url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `rekening_pembayaran`
--

INSERT INTO `rekening_pembayaran` (`id_rekening`, `nama_bank`, `nomor_rekening`, `atas_nama`, `is_active`, `created_at`, `updated_at`, `logo_url`) VALUES
(1, 'Bank BRI', '0346-01-001962-50-8', 'ESP Lintas Data Multimedia', 1, '2026-09-23 06:41:25', '2026-09-23 06:41:25', NULL),
(2, 'Bank Mandiri', '131-00-1572912-3', 'ESP Lintas Data Multimedia', 1, '2026-09-23 06:41:25', '2026-09-23 06:41:25', NULL),
(3, 'Bank BCA', '869-0577-888', 'ESP Lintas Data Multimedia', 1, '2026-09-23 06:41:25', '2026-09-23 06:41:25', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `reminder_log`
--

CREATE TABLE `reminder_log` (
  `id_reminder` int UNSIGNED NOT NULL,
  `id_pelanggan` int UNSIGNED NOT NULL,
  `tanggal_kirim` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status_kirim` enum('terkirim','gagal','pending') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `pesan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `router_migrations`
--

CREATE TABLE `router_migrations` (
  `migration_key` varchar(100) NOT NULL,
  `id_router_seed` int UNSIGNED DEFAULT NULL,
  `jumlah_pelanggan_migrasi` int UNSIGNED NOT NULL DEFAULT '0',
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `router_migrations`
--

INSERT INTO `router_migrations` (`migration_key`, `id_router_seed`, `jumlah_pelanggan_migrasi`, `applied_at`) VALUES
('core_multi_router_v1', 1, 3, '2026-11-04 05:07:15');

-- --------------------------------------------------------

--
-- Table structure for table `router_mikrotik`
--

CREATE TABLE `router_mikrotik` (
  `id_router` int UNSIGNED NOT NULL,
  `nama_router` varchar(100) NOT NULL,
  `lokasi` varchar(255) NOT NULL DEFAULT '',
  `host` varchar(253) NOT NULL DEFAULT '',
  `port` smallint UNSIGNED NOT NULL DEFAULT '8728',
  `username` varchar(100) NOT NULL DEFAULT '',
  `password_encrypted` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `router_mikrotik`
--

INSERT INTO `router_mikrotik` (`id_router`, `nama_router`, `lokasi`, `host`, `port`, `username`, `password_encrypted`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Router Utama', '', '192.168.50.1', 8728, 'api_isp', 'v1:RwK5H4CyEhR0AhO5:qlGZrSpdNk/Ta5mGkDfRFQ==:m/x0e8PoaSs=', 1, '2026-11-04 05:07:15', '2026-11-04 05:07:15');

-- --------------------------------------------------------

--
-- Table structure for table `tagihan`
--

CREATE TABLE `tagihan` (
  `id_tagihan` int UNSIGNED NOT NULL,
  `id_pelanggan` int UNSIGNED NOT NULL,
  `periode` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nominal` decimal(12,2) NOT NULL,
  `status` enum('belum_bayar','menunggu_verifikasi','lunas','terlambat') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'belum_bayar',
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id_admin`);

--
-- Indexes for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  ADD PRIMARY KEY (`id_laporan`),
  ADD KEY `idx_laporan_periode` (`periode`),
  ADD KEY `fk_laporan_admin` (`id_admin`);

--
-- Indexes for table `notifikasi`
--
ALTER TABLE `notifikasi`
  ADD PRIMARY KEY (`id_notifikasi`),
  ADD UNIQUE KEY `uq_notifikasi_pembayaran` (`id_pembayaran`),
  ADD KEY `fk_notifikasi_pembayaran` (`id_pembayaran`),
  ADD KEY `fk_notifikasi_admin` (`id_admin`),
  ADD KEY `idx_notifikasi_status_baca` (`status_baca`);

--
-- Indexes for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  ADD PRIMARY KEY (`id_paket`);

--
-- Indexes for table `pelanggan`
--
ALTER TABLE `pelanggan`
  ADD PRIMARY KEY (`id_pelanggan`),
  ADD UNIQUE KEY `uq_pelanggan_no_hp` (`no_hp`),
  ADD UNIQUE KEY `uq_pelanggan_email` (`email`),
  ADD UNIQUE KEY `nik` (`nik`),
  ADD UNIQUE KEY `uq_pelanggan_router_pppoe` (`id_router`,`pppoe_username`),
  ADD KEY `idx_pelanggan_no_hp` (`no_hp`),
  ADD KEY `idx_pelanggan_pppoe` (`pppoe_username`),
  ADD KEY `idx_pelanggan_status` (`status_tagihan`);

--
-- Indexes for table `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD PRIMARY KEY (`id_pembayaran`),
  ADD KEY `fk_pembayaran_tagihan` (`id_tagihan`),
  ADD KEY `fk_pembayaran_admin` (`id_admin`),
  ADD KEY `idx_pembayaran_status` (`status`);

--
-- Indexes for table `pengaturan`
--
ALTER TABLE `pengaturan`
  ADD PRIMARY KEY (`id_pengaturan`);

--
-- Indexes for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  ADD PRIMARY KEY (`id_pengeluaran`),
  ADD KEY `fk_pengeluaran_admin` (`id_admin`),
  ADD KEY `idx_pengeluaran_tanggal` (`tanggal`),
  ADD KEY `idx_pengeluaran_tipe` (`tipe`);

--
-- Indexes for table `rekening_pembayaran`
--
ALTER TABLE `rekening_pembayaran`
  ADD PRIMARY KEY (`id_rekening`);

--
-- Indexes for table `reminder_log`
--
ALTER TABLE `reminder_log`
  ADD PRIMARY KEY (`id_reminder`),
  ADD KEY `fk_reminder_pelanggan` (`id_pelanggan`),
  ADD KEY `idx_reminder_tanggal` (`tanggal_kirim`);

--
-- Indexes for table `router_migrations`
--
ALTER TABLE `router_migrations`
  ADD PRIMARY KEY (`migration_key`);

--
-- Indexes for table `router_mikrotik`
--
ALTER TABLE `router_mikrotik`
  ADD PRIMARY KEY (`id_router`);

--
-- Indexes for table `tagihan`
--
ALTER TABLE `tagihan`
  ADD PRIMARY KEY (`id_tagihan`),
  ADD UNIQUE KEY `uq_tagihan_periode` (`id_pelanggan`,`periode`),
  ADD KEY `idx_tagihan_status` (`status`),
  ADD KEY `idx_tagihan_due_date` (`due_date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `id_admin` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  MODIFY `id_laporan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifikasi`
--
ALTER TABLE `notifikasi`
  MODIFY `id_notifikasi` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  MODIFY `id_paket` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `pelanggan`
--
ALTER TABLE `pelanggan`
  MODIFY `id_pelanggan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `pembayaran`
--
ALTER TABLE `pembayaran`
  MODIFY `id_pembayaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=72;

--
-- AUTO_INCREMENT for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  MODIFY `id_pengeluaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `rekening_pembayaran`
--
ALTER TABLE `rekening_pembayaran`
  MODIFY `id_rekening` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `reminder_log`
--
ALTER TABLE `reminder_log`
  MODIFY `id_reminder` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=80;

--
-- AUTO_INCREMENT for table `router_mikrotik`
--
ALTER TABLE `router_mikrotik`
  MODIFY `id_router` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tagihan`
--
ALTER TABLE `tagihan`
  MODIFY `id_tagihan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=98;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `pelanggan`
--
ALTER TABLE `pelanggan`
  ADD CONSTRAINT `fk_pelanggan_router_mikrotik` FOREIGN KEY (`id_router`) REFERENCES `router_mikrotik` (`id_router`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jul 02, 2026 at 04:45 AM
-- Server version: 8.0.30
-- PHP Version: 8.1.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dashboard_isp`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `id_admin` int UNSIGNED NOT NULL,
  `nama` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('superadmin','admin','staff') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`id_admin`, `nama`, `username`, `password_hash`, `role`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'admin', '$2b$10$yjtay2rY9X6fgrecfHJm5erGYAM4h9M5P9t3isqrhLqhDad/j0iF6', 'admin', '2026-07-01 10:46:15', '2026-07-01 10:46:15');

-- --------------------------------------------------------

--
-- Table structure for table `customer_otp`
--

CREATE TABLE `customer_otp` (
  `id` int NOT NULL,
  `no_hp` varchar(20) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `laporan_bulanan`
--

CREATE TABLE `laporan_bulanan` (
  `id_laporan` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `periode` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_pemasukan` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_pengeluaran` decimal(14,2) NOT NULL DEFAULT '0.00',
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipe_generate` enum('otomatis','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'otomatis',
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
  `id` int NOT NULL,
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

INSERT INTO `paket_layanan` (`id`, `nama_paket`, `harga`, `kecepatan`, `deskripsi`, `aktif`, `created_at`) VALUES
(1, 'Paket Silver', 150000, '10 Mbps', 'Paket internet 10 Mbps cocok untuk browsing dan streaming', 1, '2026-07-01 03:47:47'),
(2, 'Paket Gold', 250000, '20 Mbps', 'Paket internet 20 Mbps untuk keluarga dan WFH', 1, '2026-07-01 03:48:02'),
(3, 'Paket Platinum', 400000, '50 Mbps', 'Paket premium 50 Mbps untuk gaming dan streaming 4K', 1, '2026-07-01 03:48:02');

-- --------------------------------------------------------

--
-- Table structure for table `pelanggan`
--

CREATE TABLE `pelanggan` (
  `id_pelanggan` int UNSIGNED NOT NULL,
  `nama` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alamat` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_hp` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pppoe_username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pppoe_status` enum('active','inactive','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `paket` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_tagihan` enum('hijau','kuning','merah','abu_abu') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hijau',
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pelanggan`
--

INSERT INTO `pelanggan` (`id_pelanggan`, `nama`, `alamat`, `no_hp`, `pppoe_username`, `pppoe_status`, `paket`, `status_tagihan`, `due_date`, `created_at`, `updated_at`, `email`) VALUES
(2, 'pelanggan 1', 'Intiland Tower 11th Floor 3A\nJl. Panglima Sudirman 101-103\nSurabaya, Jawa Timur Indonesia 60271', '+6288989588135', 'pelanggan 1', 'inactive', 'Paket Platinum', 'hijau', '2026-08-01', '2026-07-01 11:28:27', '2026-07-02 11:43:30', 'rassyhvre@gmail.com'),
(3, 'Satya', 'sjajdsakjdsa', '+62 851-8200-1676', 'pelanggan 2', 'inactive', 'Paket Gold', 'hijau', '2026-06-30', '2026-07-01 15:40:33', '2026-07-02 11:35:04', 'namaprojek.testing@gmail.com'),
(4, 'Niken ', 'adjjskadsj', '+62 896-7763-1704', 'pelanggan 3', 'inactive', 'Paket Platinum', 'hijau', '2026-07-15', '2026-07-01 15:41:21', '2026-07-02 11:35:04', 'rahmatillahkurniawan@gmail.com');

-- --------------------------------------------------------

--
-- Table structure for table `pembayaran`
--

CREATE TABLE `pembayaran` (
  `id_pembayaran` int UNSIGNED NOT NULL,
  `id_tagihan` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED DEFAULT NULL,
  `bukti_file` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','diterima','ditolak') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `alasan_tolak` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_upload` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pembayaran`
--

INSERT INTO `pembayaran` (`id_pembayaran`, `id_tagihan`, `id_admin`, `bukti_file`, `status`, `alasan_tolak`, `tanggal_upload`, `verified_at`) VALUES
(4, 15, 1, '/uploads/bukti/bukti-1782967402299-248442401.jpeg', 'diterima', NULL, '2026-07-02 11:43:22', '2026-07-02 11:43:30');

-- --------------------------------------------------------

--
-- Table structure for table `pengeluaran`
--

CREATE TABLE `pengeluaran` (
  `id_pengeluaran` int UNSIGNED NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `kategori` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nominal` decimal(12,2) NOT NULL,
  `tipe` enum('fix','tidak_fix') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal` date NOT NULL,
  `keterangan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reminder_log`
--

CREATE TABLE `reminder_log` (
  `id_reminder` int UNSIGNED NOT NULL,
  `id_pelanggan` int UNSIGNED NOT NULL,
  `tanggal_kirim` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status_kirim` enum('terkirim','gagal','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `pesan` text COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tagihan`
--

CREATE TABLE `tagihan` (
  `id_tagihan` int UNSIGNED NOT NULL,
  `id_pelanggan` int UNSIGNED NOT NULL,
  `periode` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nominal` decimal(12,2) NOT NULL,
  `status` enum('belum_bayar','menunggu_verifikasi','lunas','terlambat') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'belum_bayar',
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tagihan`
--

INSERT INTO `tagihan` (`id_tagihan`, `id_pelanggan`, `periode`, `nominal`, `status`, `due_date`, `created_at`, `updated_at`) VALUES
(15, 2, '2026-07', 400000.00, 'lunas', '2026-07-03', '2026-07-02 11:43:06', '2026-07-02 11:43:30'),
(16, 3, '2026-07', 250000.00, 'belum_bayar', '2026-07-03', '2026-07-02 11:43:06', '2026-07-02 11:43:06'),
(17, 4, '2026-07', 400000.00, 'belum_bayar', '2026-07-03', '2026-07-02 11:43:06', '2026-07-02 11:43:06'),
(18, 2, '2026-08', 400000.00, 'belum_bayar', '2026-08-01', '2026-07-02 11:43:30', '2026-07-02 11:43:30');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id_admin`),
  ADD UNIQUE KEY `uq_admin_username` (`username`);

--
-- Indexes for table `customer_otp`
--
ALTER TABLE `customer_otp`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  ADD PRIMARY KEY (`id_laporan`),
  ADD UNIQUE KEY `uq_laporan_periode` (`periode`),
  ADD KEY `fk_laporan_admin` (`id_admin`);

--
-- Indexes for table `notifikasi`
--
ALTER TABLE `notifikasi`
  ADD PRIMARY KEY (`id_notifikasi`),
  ADD KEY `fk_notifikasi_pembayaran` (`id_pembayaran`),
  ADD KEY `fk_notifikasi_admin` (`id_admin`),
  ADD KEY `idx_notifikasi_status_baca` (`status_baca`);

--
-- Indexes for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pelanggan`
--
ALTER TABLE `pelanggan`
  ADD PRIMARY KEY (`id_pelanggan`),
  ADD UNIQUE KEY `uq_pelanggan_no_hp` (`no_hp`),
  ADD UNIQUE KEY `uq_pelanggan_pppoe` (`pppoe_username`),
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
-- Indexes for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  ADD PRIMARY KEY (`id_pengeluaran`),
  ADD KEY `fk_pengeluaran_admin` (`id_admin`),
  ADD KEY `idx_pengeluaran_tanggal` (`tanggal`),
  ADD KEY `idx_pengeluaran_tipe` (`tipe`);

--
-- Indexes for table `reminder_log`
--
ALTER TABLE `reminder_log`
  ADD PRIMARY KEY (`id_reminder`),
  ADD KEY `fk_reminder_pelanggan` (`id_pelanggan`),
  ADD KEY `idx_reminder_tanggal` (`tanggal_kirim`);

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
  MODIFY `id_admin` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `customer_otp`
--
ALTER TABLE `customer_otp`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  MODIFY `id_laporan` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifikasi`
--
ALTER TABLE `notifikasi`
  MODIFY `id_notifikasi` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `pelanggan`
--
ALTER TABLE `pelanggan`
  MODIFY `id_pelanggan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `pembayaran`
--
ALTER TABLE `pembayaran`
  MODIFY `id_pembayaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  MODIFY `id_pengeluaran` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reminder_log`
--
ALTER TABLE `reminder_log`
  MODIFY `id_reminder` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `tagihan`
--
ALTER TABLE `tagihan`
  MODIFY `id_tagihan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  ADD CONSTRAINT `fk_laporan_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `notifikasi`
--
ALTER TABLE `notifikasi`
  ADD CONSTRAINT `fk_notifikasi_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifikasi_pembayaran` FOREIGN KEY (`id_pembayaran`) REFERENCES `pembayaran` (`id_pembayaran`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD CONSTRAINT `fk_pembayaran_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pembayaran_tagihan` FOREIGN KEY (`id_tagihan`) REFERENCES `tagihan` (`id_tagihan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  ADD CONSTRAINT `fk_pengeluaran_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin` (`id_admin`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `reminder_log`
--
ALTER TABLE `reminder_log`
  ADD CONSTRAINT `fk_reminder_pelanggan` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan` (`id_pelanggan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `tagihan`
--
ALTER TABLE `tagihan`
  ADD CONSTRAINT `fk_tagihan_pelanggan` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan` (`id_pelanggan`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

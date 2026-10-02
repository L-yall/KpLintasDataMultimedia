-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Oct 01, 2026 at 09:10 AM
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
-- Database: `dashboard_isp`
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
(1, 'Administrator', '$2b$10$L4siK.NKLGUV76soKiRiyO9k8MebLarYOyiG7TMRhPnvQ0.tLv9va', 'superadmin', 'aktif', '2026-07-01 10:46:15', '2026-09-21 14:51:21', 'alfanetvalorant@gmail.com'),
(2, 'admin1', '$2b$10$yCATYXoE0P.XImIx1h1hVuSACCBSK5YowMoD8wXUD5Q3Q7o4kLOiu', 'admin', 'aktif', '2026-09-07 13:21:20', '2026-10-01 11:10:56', 'ldmsijaya@gmail.com');

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

--
-- Dumping data for table `notifikasi`
--

INSERT INTO `notifikasi` (`id_notifikasi`, `id_pembayaran`, `id_admin`, `status_baca`, `created_at`) VALUES
(5, 31, NULL, 1, '2026-08-10 11:32:44'),
(6, 32, NULL, 1, '2026-08-10 11:46:07'),
(7, 33, NULL, 1, '2026-08-14 13:21:58'),
(8, 34, NULL, 1, '2026-08-14 13:42:30'),
(9, 35, NULL, 1, '2026-08-14 13:44:21'),
(10, 36, NULL, 1, '2026-09-07 16:12:10'),
(11, 37, NULL, 1, '2026-09-07 16:12:50'),
(12, 38, NULL, 1, '2026-09-08 13:31:51'),
(14, 39, NULL, 1, '2026-09-08 14:14:42'),
(15, 40, NULL, 1, '2026-09-08 14:22:33'),
(17, 41, NULL, 1, '2026-09-08 14:48:01'),
(19, 42, NULL, 1, '2026-09-08 15:13:08'),
(20, 43, NULL, 1, '2026-09-08 15:38:11'),
(21, 44, NULL, 1, '2026-09-08 15:41:30'),
(22, 45, NULL, 1, '2026-09-08 16:07:17'),
(24, 46, NULL, 1, '2026-09-08 16:12:55'),
(26, 47, NULL, 1, '2026-09-09 13:26:33'),
(27, 48, NULL, 1, '2026-09-09 16:04:06'),
(29, 49, NULL, 1, '2026-09-10 13:52:15'),
(30, 50, NULL, 1, '2026-09-10 13:57:57'),
(31, 51, NULL, 1, '2026-09-22 12:51:27'),
(32, 52, NULL, 1, '2026-09-24 11:38:16'),
(34, 53, NULL, 1, '2026-10-01 11:58:08');

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
  `pppoe_username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pppoe_status` enum('active','inactive','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `paket` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_tagihan` enum('hijau','kuning','merah','abu_abu') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hijau',
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pelanggan`
--

INSERT INTO `pelanggan` (`id_pelanggan`, `nama`, `alamat`, `no_hp`, `pppoe_username`, `pppoe_status`, `paket`, `status_tagihan`, `due_date`, `created_at`, `updated_at`, `email`, `password`, `nik`, `foto`) VALUES
(3, 'Satya', 'Jl. Pemuda, Surabaya Pusat', '+62 851-8200-1676', 'pelanggan 2', 'inactive', 'Paket 75 Mbps', 'hijau', '2027-02-11', '2026-07-01 15:40:33', '2026-10-01 11:58:49', 'namaprojek.testing@gmail.com', '$2b$10$wtLZpTZTIuWubUTZluHwZuTGjdYgbok2inLFpf87o1rX.2kSbG54.', NULL, NULL),
(4, 'Nikenn ', 'Jl. Ahmad Yani, Surabaya Selatan', '+62 896-7763-1704', 'pelanggan 3', 'inactive', 'Paket 30 Mbps', 'merah', '2026-09-26', '2026-07-01 15:41:21', '2026-09-28 11:58:43', 'rahmatillahkurniawan@gmail.com', '$2b$10$5kFkZPDDLBoZGxBk.fbQzeChtezhqwml9JRCnCJkjW6M2AVi2Eex2', NULL, NULL),
(5, 'rassy', 'Saronggi, Sumenep', '+6288989588135', 'pelanggan 1', 'inactive', 'Paket Gamer 100 Mbps', 'hijau', '2026-12-25', '2026-07-06 11:55:52', '2026-09-07 12:39:42', 'rassyhvre@gmail.com', '$2b$10$wtLZpTZTIuWubUTZluHwZuTGjdYgbok2inLFpf87o1rX.2kSbG54.', NULL, NULL),
(7, 'Niken', 'tftgfhggfcervtbuyniui', '0882010110391', 'REG-1790581555946-552692905', 'inactive', 'Paket 50 Mbps', 'merah', '2026-09-28', '2026-09-28 14:45:55', '2026-09-30 16:10:32', 'rahmatillahniken@gmail.com', '$2b$10$LQZCJNYcD.nBy6vfJasheuvEsVAIdqAtFTe2Rg2.C6F5CFriGYMgS', '1234567890123456', '/uploads/foto-pelanggan/pelanggan-1790581555780-310585917.jpg'),
(8, 'anggris', 'sdad', '6666666666666', 'REG-1790830047149-55204030', 'unknown', 'Paket Gamer 100 Mbps', 'abu_abu', '2026-10-01', '2026-10-01 11:47:27', '2026-10-01 11:47:27', 'sadas@gmail.com', '$2b$10$oCa8KtpGcwZpaT/xd7BkWOYwNK10w7Cfm1yLDYjfYHjG9oaS/h9ga', '1234567890123450', '/uploads/foto-pelanggan/pelanggan-1790830047049-211780467.jpg');

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

--
-- Dumping data for table `pembayaran`
--

INSERT INTO `pembayaran` (`id_pembayaran`, `id_tagihan`, `id_admin`, `bukti_file`, `status`, `alasan_tolak`, `tanggal_upload`, `verified_at`, `hidden_customer`) VALUES
(31, 60, NULL, 'Midtrans / bank_transfer / settlement', 'diterima', NULL, '2026-08-10 11:32:44', '2026-08-10 11:32:44', 0),
(32, 61, NULL, 'Duitku / LQ / success', 'diterima', NULL, '2026-08-10 11:46:07', '2026-08-10 11:46:07', 0),
(33, 62, NULL, 'Duitku / BC / success', 'diterima', NULL, '2026-08-14 13:21:58', '2026-08-14 13:21:58', 0),
(34, 63, NULL, 'Duitku / NC / success', 'diterima', NULL, '2026-08-14 13:42:30', '2026-08-14 13:42:30', 0),
(35, 64, NULL, 'Duitku / BR / success', 'diterima', NULL, '2026-08-14 13:44:21', '2026-08-14 13:44:21', 0),
(36, 66, NULL, 'Midtrans / snap_finish / settlement', 'diterima', NULL, '2026-09-07 16:12:10', '2026-09-07 16:12:10', 0),
(37, 68, NULL, 'Midtrans / snap_finish / settlement', 'diterima', NULL, '2026-09-07 16:12:50', '2026-09-07 16:12:50', 0),
(38, 69, 2, '/uploads/bukti/bukti-1788849111875-44884857.jpeg', 'diterima', NULL, '2026-09-08 13:31:51', '2026-09-08 13:32:57', 0),
(39, 67, NULL, 'Midtrans / snap_finish / settlement', 'diterima', NULL, '2026-09-08 14:14:42', '2026-09-08 14:14:42', 0),
(40, 67, 2, '/uploads/bukti/bukti-1788852153063-353090363.jpeg', 'diterima', NULL, '2026-09-08 14:22:33', '2026-09-08 14:23:53', 0),
(41, 67, 2, '/uploads/bukti/bukti-1788853681779-184514749.jpeg', 'diterima', NULL, '2026-09-08 14:48:01', '2026-09-08 14:48:40', 0),
(42, 69, NULL, 'Duitku / M2 / success', 'diterima', NULL, '2026-09-08 15:13:08', '2026-09-08 15:13:08', 0),
(43, 67, 2, '/uploads/bukti/bukti-1788856691030-626690889.jpeg', 'ditolak', 'bukti tidak sesuai', '2026-09-08 15:38:11', '2026-09-08 15:39:13', 0),
(44, 67, NULL, 'Midtrans / snap_finish / settlement', 'diterima', NULL, '2026-09-08 15:41:30', '2026-09-08 15:41:30', 0),
(45, 75, 2, '/uploads/bukti/bukti-1788858437514-295562434.jpeg', 'diterima', NULL, '2026-09-08 16:07:17', '2026-09-08 16:12:19', 0),
(46, 76, 2, '/uploads/bukti/bukti-1788858775736-162229436.jpeg', 'diterima', NULL, '2026-09-08 16:12:55', '2026-09-08 16:18:33', 0),
(47, 74, NULL, 'Duitku / BV / success', 'diterima', NULL, '2026-09-09 13:26:33', '2026-09-09 13:26:33', 0),
(48, 78, 2, '/uploads/bukti/bukti-1788944646512-178710207.jpg', 'diterima', NULL, '2026-09-09 16:04:06', '2026-09-10 13:06:17', 0),
(49, 79, NULL, 'Duitku / SP / success', 'diterima', NULL, '2026-09-10 13:52:15', '2026-09-10 13:52:15', 0),
(50, 80, NULL, 'Duitku / LQ / success', 'diterima', NULL, '2026-09-10 13:57:57', '2026-09-10 13:57:57', 0),
(51, 67, NULL, 'Midtrans / snap_finish / settlement', 'diterima', NULL, '2026-09-22 12:51:27', '2026-09-22 12:51:27', 0),
(52, 67, 1, '/uploads/bukti/bukti-1790224696308-959484259.jpeg', 'diterima', NULL, '2026-09-24 11:38:16', '2026-09-24 11:51:55', 0),
(53, 81, 2, '/uploads/bukti/bukti-1790830688368-651513638.png', 'ditolak', 'gak jelas ', '2026-10-01 11:58:08', '2026-10-01 11:58:47', 0);

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
('ALAMAT_ISP', 'Jl. Raya Saronggi No. 45, Sumenep, Jawa Timur', '2026-07-31 08:07:30'),
('APP_URL', 'https://retract-gratitude-unwind.ngrok-free.dev', '2026-09-10 06:03:21'),
('DUITKU_API_KEY', 'd4e37143fbf2da8a1274c3d99911cec9', '2026-07-31 08:07:30'),
('DUITKU_IS_SANDBOX', 'true', '2026-07-31 08:07:30'),
('DUITKU_MERCHANT_CODE', 'DS33629', '2026-07-31 08:07:30'),
('EMAIL_CS', 'cs@lintasdata.net', '2026-07-31 08:07:30'),
('EMAIL_FROM', 'ESP Lintas Data <24percobaan24@gmail.com>', '2026-07-31 08:07:30'),
('EMAIL_PASS', 'jacb ramz jsmh urkf', '2026-07-31 08:07:30'),
('EMAIL_USER', '24percobaan24@gmail.com', '2026-07-31 08:07:30'),
('MANUAL_PAYMENT_ENABLED', 'true', '2026-09-24 07:52:52'),
('MIDTRANS_CLIENT_KEY', 'Mid-client-olcy1ykJ6rKhm0FV', '2026-07-31 08:07:30'),
('MIDTRANS_IS_SANDBOX', 'true', '2026-07-31 08:07:30'),
('MIDTRANS_MERCHANT_ID', '', '2026-07-31 08:07:30'),
('MIDTRANS_SERVER_KEY', 'Mid-server-ui3hxC6xZBLZ7gy7zNK4z3vD', '2026-07-31 08:07:30'),
('MIKROTIK_HOST', '192.168.50.1', '2026-09-10 06:03:21'),
('MIKROTIK_PASS', '190925Da', '2026-07-31 08:07:30'),
('MIKROTIK_PORT', '8728', '2026-07-31 08:07:30'),
('MIKROTIK_USER', 'api_isp', '2026-09-07 05:45:57'),
('NAMA_ISP', 'Lintas Data Multimedia', '2026-07-31 08:07:29'),
('PAYMENT_GATEWAY_ACTIVE', 'none', '2026-09-24 07:53:32'),
('REMINDER_AUTO_SEND', 'true', '2026-07-31 08:07:30'),
('REMINDER_DUE_DAYS', '3', '2026-07-31 08:07:30'),
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
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `pengeluaran`
--

INSERT INTO `pengeluaran` (`id_pengeluaran`, `id_admin`, `kategori`, `nominal`, `tipe`, `tanggal`, `keterangan`, `created_at`) VALUES
(1, 1, 'Air', 20000.00, 'tidak_fix', '2026-07-06', NULL, '2026-07-07 15:27:56'),
(2, 1, 'Listrik', 400000.00, 'fix', '2026-07-08', NULL, '2026-07-08 11:19:18');

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
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `rekening_pembayaran`
--

INSERT INTO `rekening_pembayaran` (`id_rekening`, `nama_bank`, `nomor_rekening`, `atas_nama`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Bank BRI', '0346-01-001962-50-8', 'ESP Lintas Data Multimedia', 1, '2026-09-23 06:41:25', '2026-09-23 06:41:25'),
(2, 'Bank Mandiri', '131-00-1572912-3', 'ESP Lintas Data Multimedia', 1, '2026-09-23 06:41:25', '2026-09-23 06:41:25'),
(3, 'Bank BCA', '869-0577-888', 'ESP Lintas Data Multimedia', 1, '2026-09-23 06:41:25', '2026-09-23 06:41:25');

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

--
-- Dumping data for table `reminder_log`
--

INSERT INTO `reminder_log` (`id_reminder`, `id_pelanggan`, `tanggal_kirim`, `status_kirim`, `pesan`) VALUES
(43, 4, '2026-09-24 11:55:30', 'terkirim', 'Halo Nikenn ,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 200.000* akan jatuh tempo dalam *1 hari* (26 September 2026).\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahkurniawan%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(44, 4, '2026-09-25 11:05:53', 'terkirim', 'Halo Nikenn ,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n⚠️ *JATUH TEMPO HARI INI* ⚠️\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 200.000* telah jatuh tempo pada hari ini (26 September 2026).\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahkurniawan%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(45, 4, '2026-09-28 11:58:51', 'terkirim', 'Halo Nikenn ,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 200.000* TELAH LEWAT JATUH TEMPO pada tanggal 26 September 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahkurniawan%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(46, 6, '2026-09-28 13:41:45', 'terkirim', 'Halo rahm,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 385.000* TELAH LEWAT JATUH TEMPO pada tanggal 27 September 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahniken%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(47, 4, '2026-09-30 15:45:39', 'terkirim', 'Halo Nikenn ,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 200.000* TELAH LEWAT JATUH TEMPO pada tanggal 26 September 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahkurniawan%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(48, 7, '2026-09-30 16:10:40', 'terkirim', 'Halo Niken,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 250.000* TELAH LEWAT JATUH TEMPO pada tanggal 27 September 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahniken%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(49, 4, '2026-10-01 10:11:10', 'terkirim', 'Halo Nikenn ,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 200.000* TELAH LEWAT JATUH TEMPO pada tanggal 26 September 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahkurniawan%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.'),
(50, 7, '2026-10-01 10:11:22', 'terkirim', 'Halo Niken,\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode 2026-09 sebesar *Rp 250.000* TELAH LEWAT JATUH TEMPO pada tanggal 27 September 2026.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\nSilakan lakukan pembayaran dan konfirmasi melalui portal kami:\nhttp://localhost:3001/bayar/rahmatillahniken%40gmail.com\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.');

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
-- Dumping data for table `tagihan`
--

INSERT INTO `tagihan` (`id_tagihan`, `id_pelanggan`, `periode`, `nominal`, `status`, `due_date`, `created_at`, `updated_at`) VALUES
(60, 5, '2026-08', 385000.00, 'lunas', '2026-08-02', '2026-07-31 15:09:28', '2026-08-10 11:32:44'),
(61, 5, '2026-09', 385000.00, 'lunas', '2026-08-31', '2026-08-10 11:32:44', '2026-08-10 11:46:07'),
(62, 5, '2026-10', 385000.00, 'lunas', '2026-09-29', '2026-08-10 11:46:07', '2026-08-14 13:21:58'),
(63, 5, '2026-11', 385000.00, 'lunas', '2026-10-28', '2026-08-14 13:21:58', '2026-08-14 13:42:30'),
(64, 5, '2026-12', 385000.00, 'lunas', '2026-11-26', '2026-08-14 13:42:30', '2026-08-14 13:44:21'),
(65, 5, '2027-01', 385000.00, 'belum_bayar', '2026-12-25', '2026-08-14 13:44:21', '2026-08-14 13:44:21'),
(66, 3, '2026-07', 330000.00, 'lunas', '2026-07-22', '2026-09-07 12:55:58', '2026-09-07 16:12:10'),
(67, 4, '2026-09', 200000.00, 'terlambat', '2026-09-26', '2026-09-07 12:55:58', '2026-09-28 11:58:38'),
(68, 3, '2026-08', 330000.00, 'lunas', '2026-08-22', '2026-09-07 16:12:10', '2026-09-07 16:12:50'),
(69, 3, '2026-09', 330000.00, 'lunas', '2026-09-11', '2026-09-07 16:12:50', '2026-09-08 15:13:08'),
(74, 3, '2026-10', 330000.00, 'lunas', '2026-10-11', '2026-09-08 15:13:08', '2026-09-09 13:26:33'),
(75, 4, '2026-10', 200000.00, 'lunas', '2026-10-09', '2026-09-08 15:41:30', '2026-09-08 16:12:19'),
(76, 4, '2026-11', 200000.00, 'lunas', '2026-11-09', '2026-09-08 16:12:19', '2026-09-08 16:18:33'),
(78, 3, '2026-11', 330000.00, 'lunas', '2026-11-11', '2026-09-09 13:26:33', '2026-09-10 13:06:17'),
(79, 3, '2026-12', 330000.00, 'lunas', '2026-12-11', '2026-09-10 13:06:17', '2026-09-10 13:52:15'),
(80, 3, '2027-01', 330000.00, 'lunas', '2027-01-11', '2026-09-10 13:52:15', '2026-09-10 13:57:57'),
(81, 3, '2027-02', 330000.00, 'belum_bayar', '2027-02-11', '2026-09-10 13:57:57', '2026-10-01 11:58:47'),
(88, 6, '2026-09', 385000.00, 'terlambat', '2026-09-27', '2026-09-28 13:41:10', '2026-09-28 13:41:20'),
(89, 7, '2026-09', 250000.00, 'terlambat', '2026-09-27', '2026-09-30 15:45:26', '2026-09-30 16:10:27');

--
-- Indexes for dumped tables
--

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
  ADD UNIQUE KEY `uq_pelanggan_pppoe` (`pppoe_username`),
  ADD UNIQUE KEY `uq_pelanggan_email` (`email`),
  ADD UNIQUE KEY `nik` (`nik`),
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
-- AUTO_INCREMENT for table `laporan_bulanan`
--
ALTER TABLE `laporan_bulanan`
  MODIFY `id_laporan` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifikasi`
--
ALTER TABLE `notifikasi`
  MODIFY `id_notifikasi` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `paket_layanan`
--
ALTER TABLE `paket_layanan`
  MODIFY `id_paket` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `pelanggan`
--
ALTER TABLE `pelanggan`
  MODIFY `id_pelanggan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `pembayaran`
--
ALTER TABLE `pembayaran`
  MODIFY `id_pembayaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `pengeluaran`
--
ALTER TABLE `pengeluaran`
  MODIFY `id_pengeluaran` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `rekening_pembayaran`
--
ALTER TABLE `rekening_pembayaran`
  MODIFY `id_rekening` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `reminder_log`
--
ALTER TABLE `reminder_log`
  MODIFY `id_reminder` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `tagihan`
--
ALTER TABLE `tagihan`
  MODIFY `id_tagihan` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=90;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

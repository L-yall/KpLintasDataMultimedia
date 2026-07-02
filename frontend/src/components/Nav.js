import React from 'react';
import { useLocation } from 'react-router-dom';

function Navbar() {
  var location = useLocation();

  var pageTitles = {
    '/dashboard': { title: 'Dashboard', subtitle: 'Overview monitoring pelanggan' },
    '/dashboard/pelanggan': { title: 'Data Pelanggan', subtitle: 'Kelola data pelanggan ISP' },
    '/dashboard/paket': { title: 'Paket Layanan', subtitle: 'Kelola paket internet' },
    '/dashboard/mikrotik': { title: 'Monitoring Mikrotik', subtitle: 'Status koneksi & active sessions' },
    '/dashboard/reminder-logs': { title: 'Log Reminder WhatsApp', subtitle: 'Riwayat pengiriman notifikasi jatuh tempo' },
    '/dashboard/pembayaran': { title: 'Persetujuan Pembayaran', subtitle: 'Verifikasi bukti transfer & aktifkan internet' },
    '/dashboard/laporan': { title: 'Laporan Keuangan', subtitle: 'Ringkasan finansial, kelola pengeluaran & export Excel' },
  };

  var currentPage = pageTitles[location.pathname] || { title: 'Dashboard', subtitle: '' };

  return (
    <header className="topbar">
      <div className="topbar-title">
        {currentPage.title}
        {currentPage.subtitle && <span>— {currentPage.subtitle}</span>}
      </div>
      <div className="topbar-actions">
        <div className="topbar-search">
          <span className="topbar-search-icon">🔍</span>
          <input type="text" placeholder="Cari pelanggan..." />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
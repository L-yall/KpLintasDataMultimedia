import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function DashboardPage({ socket }) {
  var [stats, setStats] = useState({
    total_aktif: 0,
    hijau: 0,
    kuning: 0,
    merah: 0,
    abu_abu: 0
  });
  var [routerStatus, setRouterStatus] = useState({ online: false, error: 'Memuat...' });
  var [pppoeSummary, setPppoeSummary] = useState({ active_count: 0, unregistered_count: 0 });
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    fetchStats();
    fetchRouterInfo();

    if (socket) {
      socket.on('mikrotik_ping', function(pingData) {
        setRouterStatus(pingData);
      });

      socket.on('pppoe_summary', function(summary) {
        setPppoeSummary(summary);
      });

      socket.on('pelanggan_updated', function() {
        fetchStats();
      });
    }

    return function() {
      if (socket) {
        socket.off('mikrotik_ping');
        socket.off('pppoe_summary');
        socket.off('pelanggan_updated');
      }
    };
  }, [socket]);

  async function fetchStats() {
    try {
      var token = localStorage.getItem('token');
      var response = await axios.get('http://localhost:3000/api/pelanggan/stats', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil statistik:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRouterInfo() {
    try {
      var token = localStorage.getItem('token');
      var headers = { Authorization: 'Bearer ' + token };
      var statusRes = await axios.get('http://localhost:3000/api/mikrotik/status', { headers: headers });
      setRouterStatus(statusRes.data.data);
    } catch (err) {
      console.error('Gagal mengambil status router:', err);
    }
  }

  var statCards = [
    {
      label: 'Total Pelanggan Aktif',
      value: stats.total_aktif,
      icon: '👥',
      iconClass: 'primary',
      delay: 'stagger-1'
    },
    {
      label: 'Lunas / Hijau',
      value: stats.hijau,
      icon: '✅',
      iconClass: 'success',
      delay: 'stagger-2'
    },
    {
      label: 'Mendekati Jatuh Tempo',
      value: stats.kuning,
      icon: '⚠️',
      iconClass: 'warning',
      delay: 'stagger-3'
    },
    {
      label: 'Menunggak',
      value: stats.merah,
      icon: '🔴',
      iconClass: 'danger',
      delay: 'stagger-4'
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Selamat datang kembali! Berikut ringkasan status pelanggan.</p>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map(function(card, idx) {
          return (
            <div className={'stat-card ' + card.delay} key={idx} style={{ animationDelay: (idx * 0.08) + 's' }}>
              <div className="stat-card-info">
                <h3>{card.label}</h3>
                <div className="stat-number">
                  {loading ? (
                    <div className="skeleton skeleton-text lg"></div>
                  ) : (
                    card.value
                  )}
                </div>
              </div>
              <div className={'stat-card-icon ' + card.iconClass}>
                {card.icon}
              </div>
            </div>
          );
        })}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Aktivitas Terbaru */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Aktivitas Terbaru</h3>
          </div>
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>📝</div>
            <p>Belum ada aktivitas tercatat.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Aktivitas akan muncul setelah ada transaksi.</p>
          </div>
        </div>

        {/* Status Internet (Mikrotik) */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Status Internet</h3>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '2px 10px',
              borderRadius: '50px',
              backgroundColor: routerStatus.online ? 'var(--status-hijau-bg)' : 'var(--status-merah-bg)',
              color: routerStatus.online ? 'var(--status-hijau)' : 'var(--status-merah)'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: routerStatus.online ? 'var(--status-hijau)' : 'var(--status-merah)'
              }} />
              {routerStatus.online ? 'Router Online' : 'Router Offline'}
            </span>
          </div>
          
          <div style={{ padding: '8px 0' }}>
            {routerStatus.online ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Model Router:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{routerStatus.board}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>RouterOS Version:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{routerStatus.version}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Koneksi PPPoE Aktif:</span>
                  <strong style={{ color: 'var(--primary-light)' }}>{pppoeSummary.active_count} Sesi</strong>
                </div>
                {pppoeSummary.unregistered_count > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'var(--status-merah-bg)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}>
                    <span style={{ color: 'var(--status-merah)', fontSize: '0.82rem', fontWeight: 500 }}>
                      ⚠️ {pppoeSummary.unregistered_count} PPPoE belum terdaftar!
                    </span>
                    <Link to="/dashboard/mikrotik" className="btn btn-sm btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                      Detail
                    </Link>
                  </div>
                )}
                <Link to="/dashboard/mikrotik" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                  ⚙️ Masuk Panel Mikrotik
                </Link>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>📡</div>
                <p>Gagal terhubung ke router Mikrotik.</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--status-merah)', marginTop: '4px' }}>
                  Detail: {routerStatus.error || 'Connection timed out'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

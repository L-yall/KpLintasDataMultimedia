import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function DashboardPage({ socket }) {
  var [stats, setStats] = useState({
    total_aktif: 0,
    hijau: 0,
    kuning: 0,
    merah: 0,
    abu_abu: 0
  });
  var [customers, setCustomers] = useState([]);
  var [routerStatus, setRouterStatus] = useState({ online: false, error: 'Memuat...' });
  var [pppoeSummary, setPppoeSummary] = useState({ active_count: 0, unregistered_count: 0, unregistered_list: [] });
  var [loading, setLoading] = useState(true);

  useEffect(function () {
    fetchStats();
    fetchRouterInfo();
    fetchCustomers();

    if (socket) {
      socket.on('mikrotik_ping', function (pingData) {
        setRouterStatus(pingData);
      });

      socket.on('pppoe_summary', function (summary) {
        setPppoeSummary(summary);
      });

      socket.on('pelanggan_updated', function (data) {
        fetchStats();
        // Update customer PPPoE status dynamically in state
        setCustomers(function (prev) {
          return prev.map(function (c) {
            if (c.id_pelanggan === data.id_pelanggan) {
              return {
                ...c,
                pppoe_status: data.pppoe_status || c.pppoe_status,
                status_tagihan: data.status_tagihan || c.status_tagihan
              };
            }
            return c;
          });
        });
      });
    }

    return function () {
      if (socket) {
        socket.off('mikrotik_ping');
        socket.off('pppoe_summary');
        socket.off('pelanggan_updated');
      }
    };
  }, [socket]);

  var containerRef = useRef(null);
  var [routerLine, setRouterLine] = useState(null);
  var [clientLines, setClientLines] = useState([]);

  useEffect(() => {
    function updateLines() {
      if (!containerRef.current) return;
      var container = containerRef.current;
      var containerRect = container.getBoundingClientRect();

      var routerNode = container.querySelector('#router-node');
      var switchNode = container.querySelector('#switch-node');
      var clientNodes = container.querySelectorAll('.client-node');

      if (routerNode && switchNode) {
        var routerRect = routerNode.getBoundingClientRect();
        var swRect = switchNode.getBoundingClientRect();
        var routerX = routerRect.left - containerRect.left + routerRect.width / 2;
        var routerY = routerRect.top - containerRect.top + routerRect.height;
        var swX = swRect.left - containerRect.left + swRect.width / 2;
        var swY = swRect.top - containerRect.top + swRect.height;

        setRouterLine({
          pathD: 'M ' + routerX + ' ' + routerY + ' C ' + routerX + ' ' + (routerY + 32) + ', ' + swX + ' ' + (swY - 44) + ', ' + swX + ' ' + (swY - 6),
          color: routerStatus.online ? '#22C55E' : '#EF4444'
        });
      } else {
        setRouterLine(null);
      }

      if (switchNode && clientNodes.length > 0) {
        var newLines = Array.from(clientNodes).map(function (node) {
          var cRect = node.getBoundingClientRect();
          var isOnline = node.classList.contains('online');
          var isWarning = node.classList.contains('warning');
          var status = isOnline ? 'up' : (isWarning ? 'warning' : 'down');
          var x2 = cRect.left - containerRect.left + cRect.width / 2;
          var y2 = cRect.top - containerRect.top + 8;
          var curveX = x2 >= swX ? Math.min(110, Math.abs(x2 - swX) * 0.32) : -Math.min(110, Math.abs(x2 - swX) * 0.32);

          return {
            x1: swX,
            y1: swY - 6,
            x2: x2,
            y2: y2,
            pathD: 'M ' + swX + ' ' + (swY - 6) + ' C ' + (swX + curveX) + ' ' + (swY + 26) + ', ' + (x2 - curveX * 0.4) + ' ' + (y2 - 36) + ', ' + x2 + ' ' + y2,
            status: status
          };
        });
        setClientLines(newLines);
      } else {
        setClientLines([]);
      }
    }

    updateLines();
    window.addEventListener('resize', updateLines);
    var timer = setTimeout(updateLines, 500); // re-calculate after rendering

    return function () {
      window.removeEventListener('resize', updateLines);
      clearTimeout(timer);
    };
  }, [customers, pppoeSummary, routerStatus, loading]);

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

  async function fetchCustomers() {
    try {
      var token = localStorage.getItem('token');
      var response = await axios.get('http://localhost:3000/api/pelanggan', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (response.data.success) {
        setCustomers(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data pelanggan:', err);
    }
  }

  var statCards = [
    {
      label: 'Total Pelanggan Aktif',
      value: stats.total_aktif,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" />
          <circle cx="10" cy="7" r="3" />
          <path d="M17 8a2.5 2.5 0 1 0 0 5" />
          <path d="M19 13v1" />
        </svg>
      ),
      iconClass: 'primary',
      delay: 'stagger-1'
    },
    {
      label: 'Lunas / Hijau',
      value: stats.hijau,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
      iconClass: 'success',
      delay: 'stagger-2'
    },
    {
      label: 'Mendekati Jatuh Tempo',
      value: stats.kuning,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ),
      iconClass: 'warning',
      delay: 'stagger-3'
    },
    {
      label: 'Menunggak',
      value: stats.merah,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9 9 15" />
          <path d="m9 9 6 6" />
        </svg>
      ),
      iconClass: 'danger',
      delay: 'stagger-4'
    }
  ];

  // Grouping customers for the topology display
  var activeCustomers = customers.filter(c => c.pppoe_status === 'active');
  var inactiveCustomers = customers.filter(c => c.pppoe_status === 'inactive' || c.pppoe_status === 'unknown');
  var unregisteredActive = pppoeSummary.unregistered_list || [];

  var routerBadgeClass = routerStatus.online ? 'healthy' : 'danger';

  return (
    <div>
      <style>{`
        .dashboard-shell {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .dashboard-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 24px 28px;
          box-shadow: var(--shadow-sm);
        }

        .dashboard-hero h1 {
          font-size: 1.7rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 8px;
          letter-spacing: -0.02em;
          font-family: 'Hanken Grotesk', 'Inter', sans-serif;
        }

        .dashboard-hero p {
          color: var(--text-secondary);
          max-width: 700px;
          line-height: 1.6;
          font-size: 0.95rem;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--primary-glow);
          color: var(--primary);
          font-size: 0.74rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 10px;
        }

        .hero-badge::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary);
          display: inline-block;
        }

        .dashboard-hero-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(110px, 1fr));
          gap: 10px;
          min-width: 320px;
        }

        .dashboard-hero-stat {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px 14px;
        }

        .dashboard-hero-stat small {
          display: block;
          color: var(--text-muted);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .dashboard-hero-stat strong {
          font-size: 1rem;
          color: var(--text-primary);
          font-weight: 700;
        }

        .stat-card-icon svg {
          width: 20px;
          height: 20px;
          stroke: currentColor;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 20px;
        }

        .panel-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: var(--shadow-sm);
        }

        .panel-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
        }

        .panel-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .panel-card-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--primary-glow);
          color: var(--primary);
          flex-shrink: 0;
        }

        .panel-card-icon svg {
          width: 16px;
          height: 16px;
          stroke: currentColor;
        }

        .panel-card-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-pill.healthy {
          background: var(--status-hijau-bg);
          color: var(--status-hijau);
        }

        .status-pill.danger {
          background: var(--status-merah-bg);
          color: var(--status-merah);
        }

        .status-pill.warning {
          background: var(--status-kuning-bg);
          color: var(--status-kuning);
        }

        .router-grid {
          display: grid;
          gap: 10px;
        }

        .router-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .router-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .router-row span {
          color: var(--text-secondary);
          font-size: 0.86rem;
        }

        .router-row strong {
          color: var(--text-primary);
          font-size: 0.86rem;
          text-align: right;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .activity-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .activity-item:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .activity-item span {
          color: var(--text-secondary);
          font-size: 0.86rem;
        }

        .activity-item strong {
          color: var(--text-primary);
          font-size: 0.86rem;
        }

        .topology-card {
          overflow: hidden;
          position: relative;
        }

        .topology-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 20px 0;
          min-height: 480px;
          position: relative;
          background-image: radial-gradient(var(--border-color-light) 1px, transparent 1px);
          background-size: 20px 20px;
          border-radius: 10px;
          border: 1px solid var(--border-color-light);
        }

        .topology-row {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          z-index: 2;
        }

        .topology-endpoints-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 20px;
          width: 100%;
          max-width: 900px;
          padding: 0 20px;
          justify-items: center;
        }

        .network-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          cursor: pointer;
          transition: transform 0.2s ease, filter 0.2s ease;
          z-index: 3;
          padding: 8px 6px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(225, 227, 228, 0.8);
        }

        .network-node:hover {
          transform: translateY(-4px);
        }

        .node-icon-wrapper {
          width: 68px;
          height: 68px;
          border-radius: 18px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          position: relative;
          transition: all 0.3s ease;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
        }

        .network-node.online .node-icon-wrapper {
          border-color: var(--primary);
          box-shadow: 0 0 15px rgba(0, 104, 118, 0.14);
        }

        .network-node.offline .node-icon-wrapper {
          border-color: var(--border-color);
          opacity: 0.7;
        }

        .network-node.warning .node-icon-wrapper {
          border-color: var(--status-merah);
          box-shadow: 0 0 15px rgba(186, 26, 26, 0.18);
          animation: pulse-border-red 2s infinite;
        }

        .node-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 4px;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: -0.01em;
        }

        .node-sublabel {
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        .topology-svg-connections {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          overflow: visible;
        }

        .topology-connector {
          fill: none;
          stroke-width: 2.4;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
        }

        .status-dot-pulse {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          z-index: 3;
        }

        .status-dot-pulse.green {
          background-color: var(--status-hijau);
          box-shadow: 0 0 8px var(--status-hijau);
          animation: pulse-green 1.5s infinite;
        }

        .status-dot-pulse.red {
          background-color: var(--status-merah);
          box-shadow: 0 0 8px var(--status-merah);
          animation: pulse-red 1.5s infinite;
        }

        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(15, 157, 91, 0.6); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(15, 157, 91, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(15, 157, 91, 0); }
        }

        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(186, 26, 26, 0.6); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(186, 26, 26, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(186, 26, 26, 0); }
        }

        @keyframes pulse-border-red {
          0% { border-color: rgba(186, 26, 26, 0.4); }
          50% { border-color: rgba(186, 26, 26, 1); }
          100% { border-color: rgba(186, 26, 26, 0.4); }
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Selamat datang kembali! Berikut ringkasan aktivitas pelanggan dan status jaringan.</p>
        </div>
      </div>

      <div className="dashboard-shell">
        <section className="dashboard-hero animate-fadeIn">
          <div>
            <div className="hero-badge">Realtime Monitoring</div>
            <h1>Ringkasan operasi jaringan</h1>
            <p>Monitor koneksi PPPoE, status router, dan pelanggan aktif dari satu tampilan yang lebih rapi dan mudah dibaca.</p>
          </div>
          <div className="dashboard-hero-stats">
            <div className="dashboard-hero-stat">
              <small>Router</small>
              <strong>{routerStatus.online ? 'Online' : 'Offline'}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <small>Sesi aktif</small>
              <strong>{pppoeSummary.active_count}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <small>Perlu cek</small>
              <strong>{pppoeSummary.unregistered_count}</strong>
            </div>
          </div>
        </section>

        <div className="stats-grid">
          {statCards.map(function (card, idx) {
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

        <div className="overview-grid">
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <div className="panel-card-title">
                  <span className="panel-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="M8 20h8" />
                      <path d="M12 18v2" />
                    </svg>
                  </span>
                  <span>Status router & koneksi</span>
                </div>
                <div className="panel-card-subtitle">Informasi singkat dari Mikrotik</div>
              </div>
              <span className={'status-pill ' + routerBadgeClass}>
                {routerStatus.online ? '● Online' : '● Offline'}
              </span>
            </div>
            <div className="router-grid">
              <div className="router-row">
                <span>Model</span>
                <strong>{routerStatus.online ? routerStatus.board : 'Tidak terhubung'}</strong>
              </div>
              <div className="router-row">
                <span>Versi RouterOS</span>
                <strong>{routerStatus.online ? routerStatus.version : routerStatus.error || '—'}</strong>
              </div>
              <div className="router-row">
                <span>PPPoE aktif</span>
                <strong>{pppoeSummary.active_count} sesi</strong>
              </div>
              <div className="router-row">
                <span>Perlu verifikasi</span>
                <strong>{pppoeSummary.unregistered_count} user</strong>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <div className="panel-card-title">
                  <span className="panel-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 6h12" />
                      <path d="M8 12h12" />
                      <path d="M8 18h12" />
                      <path d="M4 6h.01" />
                      <path d="M4 12h.01" />
                      <path d="M4 18h.01" />
                    </svg>
                  </span>
                  <span>Aktivitas terbaru</span>
                </div>
                <div className="panel-card-subtitle">Riwayat singkat operasi</div>
              </div>
            </div>
            <div className="activity-list">
              <div className="activity-item">
                <span>Pelanggan aktif</span>
                <strong>{activeCustomers.length}</strong>
              </div>
              <div className="activity-item">
                <span>Offline / terisolir</span>
                <strong>{inactiveCustomers.length}</strong>
              </div>
              <div className="activity-item">
                <span>Unregistered</span>
                <strong>{unregisteredActive.length}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="topology-card panel-card animate-fadeIn" style={{ animationDelay: '0.15s' }}>
          <div className="panel-card-header">
            <div>
              <div className="panel-card-title">
                <span className="panel-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <path d="M10 7h2" />
                    <path d="M10 17h2" />
                    <path d="M7 10v2" />
                    <path d="M17 10v2" />
                  </svg>
                </span>
                <span>Peta topologi jaringan</span>
              </div>
              <div className="panel-card-subtitle">Status session & perangkat terhubung real-time dari Mikrotik</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }} /> Aktif ({activeCustomers.length})</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--text-muted)', borderRadius: '50%' }} /> Nonaktif ({inactiveCustomers.length})</span>
              {unregisteredActive.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', animation: 'pulse-red 1s infinite' }} /> Unregistered ({unregisteredActive.length})</span>
              )}
            </div>
          </div>

          <div className="topology-container" ref={containerRef}>
            <div className="topology-row" style={{ marginBottom: '10px' }}>
              <div id="router-node" className={`network-node ${routerStatus.online ? 'online' : 'offline'}`} title={`Mikrotik Router Gateway IP: ${routerStatus.online ? '192.168.50.1' : 'Offline'}`}>
                {routerStatus.online && <span className="status-dot-pulse green" />}
                {!routerStatus.online && <span className="status-dot-pulse red" />}
                <div className="node-icon-wrapper" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={routerStatus.online ? 'var(--success)' : 'var(--text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2v20M2 12h20" />
                    <path d="M12 6l-2-2-2 2M12 18l2 2 2-2M6 12l-2-2-2 2M18 12l2 2 2-2" />
                  </svg>
                </div>
                <span className="node-label">Gateway Router</span>
                <span className="node-sublabel">{routerStatus.online ? routerStatus.board : 'Offline'}</span>
              </div>
            </div>

            <div className="topology-row" style={{ marginBottom: '24px' }}>
              <div id="switch-node" className={`network-node ${routerStatus.online ? 'online' : 'offline'}`}>
                <div className="node-icon-wrapper" style={{ width: '70px', height: '42px', borderRadius: '6px', background: 'linear-gradient(135deg, #334155, #1e293b)' }}>
                  <svg width="36" height="18" viewBox="0 0 24 12" fill="none" stroke={routerStatus.online ? 'var(--primary-light)' : 'var(--text-muted)'} strokeWidth="1.5">
                    <rect x="1" y="1" width="22" height="10" rx="1" />
                    <path d="M4 6h16M4 6l2-2M20 6l-2 2" />
                  </svg>
                </div>
                <span className="node-label">Core Switch CSW1</span>
                <span className="node-sublabel">24-Port Gigabit</span>
              </div>
            </div>

            <svg className="topology-svg-connections">
              {routerLine && (
                <path
                  className="topology-connector"
                  d={routerLine.pathD}
                  style={{ stroke: routerLine.color }}
                />
              )}

              {clientLines.map(function (line, idx) {
                var color = line.status === 'up' ? '#22C55E' : (line.status === 'warning' ? '#EF4444' : '#6B7280');
                var stroke = line.status === 'up' ? '#22C55E' : (line.status === 'warning' ? '#EF4444' : 'var(--border-color)');
                return (
                  <g key={'client-line-' + idx}>
                    <path
                      className="topology-connector"
                      d={line.pathD}
                      style={{
                        stroke: stroke,
                        opacity: line.status === 'down' ? 0.35 : 1
                      }}
                    />
                    <circle cx={line.x1} cy={line.y1 + 8} r="3.5" fill={routerStatus.online ? '#22C55E' : '#EF4444'} />
                    <circle cx={line.x2} cy={line.y2 - 6} r="3.5" fill={color} />
                  </g>
                );
              })}
            </svg>

            <div className="topology-row">
              {loading ? (
                <div style={{ color: 'var(--text-muted)' }}>Memetakan perangkat klien...</div>
              ) : (
                <div className="topology-endpoints-grid">
                  {activeCustomers.map(function (cust) {
                    return (
                      <div key={cust.id_pelanggan} className="network-node client-node online" title={`Nama: ${cust.nama}\nPPPoE: ${cust.pppoe_username}\nPaket: ${cust.paket}\nStatus: Aktif Online`}>
                        <span className="status-dot-pulse green" />
                        <div className="node-icon-wrapper">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                        </div>
                        <span className="node-label">{cust.nama}</span>
                        <span className="node-sublabel" style={{ color: 'var(--success)' }}>Active (PPPoE)</span>
                      </div>
                    );
                  })}

                  {unregisteredActive.map(function (conn, idx) {
                    return (
                      <div key={'unreg-' + idx} className="network-node client-node warning" title={`PPPoE User: ${conn.name}\nIP: ${conn.address}\nUptime: ${conn.uptime}\nWARNING: Tidak terdaftar di sistem!`}>
                        <span className="status-dot-pulse red" />
                        <div className="node-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 16V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11" />
                            <path d="M2 21h20" />
                          </svg>
                        </div>
                        <span className="node-label" style={{ color: 'var(--danger)' }}>{conn.name}</span>
                        <span className="node-sublabel" style={{ color: 'var(--danger)', fontWeight: 600 }}>Unregistered!</span>
                      </div>
                    );
                  })}

                  {inactiveCustomers.map(function (cust) {
                    return (
                      <div key={cust.id_pelanggan} className="network-node client-node offline" title={`Nama: ${cust.nama}\nPPPoE: ${cust.pppoe_username}\nPaket: ${cust.paket}\nStatus: Terisolir / Offline`}>
                        <div className="node-icon-wrapper">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                        </div>
                        <span className="node-label">{cust.nama}</span>
                        <span className="node-sublabel">Offline</span>
                      </div>
                    );
                  })}

                  {customers.length === 0 && unregisteredActive.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', gridColumn: '1 / -1' }}>
                      Tidak ada perangkat klien yang terdeteksi.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

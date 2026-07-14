import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

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
        var swY_top = swRect.top - containerRect.top;

        setRouterLine({
          x1: routerX,
          y1: routerY,
          x2: swX,
          y2: swY_top,
          color: routerStatus.online ? '#22C55E' : '#EF4444'
        });
      } else {
        setRouterLine(null);
      }

      if (switchNode && clientNodes.length > 0) {
        var swRect = switchNode.getBoundingClientRect();
        var swX = swRect.left - containerRect.left + swRect.width / 2;
        var swY_bottom = swRect.top - containerRect.top + swRect.height;

        var newLines = Array.from(clientNodes).map(function (node) {
          var cRect = node.getBoundingClientRect();
          var isOnline = node.classList.contains('online');
          var isWarning = node.classList.contains('warning');
          var status = isOnline ? 'up' : (isWarning ? 'warning' : 'down');
          var x2 = cRect.left - containerRect.left + cRect.width / 2;
          var y2 = cRect.top - containerRect.top + 8;

          return {
            x1: swX,
            y1: swY_bottom,
            x2: x2,
            y2: y2,
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
      var response = await axios.get(`${API_BASE_URL}/api/pelanggan/stats`, {
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
      var statusRes = await axios.get(`${API_BASE_URL}/api/mikrotik/status`, { headers: headers });
      setRouterStatus(statusRes.data.data);
    } catch (err) {
      console.error('Gagal mengambil status router:', err);
    }
  }

  async function fetchCustomers() {
    try {
      var token = localStorage.getItem('token');
      var response = await axios.get(`${API_BASE_URL}/api/pelanggan`, {
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
          font-family: 'Nunito', 'Inter', sans-serif;
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
          border-radius: var(--radius-md);
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
          min-height: 440px;
          position: relative;
          background-image: radial-gradient(var(--border-color-light) 1px, transparent 1px);
          background-size: 20px 20px;
          border-radius: var(--radius-lg);
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
        }

        .network-node:hover {
          transform: translateY(-4px);
        }

        .node-icon-wrapper {
          width: 68px;
          height: 68px;
          border-radius: var(--radius-xl);
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

        /* Cisco Packet Tracer Styled Topology Map Styles */
        .topology-header-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-secondary);
          padding: 3px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
        }

        .topology-tab-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .topology-tab-btn.active {
          background: var(--bg-card);
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .topology-canvas-wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--border-color-light);
          border-radius: var(--radius-lg);
          background-color: #fcfdfe;
          background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px);
          background-size: 24px 24px;
          margin-top: 10px;
          -webkit-overflow-scrolling: touch;
        }

        .topology-canvas {
          position: relative;
          width: 800px;
          height: 440px;
        }

        .cisco-node {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          cursor: pointer;
          user-select: none;
          transition: transform 0.2s ease;
          width: 120px;
          z-index: 5;
        }

        .cisco-node:hover {
          transform: scale(1.05);
        }

        .cisco-node-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 60px;
          width: 80px;
          position: relative;
        }

        .cisco-labels {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 4px;
          font-family: 'Consolas', 'Courier New', monospace;
        }

        .cisco-label-model {
          font-size: 0.72rem;
          color: #475569;
          font-weight: 500;
        }

        .cisco-label-name {
          font-size: 0.76rem;
          color: #0f172a;
          font-weight: 700;
          margin-top: -2px;
        }

        .cisco-label-ip {
          font-size: 0.7rem;
          color: #1e293b;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 1px 4px;
          border-radius: 2px;
          margin-top: 3px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .ping-packet-dot {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 0 12px rgba(0,0,0,0.3);
          pointer-events: none;
          z-index: 10;
          transform: translate(-50%, -50%);
          transition: left 450ms linear, top 450ms linear;
        }

        .ping-packet-dot.request {
          background: #f59e0b;
          box-shadow: 0 0 12px #f59e0b;
        }

        .ping-packet-dot.reply {
          background: #06b6d4;
          box-shadow: 0 0 12px #06b6d4;
        }

        /* Terminal Console styles */
        .topology-terminal-panel {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: var(--radius-lg);
          margin-top: 15px;
          overflow: hidden;
          font-family: 'Consolas', 'Courier New', monospace;
          box-shadow: var(--shadow-md);
        }

        .terminal-header {
          background: #141b2d;
          padding: 8px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #1e293b;
        }

        .terminal-title {
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .terminal-close-btn {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 1.2rem;
          cursor: pointer;
          transition: color var(--transition-fast);
        }

        .terminal-close-btn:hover {
          color: #ef4444;
        }

        .terminal-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .terminal-logs {
          background: #020612;
          border: 1px solid #1e293b;
          border-radius: var(--radius-md);
          padding: 12px;
          height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .terminal-log-line {
          color: #f1f5f9;
          font-size: 0.82rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .terminal-cursor-line {
          display: flex;
          align-items: center;
        }

        .cursor-indicator {
          display: inline-block;
          width: 8px;
          height: 14px;
          background: #38bdf8;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        .terminal-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .terminal-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .terminal-actions span {
          color: #94a3b8;
          font-size: 0.82rem;
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
              <div className="panel-card-subtitle">
                Status session & perangkat terhubung real-time dari Mikrotik
              </div>
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
              <div id="router-node" className={`network-node ${routerStatus.online ? 'online' : 'offline'}`} title={`Mikrotik Router Gateway IP: ${routerStatus.online ? '192.168.50.1' : 'Offline'}`} style={{ border: 'none', background: 'transparent', backdropFilter: 'none' }}>
                <div style={{ position: 'relative' }}>
                  <CiscoRouterIcon online={routerStatus.online} width={70} height={46} />
                  {routerStatus.online && <span className="status-dot-pulse green" style={{ top: '-4px', right: '-4px' }} />}
                  {!routerStatus.online && <span className="status-dot-pulse red" style={{ top: '-4px', right: '-4px' }} />}
                </div>
                <span className="node-label" style={{ marginTop: '8px' }}>Gateway Router</span>
                <span className="node-sublabel">{routerStatus.online ? routerStatus.board : 'Offline'}</span>
              </div>
            </div>

            <div className="topology-row" style={{ marginBottom: '24px' }}>
              <div id="switch-node" className={`network-node ${routerStatus.online ? 'online' : 'offline'}`} style={{ border: 'none', background: 'transparent', backdropFilter: 'none' }}>
                <CiscoSwitchIcon online={routerStatus.online} width={80} height={46} />
                <span className="node-label" style={{ marginTop: '8px' }}>Core Switch CSW1</span>
                <span className="node-sublabel">24-Port Gigabit</span>
              </div>
            </div>

            <svg className="topology-svg-connections">
              {routerLine && renderCiscoLink(routerLine.x1, routerLine.y1, routerLine.x2, routerLine.y2, routerStatus.online)}

              {clientLines.map(function (line, idx) {
                var isLinkActive = line.status === 'up';
                return (
                  <g key={'client-line-' + idx}>
                    {renderCiscoLink(line.x1, line.y1, line.x2, line.y2, isLinkActive)}
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
                      <div key={cust.id_pelanggan} className="network-node client-node online" title={`Nama: ${cust.nama}\nPPPoE: ${cust.pppoe_username}\nPaket: ${cust.paket}\nStatus: Aktif Online`} style={{ border: 'none', background: 'transparent', backdropFilter: 'none' }}>
                        <div style={{ position: 'relative' }}>
                          <CiscoPCIcon online={true} />
                          <span className="status-dot-pulse green" style={{ top: '-2px', right: '-2px' }} />
                        </div>
                        <span className="node-label" style={{ marginTop: '8px' }}>{cust.nama}</span>
                        <span className="node-sublabel" style={{ color: 'var(--success)' }}>Active (PPPoE)</span>
                      </div>
                    );
                  })}

                  {unregisteredActive.map(function (conn, idx) {
                    return (
                      <div key={'unreg-' + idx} className="network-node client-node warning" title={`PPPoE User: ${conn.name}\nIP: ${conn.address}\nUptime: ${conn.uptime}\nWARNING: Tidak terdaftar di sistem!`} style={{ border: 'none', background: 'transparent', backdropFilter: 'none' }}>
                        <div style={{ position: 'relative' }}>
                          <CiscoPCIcon online={true} />
                          <span className="status-dot-pulse red" style={{ top: '-2px', right: '-2px' }} />
                        </div>
                        <span className="node-label" style={{ color: 'var(--danger)', marginTop: '8px' }}>{conn.name}</span>
                        <span className="node-sublabel" style={{ color: 'var(--danger)', fontWeight: 600 }}>Unregistered!</span>
                      </div>
                    );
                  })}

                  {inactiveCustomers.map(function (cust) {
                    return (
                      <div key={cust.id_pelanggan} className="network-node client-node offline" title={`Nama: ${cust.nama}\nPPPoE: ${cust.pppoe_username}\nPaket: ${cust.paket}\nStatus: Terisolir / Offline`} style={{ border: 'none', background: 'transparent', backdropFilter: 'none' }}>
                        <CiscoPCIcon online={false} />
                        <span className="node-label" style={{ marginTop: '8px' }}>{cust.nama}</span>
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

// ============================================================================
// Cisco Packet Tracer Style SVG Icons
// ============================================================================

function CiscoRouterIcon({ width = 60, height = 40, online = true }) {
  var topColorStart = online ? "#4ba3e3" : "#cbd5e1";
  var topColorEnd = online ? "#1b75bb" : "#94a3b8";
  var bodyColorStart = online ? "#1266a5" : "#64748b";
  var bodyColorEnd = online ? "#0c4b7a" : "#475569";
  var strokeColor = online ? "#175e96" : "#475569";
  
  return (
    <svg width={width} height={height} viewBox="0 0 80 50" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`routerTopGrad-${online}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={topColorStart} />
          <stop offset="100%" stopColor={topColorEnd} />
        </linearGradient>
        <linearGradient id={`routerBodyGrad-${online}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={bodyColorStart} />
          <stop offset="100%" stopColor={bodyColorEnd} />
        </linearGradient>
      </defs>
      <path d="M 5,20 L 5,38 A 35,12 0 0 0 75,38 L 75,20 Z" fill={`url(#routerBodyGrad-${online})`} stroke={strokeColor} strokeWidth="1" />
      <ellipse cx="40" cy="20" rx="35" ry="12" fill={`url(#routerTopGrad-${online})`} stroke={strokeColor} strokeWidth="1" />
      <ellipse cx="40" cy="20" rx="35" ry="12" fill="none" stroke="#ffffff" strokeWidth="1.5" style={{ opacity: 0.3 }} />
      
      {/* 4 Arrows on top */}
      <g transform="translate(40, 20) scale(0.9)" opacity="0.9">
        <line x1="-18" y1="-5" x2="18" y2="5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="-18" y1="5" x2="18" y2="-5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="-18,-5 -12,-7 -14,-2" fill="#ffffff" />
        <polygon points="18,5 12,7 14,2" fill="#ffffff" />
        <polygon points="-18,5 -12,7 -14,2" fill="#ffffff" />
        <polygon points="18,-5 12,-7 14,-2" fill="#ffffff" />
      </g>
    </svg>
  );
}

function CiscoSwitchIcon({ width = 70, height = 40, online = true }) {
  var topStart = online ? "#3d8ec7" : "#cbd5e1";
  var topEnd = online ? "#1e6b9e" : "#94a3b8";
  var frontStart = online ? "#185987" : "#64748b";
  var frontEnd = online ? "#0c3d5f" : "#475569";
  var sideColor = online ? "#154e77" : "#334155";
  var strokeColor = online ? "#09273d" : "#334155";

  return (
    <svg width={width} height={height} viewBox="0 0 80 46" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`switchTopGrad-${online}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={topStart} />
          <stop offset="100%" stopColor={topEnd} />
        </linearGradient>
        <linearGradient id={`switchFrontGrad-${online}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={frontStart} />
          <stop offset="100%" stopColor={frontEnd} />
        </linearGradient>
      </defs>
      
      <path d="M 15,10 L 55,10 L 68,20 L 28,20 Z" fill={`url(#switchTopGrad-${online})`} stroke={strokeColor} strokeWidth="0.75" />
      <path d="M 28,20 L 68,20 L 68,34 L 28,34 Z" fill={`url(#switchFrontGrad-${online})`} stroke={strokeColor} strokeWidth="0.75" />
      <path d="M 15,10 L 28,20 L 28,34 L 15,24 Z" fill={sideColor} stroke={strokeColor} strokeWidth="0.75" />
      
      {/* Port Grid */}
      <g transform="translate(32, 22)" opacity={online ? 0.9 : 0.4}>
        <rect x="1" y="2" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="5" y="2" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="9" y="2" width="2" height="2" fill={online ? "#eab308" : "#475569"} />
        <rect x="13" y="2" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="17" y="2" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="21" y="2" width="2" height="2" fill="#475569" />
        <rect x="25" y="2" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="29" y="2" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        
        <rect x="1" y="6" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="5" y="6" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="9" y="6" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="13" y="6" width="2" height="2" fill="#475569" />
        <rect x="17" y="6" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="21" y="6" width="2" height="2" fill={online ? "#22c55e" : "#475569"} />
        <rect x="25" y="6" width="2" height="2" fill={online ? "#eab308" : "#475569"} />
        <rect x="29" y="6" width="2" height="2" fill="#475569" />
      </g>
      
      <g transform="translate(30, 12) scale(0.65)" opacity="0.8">
        <path d="M 5,2 L 25,2 M 5,2 L 9,-1 M 5,2 L 9,5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 5,8 L 25,8 M 25,8 L 21,5 M 25,8 L 21,11" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function CiscoPCIcon({ width = 50, height = 42, online = true }) {
  var screenColorStart = online ? "#a0c4ff" : "#cbd5e1";
  var screenColorEnd = online ? "#4a90e2" : "#94a3b8";
  var bezelStart = "#f1f5f9";
  var bezelEnd = "#cbd5e1";
  var towerColorStart = "#cbd5e1";
  var towerColorEnd = "#94a3b8";
  var keyColor = online ? "#22c55e" : "#64748b";

  return (
    <svg width={width} height={height} viewBox="0 0 60 50" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`pcScreen-${online}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={screenColorStart} />
          <stop offset="100%" stopColor={screenColorEnd} />
        </linearGradient>
        <linearGradient id="pcBezel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={bezelStart} />
          <stop offset="100%" stopColor={bezelEnd} />
        </linearGradient>
        <linearGradient id="pcTower" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={towerColorStart} />
          <stop offset="100%" stopColor={towerColorEnd} />
        </linearGradient>
      </defs>
      
      <rect x="43" y="10" width="11" height="28" rx="1" fill="url(#pcTower)" stroke="#475569" strokeWidth="0.5" />
      <line x1="45" y1="13" x2="52" y2="13" stroke="#475569" strokeWidth="1.2" />
      <line x1="45" y1="16" x2="52" y2="16" stroke="#475569" strokeWidth="1.2" />
      <circle cx="48" cy="30" r="1.5" fill={keyColor} />
      
      <rect x="6" y="8" width="34" height="24" rx="2" fill="url(#pcBezel)" stroke="#475569" strokeWidth="0.75" />
      <rect x="9" y="11" width="28" height="18" rx="0.5" fill={`url(#pcScreen-${online})`} stroke="#1e40af" strokeWidth="0.5" />
      <path d="M 9,11 L 28,11 L 9,23 Z" fill="#ffffff" style={{ opacity: 0.15 }} />
      
      <path d="M 21,32 L 25,32 L 26,37 L 20,37 Z" fill="#64748b" stroke="#475569" strokeWidth="0.5" />
      <ellipse cx="23" cy="37" rx="7" ry="2" fill="#475569" />

      <path d="M 8,40 L 38,40 L 40,46 L 6,46 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
      <line x1="10" y1="42" x2="36" y2="42" stroke="#64748b" strokeWidth="1" strokeDasharray="2,1" />
      <line x1="8" y1="44" x2="38" y2="44" stroke="#64748b" strokeWidth="1" strokeDasharray="2,1.5" />
    </svg>
  );
}

function renderCiscoLink(x1, y1, x2, y2, isActive = true) {
  var angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  var dist = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  if (dist === 0) return null;
  
  var offsetStart = 4;
  var offsetEnd = 4;
  
  var startX = x1 + (offsetStart / dist) * (x2 - x1);
  var startY = y1 + (offsetStart / dist) * (y2 - y1);
  var endX = x2 - (offsetEnd / dist) * (x2 - x1);
  var endY = y2 - (offsetEnd / dist) * (y2 - y1);
  
  var light1X = startX + 0.25 * (endX - startX);
  var light1Y = startY + 0.25 * (endY - startY);
  var light2X = startX + 0.75 * (endX - startX);
  var light2Y = startY + 0.75 * (endY - startY);
  
  var color = isActive ? "#0f9d5b" : "#ba1a1a";
  
  return (
    <g>
      <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#27272a" strokeWidth="2.5" />
      <polygon
        points="-5,4 0,-6 5,4"
        fill={color}
        transform={`translate(${light1X}, ${light1Y}) rotate(${angle + 90})`}
        style={{ filter: isActive ? 'drop-shadow(0 0 3px rgba(15, 157, 91, 0.8))' : 'none' }}
      />
      <polygon
        points="-5,4 0,-6 5,4"
        fill={color}
        transform={`translate(${light2X}, ${light2Y}) rotate(${angle - 90})`}
        style={{ filter: isActive ? 'drop-shadow(0 0 3px rgba(15, 157, 91, 0.8))' : 'none' }}
      />
    </g>
  );
}

export default DashboardPage;

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
  var [customers, setCustomers] = useState([]);
  var [routerStatus, setRouterStatus] = useState({ online: false, error: 'Memuat...' });
  var [pppoeSummary, setPppoeSummary] = useState({ active_count: 0, unregistered_count: 0, unregistered_list: [] });
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    fetchStats();
    fetchRouterInfo();
    fetchCustomers();

    if (socket) {
      socket.on('mikrotik_ping', function(pingData) {
        setRouterStatus(pingData);
      });

      socket.on('pppoe_summary', function(summary) {
        setPppoeSummary(summary);
      });

      socket.on('pelanggan_updated', function(data) {
        fetchStats();
        // Update customer PPPoE status dynamically in state
        setCustomers(function(prev) {
          return prev.map(function(c) {
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

  // Grouping customers for the topology display
  var activeCustomers = customers.filter(c => c.pppoe_status === 'active');
  var inactiveCustomers = customers.filter(c => c.pppoe_status === 'inactive' || c.pppoe_status === 'unknown');
  var unregisteredActive = pppoeSummary.unregistered_list || [];

  return (
    <div>
      {/* Topology Styles */}
      <style>{`
        /* Styles khusus peta topologi jaringan */
        .topology-card {
          margin-top: 24px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 24px;
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
          border-radius: 8px;
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
        }

        .network-node:hover {
          transform: translateY(-4px);
        }

        .node-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          position: relative;
          transition: all 0.3s ease;
        }

        .network-node.online .node-icon-wrapper {
          border-color: var(--success);
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.2);
        }

        .network-node.offline .node-icon-wrapper {
          border-color: var(--text-muted);
          opacity: 0.6;
        }

        .network-node.warning .node-icon-wrapper {
          border-color: var(--danger);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
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
        }

        .node-sublabel {
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        /* SVG Connection Lines Overlay */
        .topology-svg-connections {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .link-line {
          stroke: var(--border-color);
          stroke-width: 2;
          stroke-dasharray: 4,4;
          fill: none;
          transition: stroke 0.3s ease, stroke-width 0.3s ease;
        }

        .link-line.active {
          stroke: var(--success);
          stroke-width: 2.5;
          stroke-dasharray: 6;
          animation: flow-dash 15s linear infinite;
        }

        .link-line.unregistered {
          stroke: var(--danger);
          stroke-width: 2.5;
          stroke-dasharray: 4;
          animation: flow-dash-reverse 10s linear infinite;
        }

        /* Pulsing lights */
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
          background-color: var(--success);
          box-shadow: 0 0 8px var(--success);
          animation: pulse-green 1.5s infinite;
        }

        .status-dot-pulse.red {
          background-color: var(--danger);
          box-shadow: 0 0 8px var(--danger);
          animation: pulse-red 1.5s infinite;
        }

        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        @keyframes pulse-border-red {
          0% { border-color: rgba(239, 68, 68, 0.5); }
          50% { border-color: rgba(239, 68, 68, 1); }
          100% { border-color: rgba(239, 68, 68, 0.5); }
        }

        @keyframes flow-dash {
          to { stroke-dashoffset: -100; }
        }

        @keyframes flow-dash-reverse {
          to { stroke-dashoffset: 100; }
        }
      `}</style>

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

      {/* Real-time Network Topology Map Card */}
      <div className="topology-card animate-fadeIn" style={{ animationDelay: '0.15s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>🌐 Peta Topologi Jaringan</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status active session & perangkat terhubung real-time dari Mikrotik</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }} /> Aktif ({activeCustomers.length})</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--text-muted)', borderRadius: '50%' }} /> Nonaktif ({inactiveCustomers.length})</span>
            {unregisteredActive.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', animation: 'pulse-red 1s infinite' }} /> Unregistered ({unregisteredActive.length})</span>
            )}
          </div>
        </div>

        <div className="topology-container">
          {/* Level 1: Mikrotik Router */}
          <div className="topology-row" style={{ marginBottom: '10px' }}>
            <div className={`network-node ${routerStatus.online ? 'online' : 'offline'}`} title={`Mikrotik Router Gateway IP: ${routerStatus.online ? '192.168.50.1' : 'Offline'}`}>
              {routerStatus.online && <span className="status-dot-pulse green" />}
              {!routerStatus.online && <span className="status-dot-pulse red" />}
              <div className="node-icon-wrapper" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
                {/* Cisco Router SVG Icon */}
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

          {/* Level 2: Access Switch (CSW1) */}
          <div className="topology-row" style={{ marginBottom: '24px' }}>
            <div className={`network-node ${routerStatus.online ? 'online' : 'offline'}`}>
              <div className="node-icon-wrapper" style={{ width: '70px', height: '42px', borderRadius: '6px', background: 'linear-gradient(135deg, #334155, #1e293b)' }}>
                {/* Cisco Switch Icon */}
                <svg width="36" height="18" viewBox="0 0 24 12" fill="none" stroke={routerStatus.online ? 'var(--primary-light)' : 'var(--text-muted)'} strokeWidth="1.5">
                  <rect x="1" y="1" width="22" height="10" rx="1" />
                  <path d="M4 6h16M4 6l2-2M20 6l-2 2" />
                </svg>
              </div>
              <span className="node-label">Core Switch CSW1</span>
              <span className="node-sublabel">24-Port Gigabit</span>
            </div>
          </div>

          {/* Connection Lines (Gateway -> Switch -> Endpoints) */}
          <svg className="topology-svg-connections">
            {/* Connection: Gateway to Switch */}
            <line 
              x1="50%" y1="78" 
              x2="50%" y2="148" 
              className={`link-line ${routerStatus.online ? 'active' : ''}`}
            />
            {/* We will draw connectors from the Switch (located at x:50%, y:166) to the endpoints below */}
          </svg>

          {/* Level 3: Client Endpoints */}
          <div className="topology-row">
            {loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Memetakan perangkat klien...</div>
            ) : (
              <div className="topology-endpoints-grid">
                
                {/* 1. Render Active PPPoE Registered Clients */}
                {activeCustomers.map(function(cust) {
                  return (
                    <div key={cust.id_pelanggan} className="network-node online" title={`Nama: ${cust.nama}\nPPPoE: ${cust.pppoe_username}\nPaket: ${cust.paket}\nStatus: Aktif Online`}>
                      <span className="status-dot-pulse green" />
                      <div className="node-icon-wrapper">
                        {/* Computer SVG */}
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

                {/* 2. Render Unregistered Active Secrets (Warning Red PCs) */}
                {unregisteredActive.map(function(conn, idx) {
                  return (
                    <div key={'unreg-' + idx} className="network-node warning" title={`PPPoE User: ${conn.name}\nIP: ${conn.address}\nUptime: ${conn.uptime}\nWARNING: Tidak terdaftar di sistem!`}>
                      <span className="status-dot-pulse red" />
                      <div className="node-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                        {/* Laptop SVG Alert */}
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

                {/* 3. Render Offline / Inactive Registered Customers */}
                {inactiveCustomers.map(function(cust) {
                  return (
                    <div key={cust.id_pelanggan} className="network-node offline" title={`Nama: ${cust.nama}\nPPPoE: ${cust.pppoe_username}\nPaket: ${cust.paket}\nStatus: Terisolir / Offline`}>
                      <div className="node-icon-wrapper">
                        {/* Computer SVG Grey */}
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

                {/* Case when there are no client nodes at all */}
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

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '24px' }}>
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

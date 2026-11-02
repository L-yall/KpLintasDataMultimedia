import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import TemplateIcon from '../TemplateIcon';

function SuperAdminNocDashboard({ socket, admin }) {
  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  // Financial Overview States (Finance Super Admin)
  var [finSummary, setFinSummary] = useState({ total_pemasukan: 0, total_pengeluaran: 0, laba_bersih: 0, total_menunggu: 0 });
  var [financeLoading, setFinanceLoading] = useState(true);

  var formatUang = function (val) {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  var fetchFinanceSummary = async function () {
    try {
      var today = new Date();
      var currentMonthStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
      var res = await axios.get(API_BASE_URL + '/api/reports/summary?periode=' + currentMonthStr, { headers });
      if (res.data.success) {
        var data = res.data.data;
        if (data.total_pemasukan === 0 && data.total_pengeluaran === 0 && today.getDate() <= 3) {
          var y = today.getFullYear();
          var m = today.getMonth(); // 0-indexed: previous month
          if (m === 0) { m = 12; y--; }
          var prevMonthStr = y + '-' + String(m).padStart(2, '0');
          var prevRes = await axios.get(API_BASE_URL + '/api/reports/summary?periode=' + prevMonthStr, { headers });
          if (prevRes.data.success && (prevRes.data.data.total_pemasukan > 0 || prevRes.data.data.total_pengeluaran > 0)) {
            setFinSummary(prevRes.data.data);
            setFinanceLoading(false);
            return;
          }
        }
        setFinSummary(data);
      }
    } catch (e) {
      console.error('Gagal mengambil data ringkasan finansial superadmin:', e);
    } finally {
      setFinanceLoading(false);
    }
  };

  // Telemetry States
  var [resources, setResources] = useState(null);
  var [interfaces, setInterfaces] = useState([]);
  var [logs, setLogs] = useState([]);
  var [interfaceSource, setInterfaceSource] = useState('unknown');
  var [logSource, setLogSource] = useState('unknown');
  var [interfaceError, setInterfaceError] = useState(null);
  var [logError, setLogError] = useState(null);
  var [serverHealth, setServerHealth] = useState(null);
  var [activeSessions, setActiveSessions] = useState([]);
  var [unregistered, setUnregistered] = useState([]);
  var [customers, setCustomers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [syncing, setSyncing] = useState(false);
  var [syncMessage, setSyncMessage] = useState(null);

  // Filters & Controls
  var [logFilter, setLogFilter] = useState('all');
  var [pingResult, setPingResult] = useState(null);
  var [pinging, setPinging] = useState(false);
  var [kickLoading, setKickLoading] = useState(null);

  var terminalRef = useRef(null);

  // Fetch all IT Telemetry Data
  var fetchAllTelemetry = async function () {
    try {
      var [resData, ifData, logData, healthData, activeData, unregData, custData] = await Promise.all([
        axios.get(API_BASE_URL + '/api/mikrotik/resources', { headers }).catch(e => ({ data: { success: false, data: null } })),
        axios.get(API_BASE_URL + '/api/mikrotik/interfaces', { headers }).catch(e => ({ data: { success: false, data: [] } })),
        axios.get(API_BASE_URL + '/api/mikrotik/logs', { headers }).catch(e => ({ data: { success: false, data: [] } })),
        axios.get(API_BASE_URL + '/api/mikrotik/server-health', { headers }).catch(e => ({ data: { success: false, data: null } })),
        axios.get(API_BASE_URL + '/api/mikrotik/active', { headers }).catch(e => ({ data: { success: false, data: [] } })),
        axios.get(API_BASE_URL + '/api/mikrotik/unregistered', { headers }).catch(e => ({ data: { success: false, data: [] } })),
        axios.get(API_BASE_URL + '/api/pelanggan', { headers }).catch(e => ({ data: { success: false, data: [] } }))
      ]);

      if (resData.data.success && resData.data.data) setResources(resData.data.data);
      if (ifData.data.success) {
        setInterfaces(ifData.data.data || []);
        setInterfaceSource(ifData.data.source || 'unknown');
        setInterfaceError(ifData.data.error || null);
      }
      if (logData.data.success) {
        setLogs(logData.data.data || []);
        setLogSource(logData.data.source || 'unknown');
        setLogError(logData.data.error || null);
      }
      if (healthData.data.success && healthData.data.data) setServerHealth(healthData.data.data);
      if (activeData.data.success && activeData.data.data) setActiveSessions(activeData.data.data);
      if (unregData.data.success && unregData.data.data) setUnregistered(unregData.data.data);
      if (custData.data.success && custData.data.data) setCustomers(custData.data.data);

    } catch (err) {
      console.error('Gagal mengambil data telemetri NOC:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(function () {
    fetchAllTelemetry();
    fetchFinanceSummary();

    // Auto-refresh interval (every 15 seconds for NOC live feed)
    var interval = setInterval(function () {
      fetchAllTelemetry();
      fetchFinanceSummary();
    }, 15000);

    // Socket events
    if (socket) {
      socket.on('mikrotik_ping', function () {
        fetchAllTelemetry();
      });

      socket.on('pppoe_summary', function (summary) {
        if (summary.unregistered_list) setUnregistered(summary.unregistered_list);
      });

      socket.on('pelanggan_updated', function () {
        fetchAllTelemetry();
      });

      socket.on('pengeluaran_masuk', fetchFinanceSummary);
      socket.on('pengeluaran_updated', fetchFinanceSummary);
      socket.on('pembayaran_masuk', fetchFinanceSummary);
    }

    return function () {
      clearInterval(interval);
      if (socket) {
        socket.off('mikrotik_ping');
        socket.off('pppoe_summary');
        socket.off('pelanggan_updated');
        socket.off('pengeluaran_masuk', fetchFinanceSummary);
        socket.off('pengeluaran_updated', fetchFinanceSummary);
        socket.off('pembayaran_masuk', fetchFinanceSummary);
      }
    };
  }, [socket]);

  // Trigger Paksa Sync
  var handleForceSync = async function () {
    setSyncing(true);
    setSyncMessage(null);
    try {
      var res = await axios.post(API_BASE_URL + '/api/mikrotik/sync', {}, { headers });
      setSyncMessage({ type: 'success', text: res.data.message || 'Sinkronisasi berhasil!' });
      fetchAllTelemetry();
    } catch (err) {
      setSyncMessage({ type: 'error', text: 'Sinkronisasi gagal: ' + err.message });
    } finally {
      setSyncing(false);
      setTimeout(function () { setSyncMessage(null); }, 4000);
    }
  };

  // Ping Latency Test
  var handlePingTest = function () {
    setPinging(true);
    setPingResult(null);
    var startTime = Date.now();
    axios.get(API_BASE_URL + '/api/mikrotik/status', { headers })
      .then(function (res) {
        var latency = Date.now() - startTime;
        setPingResult({
          success: res.data.success && res.data.data.online,
          latency: latency,
          board: res.data.data.board,
          timestamp: new Date().toLocaleTimeString()
        });
      })
      .catch(function (err) {
        setPingResult({
          success: false,
          error: err.message,
          timestamp: new Date().toLocaleTimeString()
        });
      })
      .finally(function () {
        setPinging(false);
      });
  };

  // Kick / Disconnect Session
  var handleKickSession = async function (username) {
    if (!window.confirm(`Yakin ingin memutus sesi PPPoE aktif untuk [${username}]?`)) return;
    setKickLoading(username);
    try {
      var res = await axios.post(API_BASE_URL + '/api/mikrotik/kick-session', { username: username }, { headers });
      alert(res.data.message);
      fetchAllTelemetry();
    } catch (err) {
      alert('Gagal memutus sesi: ' + (err.response ? err.response.data.message : err.message));
    } finally {
      setKickLoading(null);
    }
  };

  // Filtered Logs
  var filteredLogs = logs.filter(function (l) {
    if (logFilter === 'all') return true;
    return l.topics && l.topics.toLowerCase().includes(logFilter.toLowerCase());
  });

  // Byte Formatter
  var formatBytes = function (bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Active / Inactive grouping
  var activeCustList = customers.filter(c => c.pppoe_status === 'active');
  var inactiveCustList = customers.filter(c => c.pppoe_status === 'inactive' || c.pppoe_status === 'unknown');

  var cpuLoad = resources ? resources.cpu_load : 0;
  var memPercent = resources ? resources.memory_percent : 0;
  var hddPercent = resources ? resources.hdd_percent : 0;

  return (
    <div className="noc-dashboard-container">
      <style>{`
        .noc-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: var(--text-primary);
        }

        /* NOC HUD Banner */
        .noc-hud-banner {
          background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%);
          border: 0;
          border-radius: var(--radius-xl);
          padding: 24px 28px;
          color: var(--text-inverse);
          box-shadow: var(--shadow-lg);
        }

        .noc-hud-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 20px;
        }

        .noc-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .noc-beacon {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.14);
          border: 0;
          color: #d1fae5;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .noc-beacon-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px var(--status-hijau);
          animation: pulse-beacon 1.5s infinite;
        }

        @keyframes pulse-beacon {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 12px #10b981; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        .noc-hud-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          background: rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          border-radius: var(--radius-lg);
          border: 0;
        }

        .hud-metric-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hud-metric-label {
          font-size: 0.72rem;
          color: #dbeafe;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }

        .hud-metric-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-inverse);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* Gauge Cluster Cards */
        .noc-gauge-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }

        .noc-card {
          background: var(--bg-card);
          border: 0;
          border-radius: var(--radius-xl);
          padding: 20px;
          box-shadow: var(--shadow-sm);
          color: var(--text-primary);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .noc-card:hover {
          box-shadow: var(--shadow-md);
        }

        .noc-card-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 14px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .noc-progress-bar {
          width: 100%;
          height: 10px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          overflow: hidden;
          margin: 12px 0 8px 0;
          position: relative;
        }

        .noc-progress-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.5s ease-in-out;
        }

        /* Cyber Button */
        .btn-cyber {
          background: #e0f2fe;
          border: 1px solid #bae6fd;
          color: var(--primary-dark);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-cyber:hover {
          background: #ffffff;
          color: var(--primary-dark);
          box-shadow: var(--shadow-glow);
        }

        .btn-cyber:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Interface Table */
        .noc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }

        .noc-table th {
          text-align: left;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.72rem;
          border-bottom: 0;
        }

        .noc-table td {
          padding: 10px 12px;
          border-bottom: 0;
          color: var(--text-primary);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .noc-table tr:hover td {
          background: var(--bg-card-hover);
        }

        /* Terminal Syslog Box */
        .noc-terminal {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 16px;
          font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
          font-size: 0.78rem;
          color: var(--status-hijau);
          max-height: 280px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.7);
        }

        .noc-terminal-line {
          display: flex;
          gap: 12px;
          align-items: baseline;
          line-height: 1.4;
        }

        .noc-terminal-time {
          color: var(--text-muted);
          white-space: nowrap;
        }

        .noc-terminal-topic {
          color: var(--primary);
          background: var(--primary-glow);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          white-space: nowrap;
        }

        .noc-terminal-msg {
          color: var(--text-primary);
          word-break: break-word;
        }
      `}</style>

      {/* 1. NOC HUD Command Banner */}
      <section className="noc-hud-banner animate-fadeIn">
        <div className="noc-hud-header">
          <div>
            <div className="noc-title-wrap">
              <span className="noc-beacon">
                <span className="noc-beacon-dot" />
                NOC Command Center Active
              </span>
              <span style={{ fontSize: '0.78rem', color: '#bae6fd' }}>•</span>
              <span style={{ fontSize: '0.78rem', color: '#e0f2fe', fontWeight: 600 }}>Backbone RouterOS LDM</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginTop: '6px', letterSpacing: '-0.02em' }}>
              Super Admin IT & Infrastructure Center
            </h1>
            <p style={{ color: '#e0f2fe', fontSize: '0.85rem', maxWidth: '650px', marginTop: '2px', lineHeight: 1.4 }}>
              Pusat komando dan telemetri jaringan ISP PT. Lintas Data Multimedia. Memantau kesehatan RouterOS gateway, alokasi sesi PPPoE, interface fisik, serta integritas backend core secara langsung.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-cyber" onClick={handleForceSync} disabled={syncing}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: syncing ? 'spin 1s infinite linear' : 'none' }}>
                sync
              </span>
              {syncing ? 'Menyinkronkan...' : 'Force Sync Mikrotik'}
            </button>
            <button className="btn-cyber" onClick={handlePingTest} disabled={pinging}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                network_ping
              </span>
              {pinging ? 'Pinging...' : 'Test Latency'}
            </button>
            <button className="btn-cyber" onClick={fetchAllTelemetry}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                refresh
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Sync / Ping Alert Message */}
        {syncMessage && (
          <div style={{
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            background: syncMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: syncMessage.type === 'success' ? '#34d399' : '#f87171',
            border: `1px solid ${syncMessage.type === 'success' ? '#10b981' : '#ef4444'}`
          }}>
            {syncMessage.text}
          </div>
        )}

        {pingResult && (
          <div style={{
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            background: pingResult.success ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: pingResult.success ? '#38bdf8' : '#f87171',
            border: `1px solid ${pingResult.success ? '#0284c7' : '#ef4444'}`
          }}>
            {pingResult.success
              ? `● Gateway Pong! Latency: ${pingResult.latency} ms | Device: ${pingResult.board} | ${pingResult.timestamp}`
              : `✕ Gateway Unreachable: ${pingResult.error} | ${pingResult.timestamp}`}
          </div>
        )}

        {/* HUD Telemetry Metric Strip */}
        <div className="noc-hud-metrics">
          <div className="hud-metric-item">
            <span className="hud-metric-label">Router Model</span>
            <span className="hud-metric-value" style={{ color: '#bae6fd' }}>
              {resources ? resources.board : 'hAP ac lite'}
            </span>
          </div>
          <div className="hud-metric-item">
            <span className="hud-metric-label">RouterOS Version</span>
            <span className="hud-metric-value">
              {resources ? resources.version : 'RouterOS'}
            </span>
          </div>
          <div className="hud-metric-item">
            <span className="hud-metric-label">Router Uptime</span>
            <span className="hud-metric-value" style={{ color: '#bbf7d0' }}>
              {resources ? resources.uptime : '0d 00:00:00'}
            </span>
          </div>
          <div className="hud-metric-item">
            <span className="hud-metric-label">CPU Architecture</span>
            <span className="hud-metric-value">
              {resources ? resources.architecture : 'MIPS'}
            </span>
          </div>
          <div className="hud-metric-item">
            <span className="hud-metric-label">DB Latency</span>
            <span className="hud-metric-value" style={{ color: serverHealth && serverHealth.db_latency_ms >= 0 ? '#bbf7d0' : '#fecaca' }}>
              {serverHealth && serverHealth.db_latency_ms >= 0 ? `${serverHealth.db_latency_ms} ms (MySQL OK)` : 'Offline'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Executive Financial & Cashflow Overview (Finance Super Admin) */}
      <section className="animate-fadeIn" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0, 104, 118, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TemplateIcon name="chart-up" size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Ringkasan Finansial Eksekutif</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Arus kas masuk & pengeluaran operasional (Finance Super Admin)
              </p>
            </div>
          </div>
          <Link to="/dashboard/laporan" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <span>Buka Laporan Keuangan</span> <TemplateIcon name="arrow-right" size={14} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          {/* Pemasukan */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-lg)', borderLeft: '4px solid var(--status-hijau, #10b981)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Pemasukan</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-hijau, #10b981)', marginTop: '4px' }}>
              {financeLoading ? '...' : formatUang(finSummary.total_pemasukan)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Dari tagihan pelanggan lunas</div>
          </div>

          {/* Pengeluaran Disetujui */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-lg)', borderLeft: '4px solid var(--status-merah, #ef4444)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Pengeluaran</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-merah, #ef4444)', marginTop: '4px' }}>
              {financeLoading ? '...' : formatUang(finSummary.total_pengeluaran)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pengeluaran operasional disetujui</div>
          </div>

          {/* Laba Bersih */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-lg)', borderLeft: '4px solid var(--primary, #006876)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Laba Bersih (Profit)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: finSummary.laba_bersih >= 0 ? 'var(--primary)' : 'var(--status-merah)', marginTop: '4px' }}>
              {financeLoading ? '...' : formatUang(finSummary.laba_bersih)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Saldo kas bersih bulan ini</div>
          </div>

          {/* Menunggu Validasi */}
          <div style={{
            background: finSummary.total_menunggu > 0 ? 'rgba(234, 179, 8, 0.1)' : 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            borderLeft: '4px solid var(--status-kuning, #eab308)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Menunggu Validasi</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-kuning, #ca8a04)', marginTop: '4px' }}>
              {financeLoading ? '...' : formatUang(finSummary.total_menunggu)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {finSummary.total_menunggu > 0 ? 'Perlu tindakan validasi Superadmin' : 'Semua pengeluaran tervalidasi'}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Hardware Resource & Capacity Gauges */}
      <section className="noc-gauge-grid">
        {/* CPU Load Card */}
        <div className="noc-card animate-fadeIn">
          <div className="noc-card-title">
            <span>CPU Utilization</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>memory</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: cpuLoad > 75 ? '#ef4444' : cpuLoad > 45 ? '#f59e0b' : '#10b981', fontFamily: 'monospace' }}>
              {cpuLoad}%
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {resources ? `${resources.cpu_frequency} (${resources.cpu_count} Cores)` : '880 MHz'}
            </span>
          </div>
          <div className="noc-progress-bar">
            <div
              className="noc-progress-fill"
              style={{
                width: `${Math.min(100, Math.max(5, cpuLoad))}%`,
                background: cpuLoad > 75 ? '#ef4444' : cpuLoad > 45 ? '#f59e0b' : '#10b981'
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Load Core Processor: {resources ? resources.cpu : 'MT7621A'}
          </div>
        </div>

        {/* Memory Pool Card */}
        <div className="noc-card animate-fadeIn" style={{ animationDelay: '0.05s' }}>
          <div className="noc-card-title">
            <span>RAM / Memory Pool</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a855f7' }}>developer_board</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', fontFamily: 'monospace' }}>
              {memPercent}%
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {resources ? `${formatBytes(resources.used_memory)} / ${formatBytes(resources.total_memory)}` : 'Memuat...'}
            </span>
          </div>
          <div className="noc-progress-bar">
            <div
              className="noc-progress-fill"
              style={{
                width: `${Math.min(100, Math.max(5, memPercent))}%`,
                background: '#a855f7'
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Free Memory: {resources ? formatBytes(resources.free_memory) : '-'}
          </div>
        </div>

        {/* Storage / NAND Card */}
        <div className="noc-card animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <div className="noc-card-title">
            <span>Storage / NAND Flash</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#06b6d4' }}>hard_drive</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#06b6d4', fontFamily: 'monospace' }}>
              {hddPercent}%
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {resources ? `${formatBytes(resources.used_hdd)} / ${formatBytes(resources.total_hdd)}` : 'Memuat...'}
            </span>
          </div>
          <div className="noc-progress-bar">
            <div
              className="noc-progress-fill"
              style={{
                width: `${Math.min(100, Math.max(5, hddPercent))}%`,
                background: '#06b6d4'
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Free Storage: {resources ? formatBytes(resources.free_hdd) : '-'}
          </div>
        </div>

        {/* Active PPPoE Session Pool Card */}
        <div className="noc-card animate-fadeIn" style={{ animationDelay: '0.15s' }}>
          <div className="noc-card-title">
            <span>PPPoE Session Pool</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>hub</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
              {activeSessions.length} Sesi
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {customers.length} Terdaftar di DB
            </span>
          </div>
          <div className="noc-progress-bar">
            <div
              className="noc-progress-fill"
              style={{
                width: `${Math.min(100, Math.max(5, customers.length > 0 ? Math.round((activeSessions.length / customers.length) * 100) : 0))}%`,
                background: '#10b981'
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            <span>Unregistered: <strong style={{ color: unregistered.length > 0 ? '#ef4444' : '#64748b' }}>{unregistered.length}</strong></span>
            <span>Offline: {inactiveCustList.length}</span>
          </div>
        </div>
      </section>

      {/* 3. Server Node.js & Database Infrastructure Health */}
      {serverHealth && (
        <section className="noc-card animate-fadeIn" style={{ padding: '16px 20px' }}>
          <div className="noc-card-title" style={{ marginBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8' }}>dns</span>
              Node.js Backend & Core Infrastructure
            </span>
            <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
              Node {serverHealth.node_version} • {serverHealth.server_platform}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>BACKEND PROCESS UPTIME</span>
              <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{serverHealth.server_uptime_formatted}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>HEAP MEMORY USAGE</span>
              <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{serverHealth.heap_used_mb} MB / {serverHealth.heap_total_mb} MB</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>HOST OS RAM</span>
              <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{serverHealth.os_free_mem_mb} MB Free / {serverHealth.os_total_mem_mb} MB</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>CRON PPPOE SYNC</span>
              <strong style={{ color: '#34d399', fontFamily: 'monospace' }}>Active (Every 30s)</strong>
            </div>
          </div>
        </section>
      )}

      {/* 4. Interface Telemetry & Traffic Table */}
      <section className="noc-card animate-fadeIn">
        <div className="noc-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00e5ff' }}>settings_ethernet</span>
            MikroTik Interface Telemetry & Port Status
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {interfaceSource === 'router' ? `RouterOS • ${interfaces.length} interface` : 'RouterOS tidak terhubung'}
          </span>
        </div>

        {interfaceSource !== 'router' && (
          <div style={{ color: '#fbbf24', fontSize: '0.78rem', padding: '10px 0' }}>
            Data interface belum tersedia dari MikroTik. {interfaceError || 'Periksa koneksi API RouterOS.'}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="noc-table">
            <thead>
              <tr>
                <th>Interface</th>
                <th>Tipe</th>
                <th>Status</th>
                <th>MTU</th>
                <th>MAC Address</th>
                <th>Rx Traffic</th>
                <th>Tx Traffic</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map(function (iface, idx) {
                return (
                  <tr key={iface.name || idx}>
                    <td style={{ fontWeight: 700, color: '#38bdf8' }}>{iface.name}</td>
                    <td><span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>{iface.type}</span></td>
                    <td>
                      {iface.running ? (
                        <span style={{ color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> UP
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b' }} /> DOWN
                        </span>
                      )}
                    </td>
                    <td>{iface.mtu}</td>
                    <td>{iface.mac_address}</td>
                    <td style={{ color: '#34d399' }}>{formatBytes(iface.rx_byte)}</td>
                    <td style={{ color: '#38bdf8' }}>{formatBytes(iface.tx_byte)}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{iface.comment || '—'}</td>
                  </tr>
                );
              })}
              {interfaces.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    {interfaceSource === 'router' ? 'Tidak ada interface yang dikembalikan RouterOS.' : 'Tidak ada data interface aktual.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Active PPPoE Sessions & Rogue Detection (Security Guard) */}
      <section className="noc-card animate-fadeIn">
        <div className="noc-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>security</span>
            Active PPPoE Sessions & Rogue Connection Guard
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {unregistered.length > 0 && (
              <span style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700,
                animation: 'pulse-red 1s infinite'
              }}>
                ⚠ {unregistered.length} Unregistered Detected!
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {activeSessions.length} Sesi Online
            </span>
          </div>
        </div>

        {/* Unregistered Alert Banner */}
        {unregistered.length > 0 && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
              <strong>Peringatan Keamanan Jaringan:</strong> Ditemukan akun PPPoE aktif pada router yang tidak terdaftar di database LDM.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unregistered.map(function (u, i) {
                return (
                  <button
                    key={i}
                    className="btn-cyber"
                    style={{ background: 'rgba(239,68,68,0.2)', borderColor: '#ef4444', color: '#f87171', padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={function () { handleKickSession(u.name); }}
                    disabled={kickLoading === u.name}
                  >
                    Putus [{u.name}]
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="noc-table">
            <thead>
              <tr>
                <th>Username PPPoE</th>
                <th>IP Address</th>
                <th>Caller-ID (MAC)</th>
                <th>Sesi Uptime</th>
                <th>Service</th>
                <th>Status DB</th>
                <th>Aksi IT</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map(function (sess, idx) {
                var isUnregistered = unregistered.some(u => u.name === sess.name);
                return (
                  <tr key={sess.name || idx}>
                    <td style={{ fontWeight: 700, color: isUnregistered ? '#ef4444' : '#38bdf8' }}>
                      {sess.name}
                      {isUnregistered && <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: '#ef4444', fontWeight: 800 }}>[ROGUE]</span>}
                    </td>
                    <td style={{ color: '#34d399' }}>{sess.address || '—'}</td>
                    <td>{sess['caller-id'] || '—'}</td>
                    <td>{sess.uptime || '—'}</td>
                    <td>{sess.service || 'pppoe'}</td>
                    <td>
                      {isUnregistered ? (
                        <span style={{ color: '#f87171', fontWeight: 700 }}>Unregistered</span>
                      ) : (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>Terverifikasi</span>
                      )}
                    </td>
                    <td>
                      <button
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        onClick={function () { handleKickSession(sess.name); }}
                        disabled={kickLoading === sess.name}
                      >
                        {kickLoading === sess.name ? 'Memutus...' : 'Kick Sesi'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {activeSessions.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Tidak ada sesi PPPoE aktif saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Live RouterOS Syslog / Terminal Console */}
      <section className="noc-card animate-fadeIn">
        <div className="noc-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4ade80' }}>terminal</span>
            RouterOS Live Syslog & Event Stream
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'ppp', 'system', 'interface'].map(function (f) {
              return (
                <button
                  key={f}
                  style={{
                    background: logFilter === f ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    border: 'none',
                    color: logFilter === f ? '#ffffff' : '#94a3b8',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={function () { setLogFilter(f); }}
                >
                  {f.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {logSource !== 'router' && (
          <div style={{ color: '#fbbf24', fontSize: '0.78rem', padding: '10px 0' }}>
            Log belum tersedia dari MikroTik. {logError || 'Nama pengguna hanya akan muncul jika dikirim oleh RouterOS.'}
          </div>
        )}

        <div className="noc-terminal" ref={terminalRef}>
          {filteredLogs.map(function (l, idx) {
            return (
              <div key={l.id || idx} className="noc-terminal-line">
                <span className="noc-terminal-time">[{l.time}]</span>
                <span className="noc-terminal-topic">[{l.topics}]</span>
                <span className="noc-terminal-msg">{l.message}</span>
              </div>
            );
          })}
          {filteredLogs.length === 0 && (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
              Tidak ada log yang cocok dengan filter [{logFilter}].
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default SuperAdminNocDashboard;

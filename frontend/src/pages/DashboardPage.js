import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';
import StatRing from '../components/dashboard/StatRing';
import IncomeSpendCard from '../components/dashboard/IncomeSpendCard';
import TodayPaymentSummary from '../components/dashboard/TodayPaymentSummary';
import SuperAdminNocDashboard from '../components/dashboard/SuperAdminNocDashboard';
import { Link } from 'react-router-dom';

function DashboardPage({ socket, admin }) {
  var { showAlert } = useDialog();
  var savedAdminStr = localStorage.getItem('admin');
  var currentAdmin = admin || (savedAdminStr ? JSON.parse(savedAdminStr) : null);
  var isSuperAdmin = currentAdmin && currentAdmin.role === 'superadmin';

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

  // New report metrics state
  var [summary, setSummary] = useState({ total_pemasukan: 0, total_pengeluaran: 0, laba_bersih: 0 });
  var [verifiedCount, setVerifiedCount] = useState(0);
  var [miniBarData, setMiniBarData] = useState([]);
  var [dailyTrend, setDailyTrend] = useState([]);
  var [todayPaymentsSum, setTodayPaymentsSum] = useState(0);
  var [loadingReports, setLoadingReports] = useState(true);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  var fetchDashboardReports = async function () {
    if (isSuperAdmin) {
      setLoadingReports(false);
      return;
    }

    var today = new Date();
    var currentMonthStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

    try {
      setLoadingReports(true);

      // 1. Fetch monthly financial summary
      var summaryRes = await axios.get(API_BASE_URL + '/api/reports/summary?periode=' + currentMonthStr, { headers: headers });
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }

      // 2. Fetch reports details for counts (pemasukan_list)
      var detailsRes = await axios.get(API_BASE_URL + '/api/reports/details?periode=' + currentMonthStr, { headers: headers });
      if (detailsRes.data.success) {
        var pemasukanList = detailsRes.data.data.pemasukan_list;
        setVerifiedCount(pemasukanList.length);

        // Compute today's payments total
        var todayStr = today.toISOString().split('T')[0];
        var todaySum = pemasukanList
          .filter(function (item) {
            return new Date(item.updated_at).toISOString().split('T')[0] === todayStr;
          })
          .reduce(function (sum, item) {
            return sum + parseFloat(item.nominal);
          }, 0);
        setTodayPaymentsSum(todaySum);

        // Fetch last month's details if we are in the first 10 days of the month for 10-day bar chart
        var allIncomesForBar = [...pemasukanList];
        if (today.getDate() < 10) {
          var lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          var lastMonthStr = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth() + 1).padStart(2, '0');
          try {
            var lastMonthRes = await axios.get(API_BASE_URL + '/api/reports/details?periode=' + lastMonthStr, { headers: headers });
            if (lastMonthRes.data.success) {
              allIncomesForBar = [...allIncomesForBar, ...lastMonthRes.data.data.pemasukan_list];
            }
          } catch (e) { console.error('Error fetching last month for bar chart:', e); }
        }

        // Map to last 10 days
        var dailyIncomeMap = {};
        allIncomesForBar.forEach(function (item) {
          var dateStr = new Date(item.updated_at).toISOString().split('T')[0];
          dailyIncomeMap[dateStr] = (dailyIncomeMap[dateStr] || 0) + parseFloat(item.nominal);
        });

        var last10DaysData = [];
        for (var i = 9; i >= 0; i--) {
          var d = new Date();
          d.setDate(today.getDate() - i);
          var dateStr = d.toISOString().split('T')[0];
          var dayName = d.toLocaleDateString('id-ID', { weekday: 'short' })[0]; // S, S, R, K, J, S, M
          last10DaysData.push({
            date: dateStr,
            day: dayName,
            value: dailyIncomeMap[dateStr] || 0
          });
        }
        setMiniBarData(last10DaysData);
      }

      // 3. Fetch daily trend for the main area chart
      var trendRes = await axios.get(API_BASE_URL + '/api/reports/daily-trend?periode=' + currentMonthStr, { headers: headers });
      if (trendRes.data.success) {
        setDailyTrend(trendRes.data.data.days);
      }

    } catch (err) {
      console.error('Error loading dashboard reports data:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(function () {
    fetchStats();
    fetchRouterInfo();
    fetchCustomers();
    if (!isSuperAdmin) {
      fetchDashboardReports();
    } else {
      setLoadingReports(false);
    }

    if (socket) {
      socket.on('mikrotik_ping', function (pingData) {
        setRouterStatus(pingData);
      });

      socket.on('pppoe_summary', function (summary) {
        setPppoeSummary(summary);
      });

      socket.on('pelanggan_updated', function (data) {
        fetchStats();
        if (!isSuperAdmin) fetchDashboardReports();
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

      socket.on('pembayaran_masuk', function () {
        if (!isSuperAdmin) fetchDashboardReports();
      });
    }

    return function () {
      if (socket) {
        socket.off('mikrotik_ping');
        socket.off('pppoe_summary');
        socket.off('pelanggan_updated');
        socket.off('pembayaran_masuk');
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

      var routerRect, swRect, routerX, routerY, swX, swY_top, swY_bottom;

      if (routerNode && switchNode) {
        routerRect = routerNode.getBoundingClientRect();
        swRect = switchNode.getBoundingClientRect();
        routerX = routerRect.left - containerRect.left + routerRect.width / 2;
        routerY = routerRect.top - containerRect.top + routerRect.height;
        swX = swRect.left - containerRect.left + swRect.width / 2;
        swY_top = swRect.top - containerRect.top;

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
        swRect = switchNode.getBoundingClientRect();
        swX = swRect.left - containerRect.left + swRect.width / 2;
        swY_bottom = swRect.top - containerRect.top + swRect.height;

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
      var response = await axios.get(`${API_BASE_URL}/api/pelanggan/stats`, {
        headers: headers
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
      var statusRes = await axios.get(`${API_BASE_URL}/api/mikrotik/status`, { headers: headers });
      setRouterStatus(statusRes.data.data);
    } catch (err) {
      console.error('Gagal mengambil status router:', err);
    }
  }

  async function fetchCustomers() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/pelanggan`, {
        headers: headers
      });
      if (response.data.success) {
        setCustomers(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data pelanggan:', err);
    }
  }

  var handleExportExcel = async function () {
    var today = new Date();
    var currentYear = today.getFullYear();
    var currentMonthStr = currentYear + '-' + String(today.getMonth() + 1).padStart(2, '0');
    try {
      var response = await axios.get(API_BASE_URL + '/api/reports/export-excel?year=' + currentYear + '&periode=' + currentMonthStr, {
        headers: headers,
        responseType: 'blob'
      });

      var blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Laporan_Keuangan_Tahunan_' + currentYear + '_(Januari-Desember).xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      showAlert('Gagal mendownload laporan: ' + err.message, { tone: 'error' });
    }
  };

  // Grouping customers for the topology display
  var activeCustomers = customers.filter(c => c.pppoe_status === 'active');
  var inactiveCustomers = customers.filter(c => c.pppoe_status === 'inactive' || c.pppoe_status === 'unknown');
  var unregisteredActive = pppoeSummary.unregistered_list || [];

  var routerBadgeClass = routerStatus.online ? 'healthy' : 'danger';

  // Compute Pelanggan Baru (bulan ini)
  var today = new Date();
  var currentMonthStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var newCustomersCount = customers.filter(function (c) {
    return c.created_at && c.created_at.substring(0, 7) === currentMonthStr;
  }).length;

  // Ring overdue count
  var overdueCount = stats.merah || 0;

  if (isSuperAdmin) {
    return <SuperAdminNocDashboard socket={socket} admin={currentAdmin} />;
  }

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <style>{`
        .dashboard-shell {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-top: 0;
          position: relative;
          z-index: 10;
        }

        .dashboard-hero-atlantis {
          background: linear-gradient(135deg, #004e5a 0%, #006876 100%);
          border-radius: var(--radius-xl);
          margin-bottom: 24px;
          padding: 28px 32px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          box-shadow: 0 10px 25px -5px rgba(0, 78, 90, 0.25);
          position: relative;
          overflow: hidden;
        }

        .dashboard-hero-atlantis::after {
          content: '';
          position: absolute;
          right: -40px;
          top: -40px;
          width: 220px;
          height: 220px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15), transparent 70%);
          pointer-events: none;
        }

        .dashboard-hero-atlantis h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }

        .dashboard-hero-atlantis p {
          color: rgba(255, 255, 255, 0.88);
          max-width: 620px;
          line-height: 1.5;
          font-size: 0.9rem;
        }

        .overlapping-grid-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 0 4px;
        }

        .trend-summary-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 24px;
        }

        .panel-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }

        .panel-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 12px;
        }

        .panel-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .panel-card-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          background: var(--primary-glow);
          color: var(--primary);
          flex-shrink: 0;
        }

        .panel-card-icon span {
          font-size: 1.25rem;
        }

        .panel-card-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 2px;
          font-weight: 500;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 30px;
          font-size: 0.78rem;
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

        .router-grid {
          display: grid;
          gap: 12px;
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
          font-size: 0.88rem;
          font-weight: 600;
        }

        .router-row strong {
          color: var(--text-primary);
          font-size: 0.88rem;
          font-weight: 700;
          text-align: right;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
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
          font-size: 0.88rem;
          font-weight: 600;
        }

        .activity-item strong {
          color: var(--text-primary);
          font-size: 0.88rem;
          font-weight: 700;
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
          padding: 24px 0;
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
      `}</style>

      {/* Hero Banner Section */}
      <section className="dashboard-hero-atlantis animate-fadeIn">
        <div>
          <h1>Dashboard Admin</h1>
          <p>Ringkasan operasional layanan internet hari ini. Monitor status perangkat gateway Mikrotik, tagihan pelanggan, dan rekapan pembayaran secara real-time.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/dashboard/pelanggan" className="btn btn-secondary" style={{
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,0.4)',
            color: 'white',
            fontWeight: '700'
          }}
            onMouseEnter={function (e) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Kelola Pelanggan
          </Link>
          {/* <Link to="/dashboard/pelanggan?action=tambah" className="btn btn-primary" style={{
            background: 'var(--md-primary-fixed)',
            color: 'var(--md-on-primary-fixed-variant)',
            fontWeight: '700'
          }}>
            + Tambah Pelanggan
          </Link> */}
        </div>
      </section>

      {/* Shell wrapping the dashboard items */}
      <div className="dashboard-shell">

        {/* Overlapping Stat Cards Row */}
        <div className="overlapping-grid-cards" style={{ gridTemplateColumns: !isSuperAdmin ? '1fr 1fr' : '1fr' }}>
          {/* Card "Statistik Keseluruhan" (Circular Rings) */}
          <div className="card glass-card animate-fadeIn" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '24px',
            minHeight: '200px'
          }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: '700',
              color: 'var(--text-muted)',
              marginBottom: '18px',
              fontFamily: "'Hanken Grotesk', sans-serif"
            }}>
              Statistik Keseluruhan Bulan Ini
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <StatRing value={newCustomersCount} max={Math.max(10, newCustomersCount)} label="Pelanggan Baru" color="var(--primary-light)" />
              <StatRing value={verifiedCount} max={Math.max(10, verifiedCount)} label="Pembayaran Lunas" color="var(--primary)" />
              <StatRing value={overdueCount} max={Math.max(5, overdueCount)} label="Jatuh Tempo" color="var(--status-merah)" />
            </div>
          </div>

          {/* Card "Pemasukan & Pengeluaran" (Khusus Admin operasional, bukan Super Admin) */}
          {!isSuperAdmin && (
            <IncomeSpendCard
              totalIncome={summary.total_pemasukan}
              totalSpend={summary.total_pengeluaran}
              dailyData={miniBarData}
              loading={loadingReports}
            />
          )}
        </div>

        {/* Today Summary Grid (Khusus Admin operasional, bukan Super Admin) */}
        {!isSuperAdmin && (
          <div className="trend-summary-grid">
            <TodayPaymentSummary
              value={todayPaymentsSum}
              loading={loadingReports}
            />
          </div>
        )}

        {/* Cisco Network Topology Map */}
        <div className="topology-card panel-card animate-fadeIn" style={{ animationDelay: '0.15s' }}>
          <div className="panel-card-header">
            <div>
              <div className="panel-card-title">
                <span className="panel-card-icon">
                  <span className="material-symbols-outlined">hub</span>
                </span>
                <span>Peta Topologi Jaringan</span>
              </div>
              <div className="panel-card-subtitle">
                Status session & perangkat terhubung real-time dari router gateway Mikrotik LDM
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', flexWrap: 'wrap', justifyContent: 'flex-end', fontWeight: '600' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--status-hijau)', borderRadius: '50%' }} /> Aktif ({activeCustomers.length})</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--text-muted)', borderRadius: '50%' }} /> Nonaktif ({inactiveCustomers.length})</span>
              {unregisteredActive.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--status-merah)', borderRadius: '50%', animation: 'pulse-red 1s infinite' }} /> Unregistered ({unregisteredActive.length})</span>
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
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memetakan perangkat klien...</div>
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

        {/* Lower Row Grid: Router Specs & Recent Stats */}
        <div className="overview-grid">
          {/* Card: Status router & koneksi */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <div className="panel-card-title">
                  <span className="panel-card-icon">
                    <span className="material-symbols-outlined">dns</span>
                  </span>
                  <span>Status Router & Koneksi Gateway</span>
                </div>
                <div className="panel-card-subtitle">Detail status operasional perangkat RouterOS Mikrotik</div>
              </div>
              <span className={'status-pill ' + routerBadgeClass} style={{ fontWeight: '700' }}>
                {routerStatus.online ? '● Online' : '● Offline'}
              </span>
            </div>
            <div className="router-grid">
              <div className="router-row">
                <span>Model Perangkat</span>
                <strong>{routerStatus.online ? routerStatus.board : 'Tidak terhubung'}</strong>
              </div>
              <div className="router-row">
                <span>Versi RouterOS</span>
                <strong>{routerStatus.online ? routerStatus.version : routerStatus.error || '—'}</strong>
              </div>
              <div className="router-row">
                <span>PPPoE Sesi Aktif</span>
                <strong>{pppoeSummary.active_count} Sesi Online</strong>
              </div>
              <div className="router-row">
                <span>Membutuhkan Verifikasi</span>
                <strong>{pppoeSummary.unregistered_count} Klien</strong>
              </div>
            </div>
          </div>

          {/* Card: Aktivitas terbaru */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <div className="panel-card-title">
                  <span className="panel-card-icon">
                    <span className="material-symbols-outlined">history</span>
                  </span>
                  <span>Aktivitas & Riwayat Operasi</span>
                </div>
                <div className="panel-card-subtitle">Ringkasan status log session & client onboarding</div>
              </div>
            </div>
            <div className="activity-list">
              <div className="activity-item">
                <span>Klien Terdaftar Aktif</span>
                <strong>{activeCustomers.length} Pelanggan</strong>
              </div>
              <div className="activity-item">
                <span>Klien Offline / Terisolir</span>
                <strong>{inactiveCustomers.length} Pelanggan</strong>
              </div>
              <div className="activity-item">
                <span>Klien Unregistered</span>
                <strong>{unregisteredActive.length} Perangkat</strong>
              </div>
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
  var bodyColorStart = online ? "#1266a5" : "#64748b";
  var strokeColor = online ? "#175e96" : "#475569";

  return (
    <svg width={width} height={height} viewBox="0 0 80 50" style={{ overflow: 'visible' }}>
      <path d="M 5,20 L 5,38 A 35,12 0 0 0 75,38 L 75,20 Z" fill={bodyColorStart} stroke={strokeColor} strokeWidth="1" />
      <ellipse cx="40" cy="20" rx="35" ry="12" fill={topColorStart} stroke={strokeColor} strokeWidth="1" />
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
  var frontStart = online ? "#185987" : "#64748b";
  var sideColor = online ? "#154e77" : "#334155";
  var strokeColor = online ? "#09273d" : "#334155";

  return (
    <svg width={width} height={height} viewBox="0 0 80 46" style={{ overflow: 'visible' }}>
      <path d="M 15,10 L 55,10 L 68,20 L 28,20 Z" fill={topStart} stroke={strokeColor} strokeWidth="0.75" />
      <path d="M 28,20 L 68,20 L 68,34 L 28,34 Z" fill={frontStart} stroke={strokeColor} strokeWidth="0.75" />
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
  var bezelStart = "#f1f5f9";
  var towerColorStart = "#cbd5e1";
  var keyColor = online ? "#22c55e" : "#64748b";

  return (
    <svg width={width} height={height} viewBox="0 0 60 50" style={{ overflow: 'visible' }}>
      <rect x="43" y="10" width="11" height="28" rx="1" fill={towerColorStart} stroke="#475569" strokeWidth="0.5" />
      <line x1="45" y1="13" x2="52" y2="13" stroke="#475569" strokeWidth="1.2" />
      <line x1="45" y1="16" x2="52" y2="16" stroke="#475569" strokeWidth="1.2" />
      <circle cx="48" cy="30" r="1.5" fill={keyColor} />

      <rect x="6" y="8" width="34" height="24" rx="2" fill={bezelStart} stroke="#475569" strokeWidth="0.75" />
      <rect x="9" y="11" width="28" height="18" rx="0.5" fill={screenColorStart} stroke="#1e40af" strokeWidth="0.5" />
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

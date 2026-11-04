import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';

function LaporanPage() {
  var { showAlert, confirmDialog, promptDialog } = useDialog();
  var currentAdmin = JSON.parse(localStorage.getItem('admin') || '{}');
  var isSuperAdmin = currentAdmin && currentAdmin.role === 'superadmin';

  var today = new Date();
  var todayStr = today.toISOString().split('T')[0];
  var yesterdayDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  var yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  var defaultPeriode = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

  var [periode, setPeriode] = useState(defaultPeriode);
  var [summary, setSummary] = useState({ total_pemasukan: 0, total_pengeluaran: 0, total_menunggu: 0, laba_bersih: 0 });
  var [incomes, setIncomes] = useState([]);
  var [expenses, setExpenses] = useState([]);
  var [chartData, setChartData] = useState([]);
  var [chartLoading, setChartLoading] = useState(true);
  var [hoveredIdx, setHoveredIdx] = useState(null);
  var [expensePage, setExpensePage] = useState(1);
  var [incomePage, setIncomePage] = useState(1);
  var [logPage, setLogPage] = useState(1);
  var [reportLogs, setReportLogs] = useState([]);
  var [logsLoading, setLogsLoading] = useState(false);
  var [loading, setLoading] = useState(true);

  // Modals state for CRUD Expenses
  var [showAddModal, setShowAddModal] = useState(false);
  // Filter 30 Hari Mandiri (Pengeluaran & Pemasukan terpisah)
  var [filterPengeluaran30Hari, setFilterPengeluaran30Hari] = useState(true);
  var [filterPemasukan30Hari, setFilterPemasukan30Hari] = useState(true);

  // Form fields
  var [kategori, setKategori] = useState('');
  var [nominal, setNominal] = useState('');
  var [tipe, setTipe] = useState('tidak_fix');
  var [tanggal, setTanggal] = useState(todayStr);
  var [keterangan, setKeterangan] = useState('');
  var [buktiNotaFile, setBuktiNotaFile] = useState(null);
  var [buktiNotaPreview, setBuktiNotaPreview] = useState(null);
  var [previewNotaUrl, setPreviewNotaUrl] = useState(null);

  // Kategori berkala yang pernah dicatat
  var [berkalaList, setBerkalaList] = useState([]);
  var [selectedBerkala, setSelectedBerkala] = useState('');
  var [isNewBerkala, setIsNewBerkala] = useState(false);

  var [actionLoading, setActionLoading] = useState(false);
  var [exporting, setExporting] = useState(false);
  var exportInProgress = useRef(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  async function fetchReportLogs() {
    setLogsLoading(true);
    try {
      var res = await axios.get(`${API_BASE_URL}/api/reports/history`, { headers: headers });
      if (res.data && res.data.success) {
        setReportLogs(res.data.data || []);
      }
    } catch (err) {
      console.error('Gagal memuat log riwayat laporan:', err);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleDeleteLog(id) {
    if (!await confirmDialog('Apakah Anda yakin ingin menghapus catatan riwayat unduhan ini?', { tone: 'danger', confirmLabel: 'Ya, hapus', cancelLabel: 'Batal' })) {
      return;
    }
    try {
      var res = await axios.delete(`${API_BASE_URL}/api/reports/history/${id}`, { headers: headers });
      await showAlert(res.data.message || 'Log berhasil dihapus.', { tone: 'success' });
      fetchReportLogs();
    } catch (err) {
      await showAlert('Gagal menghapus log riwayat: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    }
  }

  useEffect(function () {
    fetchData();
    fetchReportLogs();
    setExpensePage(1);
    setIncomePage(1);
    setLogPage(1);
  }, [periode]);

  useEffect(function () {
    fetchBerkalaList();
    var query = new URLSearchParams(window.location.search);
    if (query.get('action') === 'pengeluaran') {
      resetForm();
      setShowAddModal(true);
    }
  }, []);

  async function fetchBerkalaList() {
    try {
      var res = await axios.get(`${API_BASE_URL}/api/pengeluaran/kategori-berkala`, { headers: headers });
      if (res.data.success) {
        setBerkalaList(res.data.data);
      }
    } catch (e) {
      console.error('Gagal mengambil daftar pengeluaran berkala:', e);
    }
  }

  async function fetchData() {
    setLoading(true);
    setChartLoading(true);
    var selectedYear = periode.split('-')[0] || new Date().getFullYear();
    try {
      var summaryRes = await axios.get(`${API_BASE_URL}/api/reports/summary?periode=${periode}`, { headers: headers });
      var detailsRes = await axios.get(`${API_BASE_URL}/api/reports/details?periode=${periode}`, { headers: headers });
      var chartRes = await axios.get(`${API_BASE_URL}/api/reports/yearly-chart?year=${selectedYear}`, { headers: headers });

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
      if (detailsRes.data.success) {
        setIncomes(detailsRes.data.data.pemasukan_list);
        setExpenses(detailsRes.data.data.pengeluaran_list);
      }
      if (chartRes.data.success) {
        setChartData(chartRes.data.data.months);
      }
    } catch (err) {
      console.error('Gagal memuat data laporan keuangan:', err);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  }

  function handleFileChange(e) {
    var file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showAlert('Ukuran file bukti nota maksimal 5MB.', { tone: 'error' });
        e.target.value = '';
        return;
      }
      setBuktiNotaFile(file);
      if (file.type.startsWith('image/')) {
        setBuktiNotaPreview(URL.createObjectURL(file));
      } else {
        setBuktiNotaPreview(null);
      }
    } else {
      setBuktiNotaFile(null);
      setBuktiNotaPreview(null);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    if (!buktiNotaFile) {
      showAlert('Bukti pengeluaran atau nota wajib diunggah.', { tone: 'error' });
      return;
    }

    if (!isSuperAdmin) {
      if (tanggal < yesterdayStr) {
        showAlert('Maksimal input pengeluaran adalah 1 hari setelah tanggal transaksi/nota (Maksimal tanggal ' + yesterdayStr + ').', { tone: 'error' });
        return;
      }
      if (tanggal > todayStr) {
        showAlert('Tanggal pengeluaran tidak boleh melebihi tanggal hari ini.', { tone: 'error' });
        return;
      }
    }

    setActionLoading(true);
    try {
      var formData = new FormData();
      formData.append('kategori', kategori);
      formData.append('nominal', nominal);
      formData.append('tipe', tipe);
      formData.append('tanggal', tanggal);
      formData.append('keterangan', keterangan);
      formData.append('bukti_nota', buktiNotaFile);

      var response = await axios.post(`${API_BASE_URL}/api/pengeluaran`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      await showAlert(response.data.message, { tone: 'success' });
      setShowAddModal(false);
      resetForm();
      fetchData();
      fetchBerkalaList();
    } catch (err) {
      await showAlert('Gagal mencatat pengeluaran: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    } finally {
      setActionLoading(false);
    }
  }


  async function handleValidateExpense(status, item) {
    var confirmMsg = status === 'disetujui'
      ? `Apakah Anda yakin ingin MENYETUJUI pengeluaran "${item.kategori}" sebesar ${formatUang(item.nominal)}?\n\nPengeluaran ini akan langsung memotong saldo pemasukan/kas pada laporan keuangan.`
      : `Apakah Anda yakin ingin MENOLAK pengeluaran "${item.kategori}" sebesar ${formatUang(item.nominal)}?`;

    var catatan = '';
    if (status === 'ditolak') {
      var inputCatatan = await promptDialog('Masukkan alasan penolakan pengeluaran (opsional):', {
        title: 'Tolak pengeluaran',
        tone: 'warning',
        inputLabel: 'Alasan penolakan',
        defaultValue: '',
        confirmLabel: 'Tolak pengeluaran',
        cancelLabel: 'Batal'
      });
      if (inputCatatan === null) return;
      catatan = inputCatatan;
    } else {
      if (!await confirmDialog(confirmMsg, { tone: 'info', confirmLabel: 'Ya, setujui', cancelLabel: 'Batal' })) return;
    }

    setActionLoading(true);
    try {
      var response = await axios.put(`${API_BASE_URL}/api/pengeluaran/${item.id_pengeluaran}/validasi`, {
        status: status,
        catatan_validasi: catatan
      }, { headers: headers });

      await showAlert(response.data.message, { tone: 'success' });
      fetchData();
    } catch (err) {
      await showAlert('Gagal memvalidasi pengeluaran: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    } finally {
      setActionLoading(false);
    }
  }



  function resetForm() {
    setKategori('');
    setNominal('');
    setTipe('tidak_fix');
    setTanggal(todayStr);
    setKeterangan('');
    setBuktiNotaFile(null);
    setBuktiNotaPreview(null);
    setSelectedBerkala('');
    setIsNewBerkala(false);
  }

  function handleTipeChange(e) {
    var newTipe = e.target.value;
    setTipe(newTipe);
    if (newTipe === 'fix') {
      fetchBerkalaList();
      if (berkalaList.length > 0) {
        setSelectedBerkala('');
        setIsNewBerkala(false);
        setKategori('');
      } else {
        setIsNewBerkala(true);
      }
    } else {
      setSelectedBerkala('');
      setIsNewBerkala(false);
    }
  }

  function handleSelectBerkala(e) {
    var val = e.target.value;
    setSelectedBerkala(val);
    if (val === '__NEW__') {
      setIsNewBerkala(true);
      setKategori('');
      setNominal('');
    } else if (val) {
      setIsNewBerkala(false);
      var found = berkalaList.find(function (b) { return b.kategori === val; });
      if (found) {
        setKategori(found.kategori);
        setNominal(found.nominal ? String(Math.round(found.nominal)) : '');
        if (found.keterangan) setKeterangan(found.keterangan);
      }
    } else {
      setIsNewBerkala(false);
      setKategori('');
    }
  }

  async function handleExportExcel() {
    if (exportInProgress.current) return;

    exportInProgress.current = true;
    setExporting(true);
    try {
      var selectedYear = (periode && periode.split('-')[0]) || new Date().getFullYear();
      var response = await axios.get(`${API_BASE_URL}/api/reports/export-excel?year=${selectedYear}&periode=${periode}&scope=month`, {
        headers: headers,
        responseType: 'blob'
      });

      var blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Keuangan_${periode}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Segarkan log riwayat unduhan laporan setelah berhasil unduh
      setTimeout(function () {
        fetchReportLogs();
      }, 1000);
    } catch (err) {
      await showAlert('Gagal mendownload laporan: ' + err.message, { tone: 'error' });
    } finally {
      exportInProgress.current = false;
      setExporting(false);
    }
  }

  function formatUang(value) {
    return 'Rp ' + Number(value).toLocaleString('id-ID');
  }

  function renderPagination(currentPage, totalPages, setPage) {
    if (totalPages <= 1) return null;

    var pages = [];
    for (var page = 1; page <= totalPages; page++) pages.push(page);

    return (
      <nav aria-label="Page navigation" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (currentPage === 1 ? ' disabled' : '')}>
            <a href="#" className="report-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== 1) setPage(Math.max(1, currentPage - 1)); }} aria-label="Previous" aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined}><span aria-hidden="true">«</span><span className="sr-only">Previous</span></a>
          </li>
          {pages.map(function (pageNumber) {
            return (
              <li
                key={pageNumber}
              >
                <a href="#" className={'report-page-button page-link' + (currentPage === pageNumber ? ' active' : '')} onClick={function (e) { e.preventDefault(); setPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={currentPage === pageNumber ? 'page' : undefined}>{pageNumber}</a>
              </li>
            );
          })}
          <li className={'page-item' + (currentPage === totalPages ? ' disabled' : '')}>
            <a href="#" className="report-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== totalPages) setPage(Math.min(totalPages, currentPage + 1)); }} aria-label="Next" aria-disabled={currentPage === totalPages} tabIndex={currentPage === totalPages ? -1 : undefined}><span aria-hidden="true">»</span><span className="sr-only">Next</span></a>
          </li>
        </ul>
      </nav>
    );
  }

  var now = new Date();
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  var thirtyDaysAgoTime = thirtyDaysAgo.getTime();

  var displayedExpenses = expenses.filter(function (item) {
    if (!filterPengeluaran30Hari) return true;
    var txDate = item.tanggal ? new Date(item.tanggal) : (item.created_at ? new Date(item.created_at) : new Date());
    return txDate.getTime() >= thirtyDaysAgoTime;
  });

  var displayedIncomes = incomes.filter(function (item) {
    if (!filterPemasukan30Hari) return true;
    var txDate = item.updated_at ? new Date(item.updated_at) : new Date();
    return txDate.getTime() >= thirtyDaysAgoTime;
  });

  var totalExpensesPages = Math.ceil(displayedExpenses.length / 10) || 1;
  var currentExpenses = displayedExpenses.slice((expensePage - 1) * 10, expensePage * 10);

  var totalIncomesPages = Math.ceil(displayedIncomes.length / 10) || 1;
  var currentIncomes = displayedIncomes.slice((incomePage - 1) * 10, incomePage * 10);

  var totalLogsPages = Math.ceil(reportLogs.length / 10) || 1;
  var currentLogs = reportLogs.slice((logPage - 1) * 10, logPage * 10);

  return (
    <div>
      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .report-page-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          width: 34px;
          height: 32px;
          border: 1px solid var(--border-color);
          border-left: 0;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 0.95rem;
          cursor: pointer;
        }
        .page-item:first-child .report-page-button {
          border-left: 1px solid var(--border-color);
          border-radius: 6px 0 0 6px;
        }
        .page-item:last-child .report-page-button {
          border-radius: 0 6px 6px 0;
        }
        .report-page-button:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .report-page-button.active {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .report-page-button.active:hover {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .page-item.disabled .report-page-button {
          color: #006876;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Laporan Keuangan</h1>
          <p>Monitor pemasukan lunas, catat pengeluaran operasional, dan unduh laporan Excel.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Period Picker */}
          <input
            type="month"
            value={periode}
            onChange={function (e) { setPeriode(e.target.value); }}
            style={{ width: '160px', padding: '10px', fontSize: '0.9rem', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
          <button className="btn btn-primary" onClick={handleExportExcel} disabled={loading || exporting} style={{
            background: 'var(--md-primary-fixed)',
            color: 'var(--md-on-primary-fixed-variant)',
            fontWeight: '700'
          }}>
            <TemplateIcon name="document" size={16} style={{ marginRight: '6px' }} /> {exporting ? 'Menyiapkan...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Notifikasi Transaksi Periode Baru / Kosong */}
      {!loading && displayedExpenses.length === 0 && displayedIncomes.length === 0 && (() => {
        var currentPeriodeParts = periode.split('-');
        var prevMonthDate = new Date(parseInt(currentPeriodeParts[0], 10), parseInt(currentPeriodeParts[1], 10) - 2, 1);
        var prevMonthStr = prevMonthDate.getFullYear() + '-' + String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        var prevMonthName = prevMonthDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        var activeMonthName = new Date(parseInt(currentPeriodeParts[0], 10), parseInt(currentPeriodeParts[1], 10) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            background: 'rgba(2, 136, 209, 0.08)',
            border: '1px solid rgba(2, 136, 209, 0.25)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '0.88rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TemplateIcon name="info" size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <strong>Informasi Periode:</strong> Anda sedang berada di filter periode <strong>{activeMonthName}</strong>. Data transaksi operasional yang dicatat sebelumnya berada pada periode <strong>{prevMonthName}</strong>.
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={function () { setPeriode(prevMonthStr); }}
              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <TemplateIcon name="calendar" size={14} /> Buka Laporan {prevMonthName}
            </button>
          </div>
        );
      })()}

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon hijau"><TemplateIcon name="chart-up" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Pemasukan</span>
            <h3>{loading ? '...' : formatUang(summary.total_pemasukan)}</h3>
            <span className="stat-desc" style={{ color: 'var(--success)' }}>Dari tagihan lunas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon merah"><TemplateIcon name="chart-down" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Pengeluaran</span>
            <h3>{loading ? '...' : formatUang(summary.total_pengeluaran)}</h3>
            <span className="stat-desc" style={{ color: 'var(--danger)' }}>
              Disetujui Finance
              {summary.total_menunggu > 0 && (
                <span style={{ display: 'block', color: 'var(--status-kuning)', fontSize: '0.78rem', marginTop: '2px', fontWeight: '600' }}>
                  ⏳ {formatUang(summary.total_menunggu)} menunggu validasi
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-light)' }}><TemplateIcon name="money" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Laba Bersih (Profit)</span>
            <h3 style={{ color: summary.laba_bersih >= 0 ? 'var(--primary-light)' : 'var(--danger)' }}>
              {loading ? '...' : formatUang(summary.laba_bersih)}
            </h3>
            <span className="stat-desc">Pemasukan - Pengeluaran disetujui</span>
          </div>
        </div>
      </div>

      {/* Grafik Keuangan Bulanan */}
      <div className="chart-container-card animate-fadeIn" style={{ animationDelay: '0.05s' }}>
        <div className="chart-header">
          <div className="chart-title-wrap">
            <h3><TemplateIcon name="chart-up" size={18} style={{ color: 'var(--primary)' }} /> Tren Keuangan Bulanan - Tahun {periode.split('-')[0]}</h3>
            <p>Grafik perbandingan pemasukan lunas dan pengeluaran operasional.</p>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color pemasukan"></span>
              <span>Pemasukan</span>
            </div>
            <div className="legend-item">
              <span className="legend-color pengeluaran"></span>
              <span>Pengeluaran</span>
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <TemplateIcon name="loading" size={24} style={{ marginRight: '8px' }} /> Memuat data grafik...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Tidak ada data grafik untuk tahun ini.
          </div>
        ) : (
          <div className="chart-svg-wrap" style={{ position: 'relative' }}>
            {/* Custom SVG Line Chart */}
            {(() => {
              var svgWidth = 800;
              var svgHeight = 280;
              var paddingLeft = 85;
              var paddingRight = 20;
              var paddingTop = 25;
              var paddingBottom = 35;
              var chartWidth = svgWidth - paddingLeft - paddingRight;
              var chartHeight = svgHeight - paddingTop - paddingBottom;

              var maxVal = 1000000;
              var maxIncom = Math.max(...chartData.map(d => d.pemasukan));
              var maxExp = Math.max(...chartData.map(d => d.pengeluaran));
              var actualMax = Math.max(maxIncom, maxExp, 1000000);
              var magnitude = Math.pow(10, Math.floor(Math.log10(actualMax)));
              if (magnitude === 0) magnitude = 1;
              var normalized = actualMax / magnitude;
              var rounded = Math.ceil(normalized * 2) / 2;
              maxVal = rounded * magnitude;

              var gridLines = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
              var namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
              var selectedMonthIdx = parseInt(periode.split('-')[1], 10) - 1;

              // Generate path points
              var getPoints = (key) => chartData.map((d, i) => {
                var x = paddingLeft + (i / 11) * chartWidth;
                var y = paddingTop + chartHeight - (d[key] / maxVal) * chartHeight;
                return { x, y, val: d[key], index: i };
              });

              var pemasukanPoints = getPoints('pemasukan');
              var pengeluaranPoints = getPoints('pengeluaran');

              var pemasukanPath = pemasukanPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              var pengeluaranPath = pengeluaranPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              var pemasukanAreaPath = pemasukanPoints.length ? `${pemasukanPath} L ${pemasukanPoints[11].x} ${paddingTop + chartHeight} L ${pemasukanPoints[0].x} ${paddingTop + chartHeight} Z` : '';
              var pengeluaranAreaPath = pengeluaranPoints.length ? `${pengeluaranPath} L ${pengeluaranPoints[11].x} ${paddingTop + chartHeight} L ${pengeluaranPoints[0].x} ${paddingTop + chartHeight} Z` : '';

              function formatKependekan(val) {
                if (val >= 1000000000) return 'Rp ' + (val / 1000000000).toFixed(1).replace('.0', '') + 'M';
                if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1).replace('.0', '') + 'Jt';
                if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + 'Rb';
                return 'Rp ' + val;
              }

              return (
                <>
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height={svgHeight} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="grad-pemasukan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                      </linearGradient>
                      <linearGradient id="grad-pengeluaran" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--status-merah)" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="var(--status-merah)" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* Background Highlight for Selected Month */}
                    {selectedMonthIdx >= 0 && selectedMonthIdx <= 11 && (
                      <rect
                        x={paddingLeft + (selectedMonthIdx / 11) * chartWidth - (chartWidth / 22)}
                        y={paddingTop - 10}
                        width={chartWidth / 11}
                        height={chartHeight + 20}
                        fill="var(--primary-glow)"
                        rx="6"
                      />
                    )}

                    {/* Horizontal Grid Lines & Y Labels */}
                    {gridLines.map((v, idx) => {
                      var y = paddingTop + chartHeight - (v / maxVal) * chartHeight;
                      return (
                        <g key={idx}>
                          <line
                            x1={paddingLeft}
                            y1={y}
                            x2={svgWidth - paddingRight}
                            y2={y}
                            stroke="var(--border-color)"
                            strokeDasharray="4 4"
                            strokeWidth="0.8"
                          />
                          <text
                            x={paddingLeft - 12}
                            y={y + 4}
                            fill="var(--text-muted)"
                            fontSize="0.75rem"
                            textAnchor="end"
                            fontFamily="Inter, sans-serif"
                          >
                            {formatKependekan(v)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Vertical Grid Lines & X Labels */}
                    {namaBulan.map((name, i) => {
                      var x = paddingLeft + (i / 11) * chartWidth;
                      var isCurrent = selectedMonthIdx === i;
                      return (
                        <g key={i}>
                          <line
                            x1={x}
                            y1={paddingTop}
                            x2={x}
                            y2={paddingTop + chartHeight}
                            stroke="var(--border-color)"
                            strokeWidth="0.5"
                            opacity="0.3"
                          />
                          <text
                            x={x}
                            y={paddingTop + chartHeight + 18}
                            fill={isCurrent ? 'var(--primary)' : 'var(--text-muted)'}
                            fontSize="0.78rem"
                            fontWeight={isCurrent ? '700' : '500'}
                            textAnchor="middle"
                            fontFamily="Inter, sans-serif"
                          >
                            {name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area Fills */}
                    <path d={pemasukanAreaPath} fill="url(#grad-pemasukan)" />
                    <path d={pengeluaranAreaPath} fill="url(#grad-pengeluaran)" />

                    {/* Line Paths */}
                    <path
                      d={pemasukanPath}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={pengeluaranPath}
                      fill="none"
                      stroke="var(--status-merah)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Vertical Guide Line */}
                    {hoveredIdx !== null && (
                      <line
                        x1={paddingLeft + (hoveredIdx / 11) * chartWidth}
                        y1={paddingTop}
                        x2={paddingLeft + (hoveredIdx / 11) * chartWidth}
                        y2={paddingTop + chartHeight}
                        stroke="var(--primary-light)"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        opacity="0.8"
                      />
                    )}

                    {/* Hover Points */}
                    {hoveredIdx !== null && (
                      <>
                        <circle
                          cx={pemasukanPoints[hoveredIdx].x}
                          cy={pemasukanPoints[hoveredIdx].y}
                          r="5"
                          fill="var(--primary)"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <circle
                          cx={pengeluaranPoints[hoveredIdx].x}
                          cy={pengeluaranPoints[hoveredIdx].y}
                          r="5"
                          fill="var(--status-merah)"
                          stroke="white"
                          strokeWidth="2"
                        />
                      </>
                    )}

                    {/* Invisible Rectangles for Hover Interactions */}
                    {chartData.map((d, i) => {
                      var x = paddingLeft + (i / 11) * chartWidth;
                      return (
                        <rect
                          key={i}
                          x={x - (chartWidth / 22)}
                          y={paddingTop}
                          width={chartWidth / 11}
                          height={chartHeight}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Tooltip */}
                  {hoveredIdx !== null && chartData[hoveredIdx] && (
                    <div
                      className="chart-tooltip"
                      style={{
                        left: `calc(${((paddingLeft + (hoveredIdx / 11) * chartWidth) / svgWidth) * 100}% - 85px)`,
                        top: '15px',
                        position: 'absolute'
                      }}
                    >
                      <div className="tooltip-month">{namaBulan[hoveredIdx]} {periode.split('-')[0]}</div>
                      <div className="tooltip-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }} /> Pemasukan:
                        </span>
                        <span className="tooltip-val" style={{ color: 'var(--primary-light)' }}>
                          Rp {chartData[hoveredIdx].pemasukan.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="tooltip-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', background: 'var(--status-merah)', borderRadius: '50%' }} /> Pengeluaran:
                        </span>
                        <span className="tooltip-val" style={{ color: 'var(--status-merah)' }}>
                          Rp {chartData[hoveredIdx].pengeluaran.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="tooltip-row" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '8px', height: '8px', background: 'var(--status-hijau)', borderRadius: '50%' }} /> Laba:
                        </span>
                        <span className="tooltip-val" style={{ color: chartData[hoveredIdx].laba_bersih >= 0 ? 'var(--status-hijau)' : 'var(--status-merah)' }}>
                          Rp {chartData[hoveredIdx].laba_bersih.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Grid: Pemasukan & Pengeluaran */}
      <div className="reports-tables-grid" style={{ display: 'grid', gap: '24px', width: '100%', marginBottom: '24px' }}>

        {/* Section Pengeluaran (CRUD) */}
        <div className="table-container animate-fadeIn">
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0 }}><TemplateIcon name="money" size={18} style={{ marginRight: '8px' }} /> Pengeluaran Operasional ({displayedExpenses.length})</h3>
              <span className={`status-badge ${filterPengeluaran30Hari ? 'biru' : 'abu_abu'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                <TemplateIcon name="clock" size={11} style={{ marginRight: '4px' }} />
                {filterPengeluaran30Hari ? '30 Hari Terakhir' : 'Semua Riwayat'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={function () { setFilterPengeluaran30Hari(!filterPengeluaran30Hari); setExpensePage(1); }}
                style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Beralih antara menampilkan transaksi 30 hari terakhir atau seluruh riwayat pengeluaran"
              >
                <TemplateIcon name={filterPengeluaran30Hari ? 'folder' : 'calendar'} size={13} />
                <span>{filterPengeluaran30Hari ? 'Buka Arsip (>30 Hari)' : 'Batasi 30 Hari Terakhir'}</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={function () { resetForm(); fetchBerkalaList(); setShowAddModal(true); }}>
                <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Catat Pengeluaran
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : displayedExpenses.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="money" size={28} /></div>
              <p>{filterPengeluaran30Hari ? 'Tidak ada pengeluaran operasional dalam 30 hari terakhir.' : 'Belum ada pengeluaran operasional yang dicatat pada bulan ini.'}</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="data-table" style={{ minWidth: '950px' }}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      <th>Nominal</th>
                      <th>Periode</th>
                      <th>Nama</th>
                      <th>No HP</th>
                      <th>Kategori</th>
                      <th>Tipe</th>
                      <th>Bukti Nota</th>
                      <th>Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExpenses.map(function (item, idx) {
                      var d = item.tanggal ? new Date(item.tanggal) : new Date();
                      var itemPeriode = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                      return (
                        <tr key={item.id_pengeluaran}>
                          <td style={{ color: 'var(--text-muted)' }}>{(expensePage - 1) * 10 + idx + 1}</td>
                          <td>{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ fontWeight: 700, color: item.status === 'disetujui' ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {formatUang(item.nominal)}
                            {item.status !== 'disetujui' && (
                              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                                (Belum potong kas)
                              </span>
                            )}
                          </td>
                          <td><code>{itemPeriode}</code></td>
                          <td style={{ fontWeight: 600 }}>{item.nama_admin || 'Administrator'}</td>
                          <td>{item.no_hp || '-'}</td>
                          <td style={{ fontWeight: 600 }}>{item.kategori}</td>
                          <td>
                            <span className={`status-badge ${item.tipe === 'fix' ? 'hijau' : 'abu_abu'}`}>
                              {item.tipe === 'fix' ? 'Fix (Bulanan)' : 'Tidak Fix'}
                            </span>
                          </td>
                          <td>
                            {item.bukti_nota ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={function () { setPreviewNotaUrl(item.bukti_nota); }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem' }}
                                title="Lihat Foto Bukti Nota / Kuitansi"
                              >
                                <TemplateIcon name="document" size={13} /> Lihat Nota
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                              {item.status === 'disetujui' ? (
                                <span className="status-badge hijau" title={item.nama_validator ? `Disetujui oleh: ${item.nama_validator}` : 'Telah disetujui'}>
                                  <TemplateIcon name="check" size={12} style={{ marginRight: '4px' }} /> Disetujui
                                </span>
                              ) : item.status === 'ditolak' ? (
                                <span className="status-badge merah" title={item.catatan_validasi ? `Alasan: ${item.catatan_validasi}` : 'Ditolak'}>
                                  <TemplateIcon name="close" size={12} style={{ marginRight: '4px' }} /> Ditolak
                                </span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span className="status-badge kuning" title="Menunggu persetujuan Super Admin (Finance)">
                                    <TemplateIcon name="clock" size={12} style={{ marginRight: '4px' }} /> Menunggu
                                  </span>
                                  {isSuperAdmin && (
                                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                                      <button
                                        className="btn btn-sm"
                                        onClick={function () { handleValidateExpense('disetujui', item); }}
                                        style={{ background: 'var(--status-hijau)', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}
                                        title="Setujui pengeluaran ini agar memotong saldo kas"
                                        disabled={actionLoading}
                                      >
                                        <TemplateIcon name="check" size={12} style={{ marginRight: '3px' }} /> Setujui
                                      </button>
                                      <button
                                        className="btn btn-danger btn-sm"
                                        onClick={function () { handleValidateExpense('ditolak', item); }}
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}
                                        title="Tolak pengeluaran ini"
                                        disabled={actionLoading}
                                      >
                                        <TemplateIcon name="close" size={12} style={{ marginRight: '3px' }} /> Tolak
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls for expenses */}
              {renderPagination(expensePage, totalExpensesPages, setExpensePage)}
            </>
          )}
        </div>

        {/* Section Pemasukan */}
        <div className="table-container animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0 }}><TemplateIcon name="chart-up" size={18} style={{ marginRight: '8px' }} /> Pemasukan Real-Time ({displayedIncomes.length})</h3>
              <span className={`status-badge ${filterPemasukan30Hari ? 'biru' : 'abu_abu'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                <TemplateIcon name="clock" size={11} style={{ marginRight: '4px' }} />
                {filterPemasukan30Hari ? '30 Hari Terakhir' : 'Semua Riwayat'}
              </span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={function () { setFilterPemasukan30Hari(!filterPemasukan30Hari); setIncomePage(1); }}
              style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Beralih antara menampilkan transaksi 30 hari terakhir atau seluruh riwayat pemasukan"
            >
              <TemplateIcon name={filterPemasukan30Hari ? 'folder' : 'calendar'} size={13} />
              <span>{filterPemasukan30Hari ? 'Buka Arsip (>30 Hari)' : 'Batasi 30 Hari Terakhir'}</span>
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : displayedIncomes.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="chart-up" size={28} /></div>
              <p>{filterPemasukan30Hari ? 'Tidak ada tagihan lunas dalam 30 hari terakhir.' : 'Belum ada tagihan lunas yang tercatat pada bulan ini.'}</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="data-table" style={{ minWidth: '650px' }}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      <th>Nominal</th>
                      <th>Periode</th>
                      <th>Nama</th>
                      <th>No HP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentIncomes.map(function (item, idx) {
                      return (
                        <tr key={item.id_tagihan}>
                          <td style={{ color: 'var(--text-muted)' }}>{(incomePage - 1) * 10 + idx + 1}</td>
                          <td>{new Date(item.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatUang(item.nominal)}</td>
                          <td><code>{item.periode}</code></td>
                          <td style={{ fontWeight: 600 }}>{item.nama}</td>
                          <td>{item.no_hp}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls for incomes */}
              {renderPagination(incomePage, totalIncomesPages, setIncomePage)}
            </>
          )}
        </div>

      </div>

      {/* Section Riwayat & Log Unduhan Laporan (laporan_bulanan) */}
      <div className="table-container animate-fadeIn" style={{ marginBottom: '32px' }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <TemplateIcon name="chart-up" size={18} style={{ marginRight: '8px', color: 'var(--primary)' }} />
              Riwayat & Log Unduhan Laporan ({reportLogs.length})
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tercatat otomatis ke tabel database <code>laporan_bulanan</code> setiap kali laporan diekspor atau diunduh.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchReportLogs} disabled={logsLoading}>
            <TemplateIcon name="loading" size={14} style={{ marginRight: '6px' }} />
            {logsLoading ? 'Memuat...' : 'Segarkan Log'}
          </button>
        </div>

        {logsLoading ? (
          <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
        ) : reportLogs.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><TemplateIcon name="chart-up" size={28} /></div>
            <p>Belum ada riwayat unduhan laporan. Klik tombol <strong>"Unduh Laporan Excel"</strong> di atas untuk membuat catatan baru.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="data-table" style={{ minWidth: '850px' }}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Waktu Unduh</th>
                    <th>Periode</th>
                    <th>Nama Berkas Laporan</th>
                    <th>Rekap Pemasukan</th>
                    <th>Rekap Pengeluaran</th>
                    <th>Admin / Petugas</th>
                    <th>Tipe</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogs.map(function (log, idx) {
                    return (
                      <tr key={log.id_laporan}>
                        <td style={{ color: 'var(--text-muted)' }}>{(logPage - 1) * 10 + idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(log.generated_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {new Date(log.generated_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} WIB
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.periode}</code>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          <span title={log.file_path} style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {log.file_path || '-'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                          {formatUang(log.total_pemasukan)}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--status-merah)' }}>
                          {formatUang(log.total_pengeluaran)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{log.nama_admin || 'Administrator'}</div>
                          {log.email_admin && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.email_admin}</div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: log.tipe_generate === 'manual' ? 'rgba(40, 98, 146, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: log.tipe_generate === 'manual' ? '#286292' : '#10b981'
                          }}>
                            {log.tipe_generate}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={function () { handleDeleteLog(log.id_laporan); }}
                            title="Hapus baris log ini"
                          >
                            <TemplateIcon name="trash" size={14} style={{ marginRight: '4px' }} /> Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination controls for logs */}
            {renderPagination(logPage, totalLogsPages, setLogPage)}
          </>
        )}
      </div>

      {/* Modal Tambah Pengeluaran */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={function () { setShowAddModal(false); resetForm(); }}
          title={<><TemplateIcon name="plus" size={16} style={{ marginRight: '8px' }} /> Catat Pengeluaran Baru</>}
          footer={
            <>
              <button className="btn btn-secondary" onClick={function () { setShowAddModal(false); resetForm(); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddExpense} disabled={actionLoading || !kategori || !nominal || !tanggal || !buktiNotaFile}>
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Menyimpan...</> : <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Pengeluaran</>}
              </button>
            </>
          }
        >
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Tipe Pengeluaran *</label>
              <select value={tipe} onChange={handleTipeChange} required style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}>
                <option value="tidak_fix">Tambahan (Tidak Fix / Sekali Jalan)</option>
                <option value="fix">Berkala (Fix Bulanan Rutin)</option>
              </select>
            </div>

            {tipe === 'fix' && (
              <div className="form-group animate-fadeIn">
                <label>Pilih Pengeluaran Berkala Terdaftar *</label>
                {berkalaList.length > 0 ? (
                  <select
                    value={selectedBerkala}
                    onChange={handleSelectBerkala}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
                    required={!isNewBerkala}
                  >
                    <option value="">-- Pilih dari riwayat pengeluaran berkala sebelumnya --</option>
                    {berkalaList.map(function (item) {
                      return (
                        <option key={item.kategori} value={item.kategori}>
                          {item.kategori} (Terakhir: {formatUang(item.nominal)})
                        </option>
                      );
                    })}
                    <option value="__NEW__">+ Catat Kategori Rutin Baru Lainnya...</option>
                  </select>
                ) : (
                  <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Belum ada pengeluaran berkala yang tersimpan sebelumnya. Silakan masukkan kategori baru di bawah.
                  </small>
                )}
              </div>
            )}

            {(tipe === 'tidak_fix' || isNewBerkala || berkalaList.length === 0) && (
              <div className="form-group animate-fadeIn">
                <label>{tipe === 'fix' ? 'Nama Kategori Rutin Baru *' : 'Kategori Pengeluaran *'}</label>
                <input
                  type="text"
                  placeholder={tipe === 'fix' ? "Contoh: Sewa Bandwidth, Sewa Kantor, Listrik PLN" : "Contoh: Bensin, Pembelian Kabel Patch Cord"}
                  value={kategori}
                  onChange={function (e) { setKategori(e.target.value); }}
                  required
                />
              </div>
            )}

            {tipe === 'fix' && selectedBerkala && !isNewBerkala && (
              <div className="form-group animate-fadeIn">
                <label>Kategori Pengeluaran Terpilih *</label>
                <input
                  type="text"
                  value={kategori}
                  readOnly
                  style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', fontWeight: 600 }}
                />
                <small style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', color: 'var(--status-hijau, #10b981)', fontSize: '0.78rem' }}>
                  <TemplateIcon name="check" size={13} />
                  <span>Kategori otomatis diambil dari data berkala. Nominal di bawah otomatis terisi dan dapat disesuaikan jika tagihan bulan ini berbeda.</span>
                </small>
              </div>
            )}

            <div className="form-group">
              <label>Nominal (Rp) *</label>
              <input
                type="number"
                placeholder="0"
                value={nominal}
                onChange={function (e) { setNominal(e.target.value); }}
                required
              />
            </div>

            <div className="form-group">
              <label>Tanggal Pengeluaran / Nota *</label>
              <input
                type="date"
                min={isSuperAdmin ? undefined : yesterdayStr}
                max={todayStr}
                value={tanggal}
                onChange={function (e) { setTanggal(e.target.value); }}
                required
              />
              {!isSuperAdmin && (
                <small style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <TemplateIcon name="info" size={13} />
                  <span>Maksimal diinput 1 hari setelah tanggal transaksi (Batas: {yesterdayStr} s/d Hari ini).</span>
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Bukti Pengeluaran / Nota *</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                required
                style={{ padding: '8px' }}
              />
              <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Wajib melampirkan foto struk, kuitansi, atau nota transaksi (JPG, PNG, WEBP, atau PDF. Maks. 5MB).
              </small>
              {buktiNotaPreview && (
                <div style={{ marginTop: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', display: 'inline-block' }}>
                  <img src={buktiNotaPreview} alt="Preview Nota" style={{ maxHeight: '120px', borderRadius: '4px' }} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Keterangan Tambahan</label>
              <textarea
                rows="3"
                placeholder="Tulis rincian pengeluaran di sini (opsional)..."
                value={keterangan}
                onChange={function (e) { setKeterangan(e.target.value); }}
              />
            </div>

            {!isSuperAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <TemplateIcon name="lock" size={15} style={{ flexShrink: 0, color: 'var(--status-kuning, #ca8a04)' }} />
                <span><strong>Pemberitahuan:</strong> Pengeluaran yang dicatat oleh Admin Operasional harus divalidasi terlebih dahulu oleh Super Admin (Finance) sebelum memotong saldo kas/pemasukan.</span>
              </div>
            )}
          </form>
        </Modal>
      )}



      {/* Modal Preview Bukti Pengeluaran / Nota */}
      {previewNotaUrl && (
        <Modal
          isOpen={!!previewNotaUrl}
          onClose={function () { setPreviewNotaUrl(null); }}
          title={<><TemplateIcon name="document" size={16} style={{ marginRight: '8px' }} /> Bukti Pengeluaran / Nota</>}
          footer={
            <>
              <a
                href={previewNotaUrl.startsWith('http') ? previewNotaUrl : `${API_BASE_URL}${previewNotaUrl}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                Buka di Tab Baru
              </a>
              <button className="btn btn-primary" onClick={function () { setPreviewNotaUrl(null); }}>Tutup</button>
            </>
          }
        >
          <div style={{ textAlign: 'center', padding: '10px' }}>
            {previewNotaUrl.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={previewNotaUrl.startsWith('http') ? previewNotaUrl : `${API_BASE_URL}${previewNotaUrl}`}
                title="Preview Nota PDF"
                style={{ width: '100%', height: '500px', border: 'none' }}
              />
            ) : (
              <img
                src={previewNotaUrl.startsWith('http') ? previewNotaUrl : `${API_BASE_URL}${previewNotaUrl}`}
                alt="Bukti Nota Pengeluaran"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}

export default LaporanPage;

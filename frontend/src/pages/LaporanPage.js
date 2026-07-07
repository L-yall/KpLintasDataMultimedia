import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';

function LaporanPage() {
  var today = new Date();
  var defaultPeriode = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

  var [periode, setPeriode] = useState(defaultPeriode);
  var [summary, setSummary] = useState({ total_pemasukan: 0, total_pengeluaran: 0, laba_bersih: 0 });
  var [incomes, setIncomes] = useState([]);
  var [expenses, setExpenses] = useState([]);
  var [loading, setLoading] = useState(true);
  var [yearlyData, setYearlyData] = useState([]);
  var [chartYear, setChartYear] = useState(today.getFullYear());

  // Modals state for CRUD Expenses
  var [showAddModal, setShowAddModal] = useState(false);
  var [showEditModal, setShowEditModal] = useState(false);
  var [editTarget, setEditTarget] = useState(null);

  // Form fields
  var [kategori, setKategori] = useState('');
  var [nominal, setNominal] = useState('');
  var [tipe, setTipe] = useState('tidak_fix');
  var [tanggal, setTanggal] = useState(today.toISOString().split('T')[0]);
  var [keterangan, setKeterangan] = useState('');

  var [actionLoading, setActionLoading] = useState(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchData();
  }, [periode]);

  async function fetchData() {
    setLoading(true);
    try {
      var summaryRes = await axios.get(`http://localhost:3000/api/reports/summary?periode=${periode}`, { headers: headers });
      var detailsRes = await axios.get(`http://localhost:3000/api/reports/details?periode=${periode}`, { headers: headers });
      var selectedYear = periode.split('-')[0];
      var chartRes = await axios.get(`http://localhost:3000/api/reports/yearly-chart?year=${selectedYear}`, { headers: headers });

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
      if (detailsRes.data.success) {
        setIncomes(detailsRes.data.data.pemasukan_list);
        setExpenses(detailsRes.data.data.pengeluaran_list);
      }
      if (chartRes.data.success) {
        setYearlyData(chartRes.data.data.months);
        setChartYear(chartRes.data.data.year);
      }
    } catch (err) {
      console.error('Gagal memuat data laporan keuangan:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      var response = await axios.post('http://localhost:3000/api/pengeluaran', {
        kategori: kategori,
        nominal: Number(nominal),
        tipe: tipe,
        tanggal: tanggal,
        keterangan: keterangan
      }, { headers: headers });

      alert(response.data.message);
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert('Gagal mencatat pengeluaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEditExpense(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      var response = await axios.put(`http://localhost:3000/api/pengeluaran/${editTarget.id_pengeluaran}`, {
        kategori: kategori,
        nominal: Number(nominal),
        tipe: tipe,
        tanggal: tanggal,
        keterangan: keterangan
      }, { headers: headers });

      alert(response.data.message);
      setShowEditModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert('Gagal mengupdate pengeluaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteExpense(id) {
    if (!window.confirm('Apakah Anda yakin ingin MENGHAPUS pengeluaran ini?')) {
      return;
    }
    try {
      var response = await axios.delete(`http://localhost:3000/api/pengeluaran/${id}`, { headers: headers });
      alert(response.data.message);
      fetchData();
    } catch (err) {
      alert('Gagal menghapus pengeluaran: ' + (err.response?.data?.message || err.message));
    }
  }

  function handleOpenEdit(item) {
    setEditTarget(item);
    setKategori(item.kategori);
    setNominal(item.nominal);
    setTipe(item.tipe);
    setTanggal(item.tanggal.split('T')[0]);
    setKeterangan(item.keterangan || '');
    setShowEditModal(true);
  }

  function resetForm() {
    setKategori('');
    setNominal('');
    setTipe('tidak_fix');
    setTanggal(today.toISOString().split('T')[0]);
    setKeterangan('');
    setEditTarget(null);
  }

  async function handleExportExcel() {
    try {
      var response = await axios.get(`http://localhost:3000/api/reports/export-excel?periode=${periode}`, {
        headers: headers,
        responseType: 'blob'
      });

      var blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Keuangan_ESP_${periode}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Gagal mendownload laporan: ' + err.message);
    }
  }

  function formatUang(value) {
    return 'Rp ' + Number(value).toLocaleString('id-ID');
  }

  return (
    <div>
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
          <button className="btn btn-primary" onClick={handleExportExcel} disabled={loading}>
            <TemplateIcon name="document" size={16} style={{ marginRight: '6px' }} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-stats" style={{ marginBottom: '24px' }}>
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
            <span className="stat-desc" style={{ color: 'var(--danger)' }}>Operasional & Fix</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-light)' }}><TemplateIcon name="money" size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Laba Bersih (Profit)</span>
            <h3 style={{ color: summary.laba_bersih >= 0 ? 'var(--primary-light)' : 'var(--danger)' }}>
              {loading ? '...' : formatUang(summary.laba_bersih)}
            </h3>
            <span className="stat-desc">Keuntungan bulan berjalan</span>
          </div>
        </div>
      </div>

      {/* Financial Line Chart */}
      <div className="table-container animate-fadeIn" style={{ marginBottom: '24px' }}>
        <div className="table-header">
          <h3><TemplateIcon name="chart-up" size={18} style={{ marginRight: '8px' }} /> Grafik Keuangan Bulanan — {chartYear}</h3>
        </div>
        <div style={{ padding: '24px 28px 20px' }}>
          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : (
            <FinancialLineChart data={yearlyData} formatUang={formatUang} />
          )}
        </div>
      </div>

      {/* Grid: Pemasukan & Pengeluaran */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', width: '100%' }}>

        {/* Section Pengeluaran (CRUD) */}
        <div className="table-container animate-fadeIn">
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><TemplateIcon name="money" size={18} style={{ marginRight: '8px' }} /> Pengeluaran Operasional ({expenses.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={function () { resetForm(); setShowAddModal(true); }}>
              <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Catat Pengeluaran
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : expenses.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="money" size={28} /></div>
              <p>Belum ada pengeluaran operasional yang dicatat pada bulan ini.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Kategori</th>
                  <th>Tipe</th>
                  <th>Nominal</th>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Petugas</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(function (item, idx) {
                  return (
                    <tr key={item.id_pengeluaran}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{item.kategori}</td>
                      <td>
                        <span className={`status-badge ${item.tipe === 'fix' ? 'hijau' : 'abu_abu'}`}>
                          {item.tipe === 'fix' ? 'Fix (Bulanan)' : 'Tidak Fix'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatUang(item.nominal)}</td>
                      <td>{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.keterangan || '-'}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{item.nama_admin || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-secondary btn-sm" onClick={function () { handleOpenEdit(item); }}><TemplateIcon name="edit" size={14} style={{ marginRight: '6px' }} /> Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={function () { handleDeleteExpense(item.id_pengeluaran); }}><TemplateIcon name="trash" size={14} style={{ marginRight: '6px' }} /> Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Section Pemasukan */}
        <div className="table-container animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><TemplateIcon name="chart-up" size={18} style={{ marginRight: '8px' }} /> Pemasukan Real-Time ({incomes.length})</h3>
            {incomes.length > 10 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TemplateIcon name="info" size={14} /> Gulir ke bawah untuk melihat semua data
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : incomes.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="chart-up" size={28} /></div>
              <p>Belum ada tagihan lunas yang tercatat pada bulan ini.</p>
            </div>
          ) : (
            <div style={{ maxHeight: incomes.length > 10 ? '520px' : 'none', overflowY: incomes.length > 10 ? 'auto' : 'visible' }}>
              <table className="data-table">
                <thead style={{ position: incomes.length > 10 ? 'sticky' : 'static', top: 0, zIndex: 2 }}>
                  <tr>
                    <th>No</th>
                    <th>Nama Pelanggan</th>
                    <th>Nomor HP</th>
                    <th>Periode</th>
                    <th>Nominal Pemasukan</th>
                    <th>Tanggal Bayar</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map(function (item, idx) {
                    return (
                      <tr key={item.id_tagihan}>
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.nama}</td>
                        <td>{item.no_hp}</td>
                        <td><code>{item.periode}</code></td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatUang(item.nominal)}</td>
                        <td>{new Date(item.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
              <button className="btn btn-primary" onClick={handleAddExpense} disabled={actionLoading || !kategori || !nominal || !tanggal}>
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Menyimpan...</> : <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Pengeluaran</>}
              </button>
            </>
          }
        >
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Kategori Pengeluaran *</label>
              <input
                type="text"
                placeholder="Contoh: Sewa Bandwidth, Listrik PLN, Bensin Operasional"
                value={kategori}
                onChange={function (e) { setKategori(e.target.value); }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <label>Tipe Pengeluaran *</label>
                <select value={tipe} onChange={function (e) { setTipe(e.target.value); }} required>
                  <option value="tidak_fix">Tambahan (Tidak Fix)</option>
                  <option value="fix">Berkala (Fix Bulanan)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tanggal Pengeluaran *</label>
              <input
                type="date"
                value={tanggal}
                onChange={function (e) { setTanggal(e.target.value); }}
                required
              />
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
          </form>
        </Modal>
      )}

      {/* Modal Edit Pengeluaran */}
      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={function () { setShowEditModal(false); resetForm(); }}
          title={<><TemplateIcon name="edit" size={16} style={{ marginRight: '8px' }} /> Edit Data Pengeluaran</>}
          footer={
            <>
              <button className="btn btn-secondary" onClick={function () { setShowEditModal(false); resetForm(); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditExpense} disabled={actionLoading || !kategori || !nominal || !tanggal}>
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Menyimpan...</> : <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Perubahan</>}
              </button>
            </>
          }
        >
          <form onSubmit={handleEditExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Kategori Pengeluaran *</label>
              <input
                type="text"
                value={kategori}
                onChange={function (e) { setKategori(e.target.value); }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Nominal (Rp) *</label>
                <input
                  type="number"
                  value={nominal}
                  onChange={function (e) { setNominal(e.target.value); }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipe Pengeluaran *</label>
                <select value={tipe} onChange={function (e) { setTipe(e.target.value); }} required>
                  <option value="tidak_fix">Tambahan (Tidak Fix)</option>
                  <option value="fix">Berkala (Fix Bulanan)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tanggal Pengeluaran *</label>
              <input
                type="date"
                value={tanggal}
                onChange={function (e) { setTanggal(e.target.value); }}
                required
              />
            </div>

            <div className="form-group">
              <label>Keterangan Tambahan</label>
              <textarea
                rows="3"
                value={keterangan}
                onChange={function (e) { setKeterangan(e.target.value); }}
              />
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

/* ============================================
   Financial Line Chart Component
   ============================================ */
function FinancialLineChart({ data, formatUang }) {
  var [tooltip, setTooltip] = useState(null);
  var monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  var W = 780, H = 320;
  var padL = 80, padR = 30, padT = 20, padB = 40;
  var chartW = W - padL - padR;
  var chartH = H - padT - padB;

  var maxVal = useMemo(function () {
    var m = 0;
    if (!data || data.length === 0) return 1;
    data.forEach(function (d) {
      var v = Math.max(Math.abs(d.pemasukan), Math.abs(d.pengeluaran), Math.abs(d.laba_bersih));
      if (v > m) m = v;
    });
    return m || 1;
  }, [data]);

  var yTicks = useMemo(function () {
    var steps = 5;
    var stepSize = Math.ceil(maxVal / steps);
    var magnitude = Math.pow(10, Math.floor(Math.log10(stepSize || 1)));
    var rounded = Math.ceil(stepSize / magnitude) * magnitude;
    var ticks = [];
    for (var i = 0; i <= steps; i++) { ticks.push(i * rounded); }
    return ticks;
  }, [maxVal]);

  var yMax = yTicks[yTicks.length - 1] || 1;

  function getX(idx) { return padL + (idx / 11) * chartW; }
  function getY(val) { return padT + chartH - (Math.abs(val) / yMax) * chartH; }

  function buildPath(key) {
    if (!data || data.length === 0) return '';
    return data.map(function (d, i) {
      return (i === 0 ? 'M' : 'L') + getX(i).toFixed(1) + ',' + getY(d[key]).toFixed(1);
    }).join(' ');
  }

  var lines = [
    { key: 'pemasukan', color: '#0f9d5b', label: 'Total Pemasukan' },
    { key: 'pengeluaran', color: '#dc2626', label: 'Total Pengeluaran' },
    { key: 'laba_bersih', color: '#2563eb', label: 'Laba Bersih' }
  ];

  function formatShort(val) {
    if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1) + 'jt';
    if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + 'rb';
    return 'Rp ' + val;
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes drawLine { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }
        .lc-path { stroke-dasharray: 2000; animation: drawLine 1.5s ease-out forwards; }
        .lc-dot { transition: r 0.15s ease; cursor: pointer; }
      `}</style>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {lines.map(function (l) {
          return (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '3px', borderRadius: '2px', background: l.color }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{l.label}</span>
            </div>
          );
        })}
      </div>

      <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto' }}>
        {/* Grid + Y labels */}
        {yTicks.map(function (tick, i) {
          var y = getY(tick);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border-color-light)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '4,4'} />
              <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)" fontFamily="Hanken Grotesk, sans-serif">{formatShort(tick)}</text>
            </g>
          );
        })}

        {/* X labels */}
        {monthNames.map(function (name, i) {
          var x = getX(i);
          return (
            <g key={i}>
              <line x1={x} y1={padT} x2={x} y2={padT + chartH} stroke="var(--border-color-light)" strokeWidth="0.5" strokeDasharray="2,4" />
              <text x={x} y={H - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-muted)" fontFamily="Hanken Grotesk, sans-serif">{name}</text>
            </g>
          );
        })}

        {/* Area fills */}
        {lines.map(function (l) {
          if (!data || data.length === 0) return null;
          var p = buildPath(l.key);
          var baseY = getY(0);
          return <path key={'a-' + l.key} d={p + ' L' + getX(data.length - 1) + ',' + baseY + ' L' + getX(0) + ',' + baseY + ' Z'} fill={l.color} fillOpacity="0.04" />;
        })}

        {/* Lines */}
        {lines.map(function (l) {
          return <path key={l.key} className="lc-path" d={buildPath(l.key)} fill="none" stroke={l.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
        })}

        {/* Dots */}
        {lines.map(function (l) {
          if (!data) return null;
          return data.map(function (d, i) {
            return <circle key={l.key + i} className="lc-dot" cx={getX(i)} cy={getY(d[l.key])} r={tooltip && tooltip.idx === i ? 5 : 3.5} fill={l.color} stroke="#fff" strokeWidth="2" opacity={tooltip && tooltip.idx === i ? 1 : 0.8} />;
          });
        })}

        {/* Hit areas */}
        {monthNames.map(function (_, i) {
          var w = chartW / 12;
          return <rect key={'h' + i} x={getX(i) - w / 2} y={padT} width={w} height={chartH} fill="transparent" onMouseEnter={function () { setTooltip({ idx: i, d: data[i] }); }} onMouseLeave={function () { setTooltip(null); }} style={{ cursor: 'pointer' }} />;
        })}

        {/* Tooltip line */}
        {tooltip && <line x1={getX(tooltip.idx)} y1={padT} x2={getX(tooltip.idx)} y2={padT + chartH} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />}
      </svg>

      {/* Tooltip card */}
      {tooltip && tooltip.d && (
        <div style={{ position: 'absolute', left: Math.min(getX(tooltip.idx) / W * 100, 72) + '%', top: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', boxShadow: 'var(--shadow-md)', fontSize: '0.82rem', zIndex: 10, minWidth: '180px', pointerEvents: 'none' }}>
          <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{monthNames[tooltip.idx]}</div>
          {lines.map(function (l) {
            return (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>{l.label}:</span>
                <strong style={{ color: l.color, marginLeft: 'auto' }}>{formatUang(tooltip.d[l.key])}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LaporanPage;

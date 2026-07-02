import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';

function LaporanPage() {
  var today = new Date();
  var defaultPeriode = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  
  var [periode, setPeriode] = useState(defaultPeriode);
  var [summary, setSummary] = useState({ total_pemasukan: 0, total_pengeluaran: 0, laba_bersih: 0 });
  var [incomes, setIncomes] = useState([]);
  var [expenses, setExpenses] = useState([]);
  var [loading, setLoading] = useState(true);
  
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

  useEffect(function() {
    fetchData();
  }, [periode]);

  async function fetchData() {
    setLoading(true);
    try {
      var summaryRes = await axios.get(`http://localhost:3000/api/reports/summary?periode=${periode}`, { headers: headers });
      var detailsRes = await axios.get(`http://localhost:3000/api/reports/details?periode=${periode}`, { headers: headers });
      
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
      if (detailsRes.data.success) {
        setIncomes(detailsRes.data.data.pemasukan_list);
        setExpenses(detailsRes.data.data.pengeluaran_list);
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
            onChange={function(e) { setPeriode(e.target.value); }}
            style={{ width: '160px', padding: '10px', fontSize: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
          <button className="btn btn-primary" onClick={handleExportExcel} disabled={loading}>
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-stats" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon hijau">📈</div>
          <div className="stat-info">
            <span className="stat-label">Total Pemasukan</span>
            <h3>{loading ? '...' : formatUang(summary.total_pemasukan)}</h3>
            <span className="stat-desc" style={{ color: 'var(--success)' }}>Dari tagihan lunas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon merah">📉</div>
          <div className="stat-info">
            <span className="stat-label">Total Pengeluaran</span>
            <h3>{loading ? '...' : formatUang(summary.total_pengeluaran)}</h3>
            <span className="stat-desc" style={{ color: 'var(--danger)' }}>Operasional & Fix</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-light)' }}>💰</div>
          <div className="stat-info">
            <span className="stat-label">Laba Bersih (Profit)</span>
            <h3 style={{ color: summary.laba_bersih >= 0 ? 'var(--primary-light)' : 'var(--danger)' }}>
              {loading ? '...' : formatUang(summary.laba_bersih)}
            </h3>
            <span className="stat-desc">Keuntungan bulan berjalan</span>
          </div>
        </div>
      </div>

      {/* Grid: Pemasukan & Pengeluaran */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', width: '100%' }}>
        
        {/* Section Pengeluaran (CRUD) */}
        <div className="table-container animate-fadeIn">
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>💸 Pengeluaran Operasional ({expenses.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={function() { resetForm(); setShowAddModal(true); }}>
              ➕ Catat Pengeluaran
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : expenses.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon">💸</div>
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
                {expenses.map(function(item, idx) {
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
                          <button className="btn btn-secondary btn-sm" onClick={function() { handleOpenEdit(item); }}>✍️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={function() { handleDeleteExpense(item.id_pengeluaran); }}>🗑️ Hapus</button>
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
          <div className="table-header">
            <h3>📈 Pemasukan Real-Time ({incomes.length})</h3>
          </div>

          {loading ? (
            <div style={{ padding: '30px' }}><div className="skeleton skeleton-text" /></div>
          ) : incomes.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon">📈</div>
              <p>Belum ada tagihan lunas yang tercatat pada bulan ini.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
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
                {incomes.map(function(item, idx) {
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
          )}
        </div>

      </div>

      {/* Modal Tambah Pengeluaran */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={function() { setShowAddModal(false); resetForm(); }}
          title="➕ Catat Pengeluaran Baru"
          footer={
            <>
              <button className="btn btn-secondary" onClick={function() { setShowAddModal(false); resetForm(); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddExpense} disabled={actionLoading || !kategori || !nominal || !tanggal}>
                {actionLoading ? '⏳ Menyimpan...' : '✓ Simpan Pengeluaran'}
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
                onChange={function(e) { setKategori(e.target.value); }}
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
                  onChange={function(e) { setNominal(e.target.value); }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipe Pengeluaran *</label>
                <select value={tipe} onChange={function(e) { setTipe(e.target.value); }} required>
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
                onChange={function(e) { setTanggal(e.target.value); }}
                required
              />
            </div>

            <div className="form-group">
              <label>Keterangan Tambahan</label>
              <textarea 
                rows="3" 
                placeholder="Tulis rincian pengeluaran di sini (opsional)..."
                value={keterangan}
                onChange={function(e) { setKeterangan(e.target.value); }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Edit Pengeluaran */}
      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={function() { setShowEditModal(false); resetForm(); }}
          title="✍️ Edit Data Pengeluaran"
          footer={
            <>
              <button className="btn btn-secondary" onClick={function() { setShowEditModal(false); resetForm(); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditExpense} disabled={actionLoading || !kategori || !nominal || !tanggal}>
                {actionLoading ? '⏳ Menyimpan...' : '✓ Simpan Perubahan'}
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
                onChange={function(e) { setKategori(e.target.value); }}
                required
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Nominal (Rp) *</label>
                <input 
                  type="number" 
                  value={nominal}
                  onChange={function(e) { setNominal(e.target.value); }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipe Pengeluaran *</label>
                <select value={tipe} onChange={function(e) { setTipe(e.target.value); }} required>
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
                onChange={function(e) { setTanggal(e.target.value); }}
                required
              />
            </div>

            <div className="form-group">
              <label>Keterangan Tambahan</label>
              <textarea 
                rows="3" 
                value={keterangan}
                onChange={function(e) { setKeterangan(e.target.value); }}
              />
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

export default LaporanPage;

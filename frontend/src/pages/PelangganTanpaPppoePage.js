import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';

function PelangganTanpaPppoePage({ socket }) {
  var { showAlert } = useDialog();
  var [pelanggan, setPelanggan] = useState([]);
  var [paketList, setPaketList] = useState([]);
  var [pppoeSecrets, setPppoeSecrets] = useState([]);
  var [loading, setLoading] = useState(true);

  // Modal Hubungkan PPPoE
  var [assignTarget, setAssignTarget] = useState(null);
  var [selectedPppoe, setSelectedPppoe] = useState('');
  var [assignDueDate, setAssignDueDate] = useState('');
  var [assignLoading, setAssignLoading] = useState(false);
  var [assignError, setAssignError] = useState('');
  var [successNotification, setSuccessNotification] = useState('');

  // Modal Edit Data Pelanggan
  var [editTarget, setEditTarget] = useState(null);
  var [editFormData, setEditFormData] = useState({
    nama: '',
    alamat: '',
    no_hp: '',
    email: '',
    nik: '',
    paket: '',
    due_date: ''
  });
  var [fotoKtp, setFotoKtp] = useState(null);
  var [fotoKtpExisting, setFotoKtpExisting] = useState('');
  var [editError, setEditError] = useState('');
  var [editLoading, setEditLoading] = useState(false);

  // Modal Preview KTP
  var [previewKtp, setPreviewKtp] = useState(null);

  // Modal Konfirmasi Hapus
  var [deleteConfirm, setDeleteConfirm] = useState(null);
  var [deleteLoading, setDeleteLoading] = useState(false);

  // Search & Pagination
  var [searchQuery, setSearchQuery] = useState('');
  var [customerPage, setCustomerPage] = useState(1);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchData();
    fetchPaket();
    fetchPppoeSecrets();

    if (socket) {
      socket.on('pelanggan_updated', fetchData);
      socket.on('registrasi_updated', fetchData);
    }

    return function () {
      if (socket) {
        socket.off('pelanggan_updated', fetchData);
        socket.off('registrasi_updated', fetchData);
      }
    };
  }, [socket]);

  async function fetchData() {
    setLoading(true);
    try {
      var response = await axios.get(`${API_BASE_URL}/api/pelanggan/tanpa-pppoe`, { headers: headers });
      if (response.data.success) {
        setPelanggan(response.data.data || []);
      }
    } catch (err) {
      console.error('Gagal fetch pelanggan tanpa PPPoE:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPaket() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/paket`);
      if (response.data.success) {
        setPaketList(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch paket:', err);
    }
  }

  async function fetchPppoeSecrets() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/mikrotik/secrets`, { headers: headers });
      if (response.data.success) {
        setPppoeSecrets(response.data.data || []);
      }
    } catch (err) {
      console.error('Gagal fetch PPPoE secrets:', err);
    }
  }

  // --- Handlers Hubungkan PPPoE ---
  function openAssignModal(item) {
    setAssignTarget(item);
    setSelectedPppoe('');
    setAssignDueDate(item.due_date ? item.due_date.split('T')[0] : new Date().toISOString().slice(0, 10));
    setAssignError('');
    fetchPppoeSecrets();
  }

  async function handleAssignSubmit(e) {
    if (e) e.preventDefault();
    if (!selectedPppoe) {
      setAssignError('Silakan pilih PPPoE secret dari daftar router Mikrotik.');
      return;
    }

    setAssignLoading(true);
    setAssignError('');
    try {
      var payload = {
        pppoe_username: selectedPppoe,
        due_date: assignDueDate
      };
      var response = await axios.put(`${API_BASE_URL}/api/pelanggan/` + assignTarget.id_pelanggan, payload, { headers: headers });
      if (response.data.success) {
        setAssignTarget(null);
        setSuccessNotification(response.data.message || 'Akun PPPoE berhasil dihubungkan dan notifikasi email aktivasi telah dikirimkan ke pelanggan!');
        fetchData();
        fetchPppoeSecrets();
      }
    } catch (err) {
      var message = err.response?.data?.message || err.response?.data?.error || 'Gagal menghubungkan PPPoE.';
      setAssignError(message);
    } finally {
      setAssignLoading(false);
    }
  }

  // --- Handlers Edit Data ---
  function openEditModal(item) {
    setEditTarget(item);
    setEditFormData({
      nama: item.nama || '',
      alamat: item.alamat || '',
      no_hp: item.no_hp || '',
      email: item.email || '',
      nik: item.nik || '',
      paket: item.paket || '',
      due_date: item.due_date ? item.due_date.split('T')[0] : ''
    });
    setFotoKtp(null);
    setFotoKtpExisting(item.foto || '');
    setEditError('');
  }

  function handleEditChange(e) {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  }

  async function handleEditSubmit(e) {
    if (e) e.preventDefault();
    setEditError('');

    if (!editFormData.nama || !editFormData.no_hp || !editFormData.email) {
      setEditError('Nama, nomor HP, dan email wajib diisi.');
      return;
    }
    if (editFormData.nik && !/^\d{16}$/.test(editFormData.nik)) {
      setEditError('NIK harus terdiri dari 16 digit angka.');
      return;
    }

    setEditLoading(true);
    try {
      if (fotoKtp) {
        var updatePayload = new FormData();
        Object.keys(editFormData).forEach(function (key) { updatePayload.append(key, editFormData[key]); });
        updatePayload.append('foto_ktp', fotoKtp);
        await axios.put(`${API_BASE_URL}/api/pelanggan/` + editTarget.id_pelanggan, updatePayload, { headers: headers });
      } else {
        await axios.put(`${API_BASE_URL}/api/pelanggan/` + editTarget.id_pelanggan, editFormData, { headers: headers });
      }
      setEditTarget(null);
      fetchData();
    } catch (err) {
      var message = err.response?.data?.message || err.response?.data?.error || 'Gagal menyimpan perubahan.';
      setEditError(message);
    } finally {
      setEditLoading(false);
    }
  }

  // --- Handlers Hapus ---
  async function handleDelete(id) {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      var response = await axios.delete(`${API_BASE_URL}/api/pelanggan/` + id, { headers: headers });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Gagal menghapus pelanggan. Silakan coba kembali.');
      }
      setDeleteConfirm(null);
      fetchData();
      showAlert(response.data.message || 'Pelanggan berhasil dihapus.', { tone: 'success' });
    } catch (err) {
      setDeleteConfirm(null);
      showAlert(err.response?.data?.message || err.message || 'Gagal menghapus pelanggan. Silakan coba kembali.', {
        title: 'Gagal menghapus pelanggan',
        tone: 'error'
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Filter & Pagination
  var filteredPelanggan = pelanggan.filter(function (item) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    return (
      (item.nama && item.nama.toLowerCase().includes(q)) ||
      (item.no_hp && item.no_hp.includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.paket && item.paket.toLowerCase().includes(q)) ||
      (item.alamat && item.alamat.toLowerCase().includes(q)) ||
      (item.nik && item.nik.includes(q))
    );
  });

  var customersPerPage = 10;
  var totalCustomerPages = Math.ceil(filteredPelanggan.length / customersPerPage) || 1;
  var currentCustomers = filteredPelanggan.slice(
    (customerPage - 1) * customersPerPage,
    customerPage * customersPerPage
  );

  useEffect(function () {
    setCustomerPage(1);
  }, [searchQuery]);

  useEffect(function () {
    if (customerPage > totalCustomerPages) {
      setCustomerPage(totalCustomerPages);
    }
  }, [customerPage, totalCustomerPages]);

  function renderPagination() {
    if (totalCustomerPages <= 1) return null;

    var pages = [];
    for (var page = 1; page <= totalCustomerPages; page++) pages.push(page);

    return (
      <nav aria-label="Page navigation" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (customerPage === 1 ? ' disabled' : '')}>
            <a href="#" className="customer-page-button page-link" onClick={function (e) { e.preventDefault(); if (customerPage !== 1) setCustomerPage(Math.max(1, customerPage - 1)); }} aria-label="Previous" aria-disabled={customerPage === 1} tabIndex={customerPage === 1 ? -1 : undefined}><span aria-hidden="true">«</span><span className="sr-only">Previous</span></a>
          </li>
          {pages.map(function (pageNumber) {
            return (
              <li key={pageNumber}>
                <a href="#" className={'customer-page-button page-link' + (customerPage === pageNumber ? ' active' : '')} onClick={function (e) { e.preventDefault(); setCustomerPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={customerPage === pageNumber ? 'page' : undefined}>{pageNumber}</a>
              </li>
            );
          })}
          <li className={'page-item' + (customerPage === totalCustomerPages ? ' disabled' : '')}>
            <a href="#" className="customer-page-button page-link" onClick={function (e) { e.preventDefault(); if (customerPage !== totalCustomerPages) setCustomerPage(Math.min(totalCustomerPages, customerPage + 1)); }} aria-label="Next" aria-disabled={customerPage === totalCustomerPages} tabIndex={customerPage === totalCustomerPages ? -1 : undefined}><span aria-hidden="true">»</span><span className="sr-only">Next</span></a>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Data Pelanggan Belum PPPoE</h2>
          <p>Kelola data pelanggan yang belum memiliki atau belum terhubung dengan PPPoE Secret Mikrotik.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={function () { fetchData(); fetchPppoeSecrets(); }}>
            <TemplateIcon name="loading" size={14} style={{ marginRight: '6px' }} /> Refresh
          </button>
          <Link to="/dashboard/pelanggan?action=tambah" className="btn btn-primary"
            style={{
              background: 'var(--md-primary-fixed)',
              color: 'var(--md-on-primary-fixed-variant)',
              fontWeight: '700'
            }}>
            <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Pelanggan
          </Link>
        </div>
      </div>

      {/* Info Notice Box */}
      {pelanggan.length > 0 && (
        <div style={{
          background: '#fff9e6',
          border: '1px solid #ffe58f',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#873800',
          fontSize: '0.9rem'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: '#fa8c16' }}>info</span>
          <div>
            <strong>Panduan:</strong> Pelanggan pada daftar ini belum memiliki akun PPPoE di router. Klik tombol <strong>Hubungkan</strong> untuk memilih PPPoE secret dari router Mikrotik agar koneksi WiFi dan pemantauan status tagihan dapat aktif.
          </div>
        </div>
      )}

      {/* Alert Sukses Hubungkan PPPoE */}
      {successNotification && (
        <div style={{
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#135200', fontSize: '0.9rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#52c41a' }}>mark_email_read</span>
            <span>{successNotification}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link
              to="/dashboard/pelanggan"
              className="btn btn-sm"
              style={{
                background: '#135200',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Buka Data Pelanggan <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </Link>
            <button
              type="button"
              onClick={function () { setSuccessNotification(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#135200', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3><TemplateIcon name="users" size={18} style={{ marginRight: '8px' }} /> Antrean PPPoE ({filteredPelanggan.length})</h3>
          <div className="table-header-actions">
            <input
              type="text"
              placeholder="Cari nama, HP, NIK, paket..."
              value={searchQuery}
              onChange={function (e) { setSearchQuery(e.target.value); }}
              style={{ width: '280px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            {[1, 2, 3].map(function (i) {
              return (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="skeleton" style={{ width: '30%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '20%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '25%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '16px' }}></div>
                </div>
              );
            })}
          </div>
        ) : filteredPelanggan.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><TemplateIcon name="check" size={28} /></div>
            <p>{searchQuery ? 'Tidak ada data pelanggan yang cocok dengan pencarian.' : 'Semua pelanggan sudah terdaftar PPPoE-nya.'}</p>
          </div>
        ) : (
          <>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                  <th>Nama</th>
                  <th>Kontak (HP/Email)</th>
                  <th>NIK & KTP</th>
                  <th>Paket</th>
                  <th>Harga</th>
                  <th>Jatuh Tempo</th>
                  <th>Status PPPoE</th>
                  <th style={{ textAlign: 'center', width: '165px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.map(function (item, idx) {
                  return (
                    <tr key={item.id_pelanggan}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {(customerPage - 1) * customersPerPage + idx + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.nama}</div>
                        {item.alamat && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <TemplateIcon name="router" size={13} style={{ marginRight: '6px' }} />
                            {item.alamat.length > 35 ? item.alamat.substring(0, 35) + '...' : item.alamat}
                          </div>
                        )}
                      </td>
                      <td>
                        <div><TemplateIcon name="router" size={13} style={{ marginRight: '6px' }} /> {item.no_hp}</div>
                        {item.email && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <TemplateIcon name="mail" size={13} style={{ marginRight: '6px' }} /> {item.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.nik || '-'}</div>
                        {item.foto && (
                          <button
                            type="button"
                            onClick={function () { setPreviewKtp(API_BASE_URL + item.foto); }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--primary)',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              marginTop: '2px'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>image</span> Lihat KTP
                          </button>
                        )}
                      </td>
                      <td>{item.paket || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td>{item.harga ? 'Rp ' + Number(item.harga).toLocaleString('id-ID') : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td>{formatTanggal(item.due_date)}</td>
                      <td>
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--status-merah, #ef4444)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>link_off</span>
                          Belum Dikonfigurasi
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={function () { openAssignModal(item); }}
                            title="Hubungkan PPPoE Secret"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.78rem',
                              padding: '5px 9px',
                              fontWeight: 600
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>link</span>
                            Hubungkan
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={function () { openEditModal(item); }}
                            title="Edit"
                          >
                            <TemplateIcon name="edit" size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={function () { setDeleteConfirm(item.id_pelanggan); }}
                            title="Hapus"
                          >
                            <TemplateIcon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </>
        )}
      </div>

      {/* Modal Hubungkan PPPoE */}
      <Modal
        isOpen={assignTarget !== null}
        onClose={function () { if (!assignLoading) setAssignTarget(null); }}
        title={<><span className="material-symbols-outlined" style={{ marginRight: '8px', verticalAlign: 'middle' }}>router</span> Hubungkan PPPoE Secret Mikrotik</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function () { setAssignTarget(null); }} disabled={assignLoading}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleAssignSubmit} disabled={assignLoading || !selectedPppoe}>
              {assignLoading ? 'Menyimpan...' : 'Simpan & Hubungkan PPPoE'}
            </button>
          </>
        }
      >
        {assignTarget && (
          <form onSubmit={handleAssignSubmit}>
            {assignError && (
              <div className="login-error" role="alert" style={{ marginBottom: '16px' }}>
                {assignError}
              </div>
            )}

            {/* Target Customer Info Box */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              border: '1px solid var(--border-color)',
              fontSize: '0.88rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><strong>Pelanggan:</strong> {assignTarget.nama}</div>
                <div><strong>No HP:</strong> {assignTarget.no_hp}</div>
                <div><strong>Paket:</strong> {assignTarget.paket || '-'}</div>
                <div><strong>NIK:</strong> {assignTarget.nik || '-'}</div>
              </div>
              <div style={{ marginTop: '6px' }}><strong>Alamat:</strong> {assignTarget.alamat || '-'}</div>
            </div>

            <div className="form-group">
              <label>Pilih PPPoE Secret (Mikrotik) *</label>
              {pppoeSecrets.length > 0 ? (
                <select
                  value={selectedPppoe}
                  onChange={function (e) { setSelectedPppoe(e.target.value); }}
                  required
                >
                  <option value="">-- Pilih PPPoE Secret --</option>
                  {pppoeSecrets.map(function (secret) {
                    return (
                      <option key={secret.name} value={secret.name} disabled={secret.is_registered}>
                        {secret.name} ({secret.profile || 'default'}){secret.is_registered ? ' - sudah terdaftar' : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ketik username PPPoE di router"
                  value={selectedPppoe}
                  onChange={function (e) { setSelectedPppoe(e.target.value); }}
                  required
                />
              )}
              <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Pastikan secret PPPoE sudah dibuat di RouterOS Mikrotik sebelum menghubungkan.
              </small>
            </div>

            <div className="form-group">
              <label>Tanggal Jatuh Tempo *</label>
              <input
                type="date"
                value={assignDueDate}
                onChange={function (e) { setAssignDueDate(e.target.value); }}
                required
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Edit Pelanggan */}
      <Modal
        isOpen={editTarget !== null}
        onClose={function () { if (!editLoading) setEditTarget(null); }}
        title={<><TemplateIcon name="edit" size={16} style={{ marginRight: '8px' }} /> Edit Data Pelanggan</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function () { setEditTarget(null); }} disabled={editLoading}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </>
        }
      >
        {editTarget && (
          <form onSubmit={handleEditSubmit}>
            {editError && (
              <div className="login-error" role="alert" style={{ marginBottom: '16px' }}>
                {editError}
              </div>
            )}
            <div className="form-group">
              <label>Nama Pelanggan *</label>
              <input
                type="text"
                name="nama"
                value={editFormData.nama}
                onChange={handleEditChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Nomor HP / WhatsApp *</label>
              <input
                type="text"
                name="no_hp"
                value={editFormData.no_hp}
                onChange={handleEditChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Pelanggan *</label>
              <input
                type="email"
                name="email"
                value={editFormData.email}
                onChange={handleEditChange}
                required
              />
            </div>
            <div className="form-group">
              <label>NIK (16 Digit)</label>
              <input
                type="text"
                name="nik"
                inputMode="numeric"
                maxLength={16}
                value={editFormData.nik}
                onChange={handleEditChange}
              />
            </div>
            <div className="form-group">
              <label>Foto KTP</label>
              {fotoKtpExisting && (
                <div style={{ marginBottom: '8px' }}>
                  <img src={API_BASE_URL + fotoKtpExisting} alt="KTP" style={{ maxHeight: '100px', borderRadius: '4px' }} />
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={function (e) { setFotoKtp(e.target.files[0] || null); }}
              />
            </div>
            <div className="form-group">
              <label>Alamat Pemasangan WiFi</label>
              <textarea
                name="alamat"
                value={editFormData.alamat}
                onChange={handleEditChange}
                rows={2}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Paket Layanan</label>
                <select name="paket" value={editFormData.paket} onChange={handleEditChange}>
                  <option value="">-- Pilih Paket --</option>
                  {paketList.map(function (p) {
                    return (
                      <option key={p.id} value={p.nama_paket}>
                        {p.nama_paket} - Rp {Number(p.harga).toLocaleString('id-ID')}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label>Tanggal Jatuh Tempo</label>
                <input
                  type="date"
                  name="due_date"
                  value={editFormData.due_date}
                  onChange={handleEditChange}
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Preview KTP */}
      <Modal
        isOpen={previewKtp !== null}
        onClose={function () { setPreviewKtp(null); }}
        title="Foto KTP Pelanggan"
        footer={<button className="btn btn-secondary" onClick={function () { setPreviewKtp(null); }}>Tutup</button>}
      >
        {previewKtp && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewKtp}
              alt="Preview KTP"
              style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
        )}
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={function () { if (!deleteLoading) setDeleteConfirm(null); }}
        title={<><TemplateIcon name="trash" size={16} style={{ marginRight: '8px' }} /> Konfirmasi Hapus</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function () { setDeleteConfirm(null); }} disabled={deleteLoading}>
              Batal
            </button>
            <button className="btn btn-danger" onClick={function () { handleDelete(deleteConfirm); }} disabled={deleteLoading}>
              {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Apakah Anda yakin ingin menghapus data pelanggan ini? Data akan dihapus secara permanen dari sistem.
        </p>
      </Modal>
    </div>
  );
}

export default PelangganTanpaPppoePage;

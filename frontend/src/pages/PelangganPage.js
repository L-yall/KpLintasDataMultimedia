import React, { useState, useEffect } from 'react';
import axios from 'axios';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';

function PelangganPage({ socket }) {
  var [pelanggan, setPelanggan] = useState([]);
  var [paketList, setPaketList] = useState([]);
  var [pppoeSecrets, setPppoeSecrets] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [editMode, setEditMode] = useState(false);
  var [editId, setEditId] = useState(null);
  var [fotoKtp, setFotoKtp] = useState(null);
  var [fotoKtpExisting, setFotoKtpExisting] = useState('');
  var [deleteConfirm, setDeleteConfirm] = useState(null);
  var [formData, setFormData] = useState({
    nama: '',
    alamat: '',
    no_hp: '',
    email: '',
    password: '',
    nik: '',
    paket: '',
    pppoe_username: '',
    due_date: ''
  });
  var [formError, setFormError] = useState('');
  var [showCustomerPassword, setShowCustomerPassword] = useState(false);
  var [searchQuery, setSearchQuery] = useState('');
  var [customerPage, setCustomerPage] = useState(1);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchPelanggan();
    fetchPaket();
    fetchPppoeSecrets();

    // Auto-open Add Customer modal if action=tambah query is present
    var query = new URLSearchParams(window.location.search);
    if (query.get('action') === 'tambah') {
      openAddModal();
    }

    if (socket) {
      socket.on('pelanggan_updated', function (data) {
        setPelanggan(function (prevList) {
          return prevList.map(function (p) {
            if (p.id_pelanggan === data.id_pelanggan) {
              return { ...p, pppoe_status: data.pppoe_status };
            }
            return p;
          });
        });
      });
    }

    return function () {
      if (socket) {
        socket.off('pelanggan_updated');
      }
    };
  }, [socket]);

  async function fetchPelanggan() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/pelanggan`, { headers: headers });
      if (response.data.success) {
        setPelanggan(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch pelanggan:', err);
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
        setPppoeSecrets(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch PPPoE secrets (mikrotik offline/error):', err.message);
    }
  }

  function openAddModal() {
    setFormData({
      nama: '', alamat: '', no_hp: '', email: '', password: '', nik: '', paket: '', pppoe_username: '', due_date: ''
    });
    setFotoKtp(null);
    setFotoKtpExisting('');
    setFormError('');
    setEditMode(false);
    setEditId(null);
    fetchPppoeSecrets();
    setShowModal(true);
  }

  function openEditModal(item) {
    setFormData({
      nama: item.nama || '',
      alamat: item.alamat || '',
      no_hp: item.no_hp || '',
      email: item.email || '',
      password: '',
      nik: item.nik || '',
      paket: item.paket || '',
      pppoe_username: item.pppoe_username || '',
      due_date: item.due_date ? item.due_date.split('T')[0] : ''
    });
    setFotoKtp(null);
    setFotoKtpExisting(item.foto || '');
    setFormError('');
    setEditMode(true);
    setEditId(item.id_pelanggan);
    fetchPppoeSecrets();
    setShowModal(true);
  }



  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setFormError('');

    if (!formData.nama || !formData.no_hp || !formData.email || (!editMode && !formData.password)) {
      setFormError('Nama, nomor HP, email, dan password wajib diisi.');
      return;
    }
    if (!editMode && (!/^\d{16}$/.test(formData.nik) || !fotoKtp)) {
      setFormError('NIK harus 16 digit dan foto KTP wajib diunggah.');
      return;
    }
    if (editMode && formData.nik && !/^\d{16}$/.test(formData.nik)) {
      setFormError('NIK harus terdiri dari 16 digit angka.');
      return;
    }

    try {
      if (editMode) {
        if (fotoKtp) {
          var updatePayload = new FormData();
          Object.keys(formData).forEach(function (key) { updatePayload.append(key, formData[key]); });
          updatePayload.append('foto_ktp', fotoKtp);
          await axios.put(`${API_BASE_URL}/api/pelanggan/` + editId, updatePayload, { headers: headers });
        } else {
          await axios.put(`${API_BASE_URL}/api/pelanggan/` + editId, formData, { headers: headers });
        }
      } else {
        var payload = new FormData();
        Object.keys(formData).forEach(function (key) { payload.append(key, formData[key]); });
        payload.append('foto_ktp', fotoKtp);
        await axios.post(`${API_BASE_URL}/api/pelanggan`, payload, { headers: headers });
      }
      setShowModal(false);
      setFotoKtp(null);
      setFotoKtpExisting('');
      fetchPelanggan();
    } catch (err) {
      var message = err.response?.data?.message || 'Terjadi kesalahan.';
      setFormError(message);
    }
  }

  async function handleDelete(id) {
    try {
      await axios.delete(`${API_BASE_URL}/api/pelanggan/` + id, { headers: headers });
      setDeleteConfirm(null);
      fetchPelanggan();
    } catch (err) {
      console.error('Gagal hapus pelanggan:', err);
    }
  }

  var filteredPelanggan = pelanggan.filter(function (item) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    return (
      (item.nama && item.nama.toLowerCase().includes(q)) ||
      (item.no_hp && item.no_hp.includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.pppoe_username && item.pppoe_username.toLowerCase().includes(q)) ||
      (item.paket && item.paket.toLowerCase().includes(q))
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
              <li
                key={pageNumber}
              >
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

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // FUNGSI BARU: Penentu Status Dinamis
  function hitungStatusDinamis(dueDate, pppoeStatus) {
    // 1. Cek jika internet mati / PPPoE offline (menimpa semua status tanggal)
    if (pppoeStatus === 'inactive' || pppoeStatus === 'offline' || pppoeStatus === false) {
      return 'abu_abu';
    }

    if (!dueDate) return 'abu_abu'; // Jika belum diset tanggalnya

    // 2. Ambil tanggal hari ini, set jam ke 00:00 agar hitungan murni beda hari
    var hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    // 3. Ambil tanggal jatuh tempo
    var tanggalJT = new Date(dueDate);
    tanggalJT.setHours(0, 0, 0, 0);

    // 4. Hitung selisih
    var selisihWaktu = tanggalJT.getTime() - hariIni.getTime();
    var selisihHari = Math.ceil(selisihWaktu / (1000 * 60 * 60 * 24));

    // 5. Kembalikan key yang sesuai dengan data di StatusBadge.js
    if (selisihHari < 0) {
      return 'merah';      // Sudah lewat jatuh tempo
    } else if (selisihHari >= 0 && selisihHari <= 3) {
      return 'kuning';     // H-3 sampai hari H
    } else {
      return 'hijau';      // Masih di atas 3 hari (Aman/Lunas)
    }
  }

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
        .customer-page-button {
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
        .page-item:first-child .customer-page-button {
          border-left: 1px solid var(--border-color);
          border-radius: 6px 0 0 6px;
        }
        .page-item:last-child .customer-page-button {
          border-radius: 0 6px 6px 0;
        }
        .customer-page-button:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .customer-page-button.active {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .customer-page-button.active:hover {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .page-item.disabled .customer-page-button {
          color: #006876;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>
      <div className="page-header">
        <div>
          <h1>Data Pelanggan</h1>
          <p>Kelola seluruh data pelanggan ISP ESP Lintas Data.</p>
        </div>
        <button id="btn-tambah-pelanggan" className="btn btn-primary" onClick={openAddModal} style={{
          background: 'var(--md-primary-fixed)',
          color: 'var(--md-on-primary-fixed-variant)',
          fontWeight: '700'
        }}>
          <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Pelanggan
        </button>
      </div>

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3><TemplateIcon name="users" size={18} style={{ marginRight: '8px' }} /> Daftar Pelanggan ({filteredPelanggan.length})</h3>
          <div className="table-header-actions">
            <input
              type="text"
              placeholder="Cari nama, HP, PPPoE..."
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
            <div className="table-empty-icon"><TemplateIcon name="users" size={28} /></div>
            <p>{searchQuery ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Belum ada data pelanggan.'}</p>
            {!searchQuery && (
              <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ marginTop: '16px' }}>
                <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Pelanggan Pertama
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Kontak (HP/Email)</th>
                  <th>Paket</th>
                  <th>Harga</th>
                  <th>PPPoE Username</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.map(function (item, idx) {
                  // MEMANGGIL FUNGSI DINAMIS DI SINI
                  var statusTabel = hitungStatusDinamis(item.due_date, item.pppoe_status);

                  return (
                    <tr key={item.id_pelanggan}>
                      <td style={{ color: 'var(--text-muted)' }}>{(customerPage - 1) * customersPerPage + idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.nama}</div>
                        {item.alamat && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <TemplateIcon name="router" size={13} style={{ marginRight: '6px' }} /> {item.alamat.length > 30 ? item.alamat.substring(0, 30) + '...' : item.alamat}
                          </div>
                        )}
                      </td>
                      <td>
                        <div><TemplateIcon name="router" size={13} style={{ marginRight: '6px' }} /> {item.no_hp}</div>
                        {item.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><TemplateIcon name="mail" size={13} style={{ marginRight: '6px' }} /> {item.email}</div>}
                      </td>
                      <td>{item.paket || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td>{item.harga ? 'Rp ' + Number(item.harga).toLocaleString('id-ID') : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td>
                        {item.pppoe_username ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: item.pppoe_status === 'active' ? 'var(--status-hijau)' : 'var(--status-merah)',
                                boxShadow: item.pppoe_status === 'active' ? '0 0 6px var(--status-hijau)' : 'none',
                                display: 'inline-block'
                              }}
                              title={item.pppoe_status === 'active' ? 'PPPoE Active / Online' : 'PPPoE Inactive / Offline'}
                            />
                            <code style={{
                              background: 'var(--bg-tertiary)',
                              padding: '2px 8px',
                              borderRadius: '5px',
                              fontSize: '0.8rem',
                              color: item.pppoe_status === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}>
                              {item.pppoe_username}
                            </code>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>{formatTanggal(item.due_date)}</td>

                      {/* IMPLEMENTASI STATUS KE COMPONENT STATUS BADGE */}
                      <td><StatusBadge status={statusTabel} /></td>

                      <td>
                        <div className="table-actions">
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

      {/* Modal Tambah/Edit Pelanggan */}
      <Modal
        isOpen={showModal}
        onClose={function () { setShowModal(false); }}
        title={editMode ? <><TemplateIcon name="edit" size={16} style={{ marginRight: '8px' }} /> Edit Pelanggan</> : <><TemplateIcon name="plus" size={16} style={{ marginRight: '8px' }} /> Tambah Pelanggan Baru</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function () { setShowModal(false); }}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editMode ? <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Perubahan</> : <><TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Pelanggan</>}
            </button>
          </>
        }
      >
        {formError && (
          <div className="login-error" style={{ marginBottom: '16px' }}>
            <TemplateIcon name="alert" size={16} style={{ marginRight: '6px' }} /> {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nama Pelanggan *</label>
            <input
              type="text"
              name="nama"
              placeholder="Masukkan nama lengkap"
              value={formData.nama}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Nomor HP / WhatsApp *</label>
            <input
              type="text"
              name="no_hp"
              placeholder="08xxxxxxxxxx"
              value={formData.no_hp}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Email Pelanggan</label>
            <input
              type="email"
              name="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          {!editMode && (
            <div className="form-group">
              <label>Password Pelanggan * (Min. 6 Karakter)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showCustomerPassword ? "text" : "password"}
                  name="password"
                  placeholder="Masukkan password login pelanggan"
                  value={formData.password}
                  onChange={handleChange}
                  minLength={6}
                  required
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={function () { setShowCustomerPassword(!showCustomerPassword); }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: showCustomerPassword ? 'var(--primary, #006876)' : 'var(--text-muted, #888)'
                  }}
                  title={showCustomerPassword ? "Sembunyikan password" : "Lihat password"}
                  aria-label={showCustomerPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  <TemplateIcon name={showCustomerPassword ? "eye-off" : "eye"} size={18} />
                </button>
              </div>
            </div>
          )}
          <div className="form-group">
            <label>NIK{editMode ? '' : ' *'}</label>
            <input
              type="text"
              name="nik"
              inputMode="numeric"
              pattern="[0-9]{16}"
              minLength={16}
              maxLength={16}
              placeholder="Masukkan 16 digit NIK"
              value={formData.nik}
              onChange={handleChange}
              required={!editMode}
            />
          </div>
          <div className="form-group">
            <label>Foto KTP{editMode ? '' : ' *'}</label>
            {editMode && fotoKtpExisting && (
              <a href={API_BASE_URL + fotoKtpExisting} target="_blank" rel="noreferrer">
                <img src={API_BASE_URL + fotoKtpExisting} alt="Foto KTP saat ini" style={{ display: 'block', maxWidth: '180px', maxHeight: '120px', objectFit: 'contain', marginBottom: '10px' }} />
              </a>
            )}
            <input
              type="file"
              name="foto_ktp"
              accept="image/jpeg,image/png,image/webp"
              onChange={function (event) { setFotoKtp(event.target.files[0] || null); }}
              required={!editMode}
            />
            <small>{editMode && fotoKtpExisting ? 'Pilih file hanya jika ingin mengganti foto. ' : ''}Format JPG, PNG, atau WEBP. Maksimal 5 MB.</small>
          </div>
          <div className="form-group">
            <label>Alamat Pemasangan WiFi</label>
            <textarea
              name="alamat"
              placeholder="Alamat lengkap pelanggan"
              value={formData.alamat}
              onChange={handleChange}
              rows={2}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Paket Layanan</label>
              <select name="paket" value={formData.paket} onChange={handleChange}>
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
                value={formData.due_date}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-group">
            <label>PPPoE Username (Mikrotik)</label>
            {pppoeSecrets.length > 0 ? (
              <select name="pppoe_username" value={formData.pppoe_username} onChange={handleChange}>
                <option value="">-- Pilih PPPoE Secret --</option>
                {pppoeSecrets.map(function (secret) {
                  return (
                    <option key={secret.name} value={secret.name}>
                      {secret.name} ({secret.profile || 'default'})
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                name="pppoe_username"
                placeholder="Username PPPoE di router"
                value={formData.pppoe_username}
                onChange={handleChange}
              />
            )}
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={function () { setDeleteConfirm(null); }}
        title={<><TemplateIcon name="trash" size={16} style={{ marginRight: '8px' }} /> Konfirmasi Hapus</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function () { setDeleteConfirm(null); }}>Batal</button>
            <button className="btn btn-danger" onClick={function () { handleDelete(deleteConfirm); }}>
              <TemplateIcon name="trash" size={14} style={{ marginRight: '6px' }} /> Ya, Hapus
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Apakah Anda yakin ingin menghapus pelanggan ini? Data akan dihapus secara permanen.
        </p>
      </Modal>
    </div>
  );
}

export default PelangganPage;
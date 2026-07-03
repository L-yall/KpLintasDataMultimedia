import React, { useState, useEffect } from 'react';
import axios from 'axios';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

function PelangganPage({ socket }) {
  var [pelanggan, setPelanggan] = useState([]);
  var [paketList, setPaketList] = useState([]);
  var [pppoeSecrets, setPppoeSecrets] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [editMode, setEditMode] = useState(false);
  var [editId, setEditId] = useState(null);
  var [deleteConfirm, setDeleteConfirm] = useState(null);
  var [formData, setFormData] = useState({
    nama: '',
    alamat: '',
    no_hp: '',
    email: '',
    paket: '',
    pppoe_username: '',
    due_date: ''
  });
  var [formError, setFormError] = useState('');
  var [searchQuery, setSearchQuery] = useState('');

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function() {
    fetchPelanggan();
    fetchPaket();
    fetchPppoeSecrets();

    if (socket) {
      socket.on('pelanggan_updated', function(data) {
        setPelanggan(function(prevList) {
          return prevList.map(function(p) {
            if (p.id_pelanggan === data.id_pelanggan) {
              return { ...p, pppoe_status: data.pppoe_status };
            }
            return p;
          });
        });
      });
    }

    return function() {
      if (socket) {
        socket.off('pelanggan_updated');
      }
    };
  }, [socket]);

  async function fetchPelanggan() {
    try {
      var response = await axios.get('http://localhost:3000/api/pelanggan', { headers: headers });
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
      var response = await axios.get('http://localhost:3000/api/paket');
      if (response.data.success) {
        setPaketList(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch paket:', err);
    }
  }

  async function fetchPppoeSecrets() {
    try {
      var response = await axios.get('http://localhost:3000/api/mikrotik/secrets', { headers: headers });
      if (response.data.success) {
        setPppoeSecrets(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch PPPoE secrets (mikrotik offline/error):', err.message);
    }
  }

  function openAddModal() {
    setFormData({
      nama: '', alamat: '', no_hp: '', email: '', paket: '', pppoe_username: '', due_date: ''
    });
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
      paket: item.paket || '',
      pppoe_username: item.pppoe_username || '',
      due_date: item.due_date ? item.due_date.split('T')[0] : ''
    });
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

    if (!formData.nama || !formData.no_hp) {
      setFormError('Nama dan Nomor HP wajib diisi.');
      return;
    }

    try {
      if (editMode) {
        await axios.put('http://localhost:3000/api/pelanggan/' + editId, formData, { headers: headers });
      } else {
        await axios.post('http://localhost:3000/api/pelanggan', formData, { headers: headers });
      }
      setShowModal(false);
      fetchPelanggan();
    } catch (err) {
      var message = err.response?.data?.message || 'Terjadi kesalahan.';
      setFormError(message);
    }
  }

  async function handleDelete(id) {
    try {
      await axios.delete('http://localhost:3000/api/pelanggan/' + id, { headers: headers });
      setDeleteConfirm(null);
      fetchPelanggan();
    } catch (err) {
      console.error('Gagal hapus pelanggan:', err);
    }
  }

  var filteredPelanggan = pelanggan.filter(function(item) {
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
      <div className="page-header">
        <div>
          <h1>Data Pelanggan</h1>
          <p>Kelola seluruh data pelanggan ISP ESP Lintas Data.</p>
        </div>
        <button id="btn-tambah-pelanggan" className="btn btn-primary" onClick={openAddModal}>
          ➕ Tambah Pelanggan
        </button>
      </div>

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3>👥 Daftar Pelanggan ({filteredPelanggan.length})</h3>
          <div className="table-header-actions">
            <input
              type="text"
              placeholder="🔍 Cari nama, HP, PPPoE..."
              value={searchQuery}
              onChange={function(e) { setSearchQuery(e.target.value); }}
              style={{ width: '280px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            {[1, 2, 3].map(function(i) {
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
            <div className="table-empty-icon">👥</div>
            <p>{searchQuery ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Belum ada data pelanggan.'}</p>
            {!searchQuery && (
              <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ marginTop: '16px' }}>
                ➕ Tambah Pelanggan Pertama
              </button>
            )}
          </div>
        ) : (
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
              {filteredPelanggan.map(function(item, idx) {
                // MEMANGGIL FUNGSI DINAMIS DI SINI
                var statusTabel = hitungStatusDinamis(item.due_date, item.pppoe_status);

                return (
                  <tr key={item.id_pelanggan}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.nama}</div>
                      {item.alamat && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          📍 {item.alamat.length > 30 ? item.alamat.substring(0, 30) + '...' : item.alamat}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>📱 {item.no_hp}</div>
                      {item.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📧 {item.email}</div>}
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
                            borderRadius: '4px',
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
                          onClick={function() { openEditModal(item); }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={function() { setDeleteConfirm(item.id_pelanggan); }}
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Tambah/Edit Pelanggan */}
      <Modal
        isOpen={showModal}
        onClose={function() { setShowModal(false); }}
        title={editMode ? '✏️ Edit Pelanggan' : '➕ Tambah Pelanggan Baru'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function() { setShowModal(false); }}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editMode ? '💾 Simpan Perubahan' : '➕ Tambah Pelanggan'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="login-error" style={{ marginBottom: '16px' }}>
            ⚠️ {formError}
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
          <div className="form-group">
            <label>Alamat</label>
            <textarea
              name="alamat"
              placeholder="Alamat lengkap pelanggan"
              value={formData.alamat}
              onChange={handleChange}
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Paket Layanan</label>
              <select name="paket" value={formData.paket} onChange={handleChange}>
                <option value="">-- Pilih Paket --</option>
                {paketList.map(function(p) {
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
                {pppoeSecrets.map(function(secret) {
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
        onClose={function() { setDeleteConfirm(null); }}
        title="🗑️ Konfirmasi Hapus"
        footer={
          <>
            <button className="btn btn-secondary" onClick={function() { setDeleteConfirm(null); }}>Batal</button>
            <button className="btn btn-danger" onClick={function() { handleDelete(deleteConfirm); }}>
              🗑️ Ya, Hapus
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
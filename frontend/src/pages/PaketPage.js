import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';

function PaketPage() {
  var [paketList, setPaketList] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [editMode, setEditMode] = useState(false);
  var [editId, setEditId] = useState(null);
  var [deleteConfirm, setDeleteConfirm] = useState(null);
  var [formData, setFormData] = useState({
    nama_paket: '',
    harga: '',
    kecepatan: '',
    deskripsi: ''
  });
  var [formError, setFormError] = useState('');

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function() {
    fetchPaket();
  }, []);

  async function fetchPaket() {
    try {
      var response = await axios.get('http://localhost:3000/api/paket/all', { headers: headers });
      if (response.data.success) {
        setPaketList(response.data.data);
      }
    } catch (err) {
      console.error('Gagal fetch paket:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setFormData({ nama_paket: '', harga: '', kecepatan: '', deskripsi: '' });
    setFormError('');
    setEditMode(false);
    setEditId(null);
    setShowModal(true);
  }

  function openEditModal(item) {
    setFormData({
      nama_paket: item.nama_paket || '',
      harga: item.harga || '',
      kecepatan: item.kecepatan || '',
      deskripsi: item.deskripsi || ''
    });
    setFormError('');
    setEditMode(true);
    setEditId(item.id);
    setShowModal(true);
  }

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setFormError('');

    if (!formData.nama_paket || !formData.harga) {
      setFormError('Nama paket dan harga wajib diisi.');
      return;
    }

    try {
      if (editMode) {
        await axios.put('http://localhost:3000/api/paket/' + editId, formData, { headers: headers });
      } else {
        await axios.post('http://localhost:3000/api/paket', formData, { headers: headers });
      }
      setShowModal(false);
      fetchPaket();
    } catch (err) {
      var message = err.response?.data?.message || 'Terjadi kesalahan.';
      setFormError(message);
    }
  }

  async function handleDelete(id) {
    try {
      await axios.delete('http://localhost:3000/api/paket/' + id, { headers: headers });
      setDeleteConfirm(null);
      fetchPaket();
    } catch (err) {
      console.error('Gagal hapus paket:', err);
    }
  }

  function formatRupiah(num) {
    if (!num) return '-';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Paket Layanan</h1>
          <p>Kelola paket internet yang ditawarkan ke pelanggan.</p>
        </div>
        <button id="btn-tambah-paket" className="btn btn-primary" onClick={openAddModal}>
          <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Paket
        </button>
      </div>

      {/* Card Grid Paket */}
      {loading ? (
        <div className="stats-grid">
          {[1, 2, 3].map(function(i) {
            return (
              <div className="card" key={i}>
                <div className="skeleton skeleton-text lg" style={{ marginBottom: '12px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '60%', marginTop: '12px' }}></div>
              </div>
            );
          })}
        </div>
      ) : paketList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }}><TemplateIcon name="package" size={48} /></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Belum ada paket layanan.</p>
          <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ marginTop: '16px' }}>
            <TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Paket Pertama
          </button>
        </div>
      ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {paketList.map(function(paket, idx) {
            return (
              <div 
                className="card animate-slideUp" 
                key={paket.id} 
                style={{ 
                  animationDelay: (idx * 0.06) + 's',
                  opacity: paket.aktif ? 1 : 0.5,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {!paket.aktif && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '-28px',
                    background: 'var(--status-merah)',
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 32px',
                    transform: 'rotate(45deg)',
                    textTransform: 'uppercase'
                  }}>
                    Nonaktif
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      color: 'var(--primary-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      Paket Internet
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{paket.nama_paket}</h3>
                  </div>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: 'var(--primary-glow)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem'
                  }}>
                    <TemplateIcon name="package" size={20} color="white" />
                  </div>
                </div>

                <div style={{ 
                  fontSize: '1.8rem', 
                  fontWeight: 800, 
                  background: 'linear-gradient(135deg, var(--text-primary), var(--primary-light))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '4px'
                }}>
                  {formatRupiah(paket.harga)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  per bulan
                </div>

                {paket.kecepatan && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '8px',
                    fontSize: '0.85rem'
                  }}>
                    <TemplateIcon name="router" size={15} style={{ marginRight: '6px' }} /> Kecepatan: <strong>{paket.kecepatan}</strong>
                  </div>
                )}

                {paket.deskripsi && (
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                    {paket.deskripsi}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button className="btn btn-secondary btn-sm" onClick={function() { openEditModal(paket); }} style={{ flex: 1 }}>
                    <TemplateIcon name="edit" size={14} style={{ marginRight: '6px' }} /> Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={function() { setDeleteConfirm(paket.id); }}>
                    <TemplateIcon name="trash" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah/Edit Paket */}
      <Modal
        isOpen={showModal}
        onClose={function() { setShowModal(false); }}
        title={editMode ? <><TemplateIcon name="edit" size={16} style={{ marginRight: '8px' }} /> Edit Paket Layanan</> : <><TemplateIcon name="plus" size={16} style={{ marginRight: '8px' }} /> Tambah Paket Baru</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function() { setShowModal(false); }}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editMode ? <><TemplateIcon name="check" size={16} style={{ marginRight: '6px' }} /> Simpan Perubahan</> : <><TemplateIcon name="plus" size={16} style={{ marginRight: '6px' }} /> Tambah Paket</>}
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
            <label>Nama Paket *</label>
            <input
              type="text"
              name="nama_paket"
              placeholder="Contoh: Paket Silver 10 Mbps"
              value={formData.nama_paket}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Harga (Rp) *</label>
              <input
                type="number"
                name="harga"
                placeholder="150000"
                value={formData.harga}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Kecepatan</label>
              <input
                type="text"
                name="kecepatan"
                placeholder="10 Mbps"
                value={formData.kecepatan}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Deskripsi</label>
            <textarea
              name="deskripsi"
              placeholder="Deskripsi paket layanan..."
              value={formData.deskripsi}
              onChange={handleChange}
              rows={3}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={function() { setDeleteConfirm(null); }}
        title={<><TemplateIcon name="trash" size={16} style={{ marginRight: '8px' }} /> Konfirmasi Hapus Paket</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={function() { setDeleteConfirm(null); }}>Batal</button>
            <button className="btn btn-danger" onClick={function() { handleDelete(deleteConfirm); }}>
              <TemplateIcon name="trash" size={14} style={{ marginRight: '6px' }} /> Ya, Hapus
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Paket ini akan dinonaktifkan dan tidak bisa dipilih untuk pelanggan baru. Pelanggan yang sudah menggunakan paket ini tidak terpengaruh.
        </p>
      </Modal>
    </div>
  );
}

export default PaketPage;

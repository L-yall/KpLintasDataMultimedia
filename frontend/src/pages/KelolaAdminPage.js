import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';

function KelolaAdminPage({ admin: currentAdmin }) {
  var { showAlert } = useDialog();
  var [users, setUsers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [errorMsg, setErrorMsg] = useState('');
  var [successMsg, setSuccessMsg] = useState('');

  // Modal Tambah Admin
  var [showAddModal, setShowAddModal] = useState(false);
  var [formNama, setFormNama] = useState('');
  var [formEmail, setFormEmail] = useState('');
  var [formPassword, setFormPassword] = useState('');
  var [showFormPassword, setShowFormPassword] = useState(false);
  var [formRole, setFormRole] = useState('admin');
  var [submitting, setSubmitting] = useState(false);
  var [formError, setFormError] = useState('');

  // Modal Hapus Admin
  var [deleteTarget, setDeleteTarget] = useState(null);
  var [deleteSubmitting, setDeleteSubmitting] = useState(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  var fetchUsers = useCallback(async function () {
    try {
      setLoading(true);
      setErrorMsg('');
      var res = await axios.get(API_BASE_URL + '/api/users', { headers: headers });
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar pengguna:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal mengambil data akun admin.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(function () {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreateUser(e) {
    e.preventDefault();
    setFormError('');

    if (!formNama || !formEmail || !formPassword) {
      setFormError('Nama, email, dan password wajib diisi.');
      return;
    }

    if (formPassword.length < 6) {
      setFormError('Password minimal 6 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      var res = await axios.post(
        API_BASE_URL + '/api/users',
        {
          nama: formNama,
          email: formEmail,
          password: formPassword,
          role: formRole
        },
        { headers: headers }
      );

      if (res.data.success) {
        setShowAddModal(false);
        setFormNama('');
        setFormEmail('');
        setFormPassword('');
        setFormRole('admin');
        setSuccessMsg(res.data.message || 'Akun berhasil dibuat!');
        setTimeout(function () { setSuccessMsg(''); }, 4000);
        fetchUsers();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Gagal membuat akun.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(user) {
    var newStatus = user.status === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      var res = await axios.put(
        API_BASE_URL + '/api/users/' + user.id_admin,
        { status: newStatus },
        { headers: headers }
      );
      if (res.data.success) {
        fetchUsers();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Gagal mengubah status akun.', { tone: 'error' });
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);
    try {
      var res = await axios.delete(
        API_BASE_URL + '/api/users/' + deleteTarget.id_admin,
        { headers: headers }
      );

      if (res.data.success) {
        setDeleteTarget(null);
        setSuccessMsg(res.data.message || 'Akun berhasil dihapus.');
        setTimeout(function () { setSuccessMsg(''); }, 4000);
        fetchUsers();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Gagal menghapus akun admin.', { tone: 'error' });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <style>{`
        .admin-hero {
          background: linear-gradient(135deg, #004e5a 0%, #006877 100%);
          border-radius: var(--radius-xl);
          padding: 28px 32px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          box-shadow: 0 10px 25px -5px rgba(0, 78, 90, 0.25);
        }
        .admin-hero h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 6px;
        }
        .admin-hero p {
          color: rgba(255, 255, 255, 0.85);
          max-width: 600px;
          line-height: 1.5;
          font-size: 0.95rem;
          margin: 0;
        }
        .badge-role {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .badge-role.superadmin {
          background: rgba(0, 78, 90, 0.12);
          color: #004e5a;
          border: 1px solid rgba(0, 78, 90, 0.3);
        }
        .badge-role.admin {
          background: rgba(2, 136, 209, 0.12);
          color: #0288d1;
          border: 1px solid rgba(2, 136, 209, 0.3);
        }
        .badge-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .badge-status.aktif {
          background: rgba(15, 157, 91, 0.12);
          color: #0f9d58;
        }
        .badge-status.nonaktif {
          background: rgba(239, 68, 68, 0.12);
          color: #dc2626;
        }
        .action-btn-pill {
          padding: 5px 10px;
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          font-weight: 700;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .action-btn-pill:hover {
          background: var(--bg-hover);
          color: var(--primary);
        }
      `}</style>

      {/* Hero Banner */}
      <section className="admin-hero animate-fadeIn">
        <div>
          <h1>Manajemen Akses & Akun Admin</h1>
          <p>Kelola seluruh akun administrator sistem, kontrol izin peran (Super Admin vs Admin Operasional), serta atur status keaktifan akun secara aman.</p>
        </div>
        <div>
          <button
            className="btn btn-primary"
            onClick={function () { setShowAddModal(true); setFormError(''); }}
            style={{
              background: '#ffffff',
              color: '#004e5a',
              fontWeight: '800',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
            Tambah Admin Baru
          </button>
        </div>
      </section>

      {/* Feedback Alerts */}
      {successMsg && (
        <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', background: 'rgba(15, 157, 91, 0.12)', color: '#0f9d58', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
          {errorMsg}
        </div>
      )}

      {/* Table Card */}
      <div className="card animate-fadeIn" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary)' }}>manage_accounts</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>Daftar Administrator ({users.length})</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px' }}>
            {[1, 2, 3].map(function (i) {
              return (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="skeleton" style={{ width: '25%', height: '20px' }}></div>
                  <div className="skeleton" style={{ width: '20%', height: '20px' }}></div>
                  <div className="skeleton" style={{ width: '20%', height: '20px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '20px' }}></div>
                  <div className="skeleton" style={{ width: '20%', height: '20px' }}></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Lengkap</th>
                  <th>Email</th>
                  <th>Peran (Role)</th>
                  <th>Status Akun</th>
                  <th>Terdaftar Sejak</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map(function (u, idx) {
                  var isSelf = currentAdmin && (currentAdmin.id === u.id_admin || currentAdmin.email === u.email);
                  return (
                    <tr key={u.id_admin}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {u.nama} {isSelf && <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 800 }}>(Anda)</span>}
                        </div>
                      </td>
                      <td>
                        <code style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.82rem' }}>
                          {u.email}
                        </code>
                      </td>
                      <td>
                        <span className={'badge-role ' + u.role}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                            {u.role === 'superadmin' ? 'verified_user' : 'badge'}
                          </span>
                          {u.role === 'superadmin' ? 'Super Admin' : 'Admin Biasa'}
                        </span>
                      </td>
                      <td>
                        <span className={'badge-status ' + u.status}>
                          {u.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>{formatTanggal(u.created_at)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          {/* Toggle Status button */}
                          {!isSelf && (
                            <button
                              type="button"
                              className="action-btn-pill"
                              title={u.status === 'aktif' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                              onClick={function () { handleToggleStatus(u); }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14, color: u.status === 'aktif' ? '#dc2626' : '#0f9d58' }}>
                                {u.status === 'aktif' ? 'block' : 'check_circle'}
                              </span>
                              {u.status === 'aktif' ? 'Bekukan' : 'Aktifkan'}
                            </button>
                          )}

                          {/* Delete button (only if not self) */}
                          {!isSelf && (
                            <button
                              type="button"
                              className="action-btn-pill"
                              style={{ color: '#dc2626' }}
                              title="Hapus Akun"
                              onClick={function () { setDeleteTarget(u); }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Admin Baru */}
      <Modal
        isOpen={showAddModal}
        onClose={function () { setShowAddModal(false); }}
        title="Tambah Akun Administrator Baru"
      >
        <form onSubmit={handleCreateUser}>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Nama Lengkap *</label>
            <input
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={formNama}
              onChange={function (e) { setFormNama(e.target.value); }}
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Email Login *</label>
            <input
              type="email"
              placeholder="Contoh: budi@lintasdata.net"
              value={formEmail}
              onChange={function (e) { setFormEmail(e.target.value); }}
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Password * (Min. 6 Karakter)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showFormPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formPassword}
                onChange={function (e) { setFormPassword(e.target.value); }}
                required
                minLength={6}
                style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
              />
              <button
                type="button"
                onClick={function () { setShowFormPassword(!showFormPassword); }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showFormPassword ? 'var(--primary, #006876)' : 'var(--text-muted, #888)'
                }}
                title={showFormPassword ? "Sembunyikan password" : "Lihat password"}
                aria-label={showFormPassword ? "Sembunyikan password" : "Lihat password"}
              >
                <TemplateIcon name={showFormPassword ? "eye-off" : "eye"} size={18} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Peran (Tingkat Akses) *</label>
            <select
              value={formRole}
              onChange={function (e) { setFormRole(e.target.value); }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600 }}
            >
              <option value="admin">Admin Biasa (Hanya Pelanggan & Monitoring)</option>
              <option value="superadmin">Super Admin (Akses Penuh Finansial, Billing & Pengaturan)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={function () { setShowAddModal(false); }} disabled={submitting}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Admin */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={function () { setDeleteTarget(null); }}
        title="Konfirmasi Hapus Akun Admin"
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Apakah Anda yakin ingin menghapus akun admin <strong>{deleteTarget?.nama}</strong> (<code>{deleteTarget?.email}</code>)? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={function () { setDeleteTarget(null); }} disabled={deleteSubmitting}>
              Batal
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDeleteUser} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Menghapus...' : 'Ya, Hapus Akun'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default KelolaAdminPage;

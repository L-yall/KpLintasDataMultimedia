import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';

function RegistrasiPelangganPage({ socket }) {
  var [registrations, setRegistrations] = useState([]);
  var [loading, setLoading] = useState(true);
  var [reviewing, setReviewing] = useState(null);
  var [pppoeUsername, setPppoeUsername] = useState('');
  var [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  var [actionLoading, setActionLoading] = useState(false);
  var [error, setError] = useState('');

  var headers = { Authorization: 'Bearer ' + localStorage.getItem('token') };

  var fetchRegistrations = useCallback(async function () {
    try {
      var response = await axios.get(API_BASE_URL + '/api/pelanggan/registrasi/pending', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      });
      if (response.data.success) setRegistrations(response.data.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Gagal mengambil pendaftaran pelanggan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function () {
    fetchRegistrations();
    if (!socket) return undefined;
    socket.on('registrasi_masuk', fetchRegistrations);
    socket.on('registrasi_updated', fetchRegistrations);
    return function () {
      socket.off('registrasi_masuk', fetchRegistrations);
      socket.off('registrasi_updated', fetchRegistrations);
    };
  }, [socket, fetchRegistrations]);

  function openReview(registration) {
    setReviewing(registration);
    setPppoeUsername('');
    setDueDate(new Date().toISOString().slice(0, 10));
    setError('');
  }

  async function handleApprove(event) {
    event.preventDefault();
    if (!reviewing) return;
    setActionLoading(true);
    setError('');
    try {
      var response = await axios.post(
        API_BASE_URL + '/api/pelanggan/registrasi/' + reviewing.id_pelanggan + '/approve',
        { pppoe_username: pppoeUsername, due_date: dueDate },
        { headers: headers }
      );
      setReviewing(null);
      await fetchRegistrations();
      window.alert(response.data.message || 'Registrasi disetujui.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Gagal menyetujui registrasi.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(registration) {
    if (!window.confirm('Tolak pendaftaran ' + registration.nama + '? Data dan foto pendaftar akan dihapus.')) return;
    setActionLoading(true);
    setError('');
    try {
      var response = await axios.post(
        API_BASE_URL + '/api/pelanggan/registrasi/' + registration.id_pelanggan + '/reject',
        {},
        { headers: headers }
      );
      await fetchRegistrations();
      window.alert(response.data.message || 'Registrasi ditolak.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Gagal menolak registrasi.');
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getWhatsAppUrl(phone) {
    var number = String(phone || '').replace(/\D/g, '');
    if (number.startsWith('0')) number = '62' + number.slice(1);
    else if (number && !number.startsWith('62')) number = '62' + number;
    return number ? 'https://wa.me/' + number : '';
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pendaftaran Pelanggan</h1>
          <p>Tinjau permintaan pemasangan baru sebelum pelanggan diaktifkan.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchRegistrations} disabled={loading}>
          <TemplateIcon name="refresh" size={16} style={{ marginRight: '6px' }} /> Muat Ulang
        </button>
      </div>

      {error && !reviewing && <div className="login-error" style={{ marginBottom: '16px' }} role="alert">{error}</div>}

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3><TemplateIcon name="person_add" size={18} style={{ marginRight: '8px' }} /> Menunggu Tinjauan ({registrations.length})</h3>
        </div>
        {loading ? (
          <div style={{ padding: '32px', color: 'var(--text-muted)' }}>Memuat pendaftaran...</div>
        ) : registrations.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><TemplateIcon name="check" size={28} /></div>
            <p>Tidak ada pendaftaran yang menunggu tinjauan.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Kontak</th>
                  <th>Paket</th>
                  <th>Masuk</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(function (registration) {
                  return (
                    <tr key={registration.id_pelanggan}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{registration.nama}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>NIK {registration.nik}</div>
                      </td>
                      <td>
                        <div>{registration.no_hp}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{registration.email}</div>
                      </td>
                      <td>
                        <div>{registration.paket}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Rp {Number(registration.harga || 0).toLocaleString('id-ID')} / bulan
                        </div>
                      </td>
                      <td>{formatDate(registration.created_at)}</td>
                      <td><span className="status-badge kuning">Menunggu</span></td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={function () { openReview(registration); }}>
                            Tinjau
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={function () { handleReject(registration); }} disabled={actionLoading}>
                            Tolak
                          </button>
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

      <Modal
        isOpen={reviewing !== null}
        onClose={function () { if (!actionLoading) setReviewing(null); }}
        title={reviewing ? 'Tinjau Pendaftaran: ' + reviewing.nama : 'Tinjau Pendaftaran'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={function () { setReviewing(null); }} disabled={actionLoading}>Batal</button>
            <button className="btn btn-primary" onClick={handleApprove} disabled={actionLoading || !pppoeUsername || !dueDate}>
              {actionLoading ? 'Memproses...' : 'Setujui dan Buat Tagihan'}
            </button>
          </>
        )}
      >
        {reviewing && (
          <form onSubmit={handleApprove}>
            {error && <div className="login-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
              <div className="form-group"><label>Nomor HP</label><div>{reviewing.no_hp}</div></div>
              <div className="form-group"><label>Email</label><div>{reviewing.email}</div></div>
              <div className="form-group"><label>NIK</label><div>{reviewing.nik}</div></div>
              <div className="form-group"><label>Paket layanan</label><div>{reviewing.paket} - Rp {Number(reviewing.harga || 0).toLocaleString('id-ID')}/bulan</div></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Alamat pemasangan</label><div>{reviewing.alamat}</div></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Foto KTP</label>
                {reviewing.foto && <a href={API_BASE_URL + reviewing.foto} target="_blank" rel="noreferrer">Lihat foto KTP</a>}
              </div>
              <div className="form-group">
                <label htmlFor="registration-pppoe">PPPoE username *</label>
                <input id="registration-pppoe" value={pppoeUsername} onChange={function (event) { setPppoeUsername(event.target.value); }} required maxLength="100" />
              </div>
              <div className="form-group">
                <label htmlFor="registration-due-date">Jatuh tempo awal *</label>
                <input id="registration-due-date" type="date" value={dueDate} onChange={function (event) { setDueDate(event.target.value); }} required />
              </div>
              <div style={{ gridColumn: '2 / 3', display: 'flex', justifyContent: 'flex-start', marginTop: '-8px' }}>
                {getWhatsAppUrl(reviewing.no_hp) && (
                  <a
                    href={getWhatsAppUrl(reviewing.no_hp)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 0',
                      border: 'none',
                      background: 'transparent',
                      color: '#128C7E',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat</span>
                    Hubungi Pelanggan
                  </a>
                )}
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default RegistrasiPelangganPage;
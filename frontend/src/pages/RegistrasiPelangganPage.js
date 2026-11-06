import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';

function RegistrasiPelangganPage({ socket }) {
  var { showAlert } = useDialog();
  var [registrations, setRegistrations] = useState([]);
  var [loading, setLoading] = useState(true);
  var [reviewing, setReviewing] = useState(null);
  var [rejectTarget, setRejectTarget] = useState(null);
  var [alasanTolak, setAlasanTolak] = useState('');
  var [pppoeSecrets, setPppoeSecrets] = useState([]);
  var [pppoeUsername, setPppoeUsername] = useState('');
  var [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  var [actionLoading, setActionLoading] = useState(false);
  var [error, setError] = useState('');
  var [page, setPage] = useState(1);

  var headers = { Authorization: 'Bearer ' + localStorage.getItem('token') };
  var registrationsPerPage = 10;
  var totalPages = Math.max(1, Math.ceil(registrations.length / registrationsPerPage));
  var paginatedRegistrations = registrations.slice((page - 1) * registrationsPerPage, page * registrationsPerPage);

  useEffect(function () {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

  async function openReview(registration) {
    setReviewing(registration);
    setPppoeUsername('');
    setDueDate(new Date().toISOString().slice(0, 10));
    setError('');
    try {
      var response = await axios.get(API_BASE_URL + '/api/mikrotik/secrets', { headers: headers });
      if (response.data.success) setPppoeSecrets(response.data.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Gagal mengambil PPPoE secrets dari Mikrotik.');
    }
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
      showAlert(response.data.message || 'Registrasi disetujui.', { tone: 'success' });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Gagal menyetujui registrasi.');
    } finally {
      setActionLoading(false);
    }
  }

  function openReject(registration) {
    setRejectTarget(registration);
    setAlasanTolak('');
    setError('');
  }

  async function handleReject(event) {
    event.preventDefault();
    if (!rejectTarget || !alasanTolak.trim()) {
      setError('Silakan isi alasan penolakan terlebih dahulu.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      var response = await axios.post(
        API_BASE_URL + '/api/pelanggan/registrasi/' + rejectTarget.id_pelanggan + '/reject',
        { alasan_tolak: alasanTolak },
        { headers: headers }
      );
      setRejectTarget(null);
      setAlasanTolak('');
      await fetchRegistrations();
      showAlert(response.data.message || 'Registrasi ditolak.', { tone: 'success' });
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

  function renderPagination() {
    if (totalPages <= 1) return null;

    var pages = [];
    for (var p = 1; p <= totalPages; p++) pages.push(p);

    return (
      <nav aria-label="Page navigation" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (page === 1 ? ' disabled' : '')}>
            <a href="#" className="registrasi-page-button page-link" onClick={function (e) { e.preventDefault(); if (page !== 1) setPage(Math.max(1, page - 1)); }} aria-label="Previous" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}>«</a>
          </li>
          {pages.map(function (pageNumber) {
            return (
              <li key={pageNumber}>
                <a href="#" className={'registrasi-page-button page-link' + (page === pageNumber ? ' active' : '')} onClick={function (e) { e.preventDefault(); setPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={page === pageNumber ? 'page' : undefined}>{pageNumber}</a>
              </li>
            );
          })}
          <li className={'page-item' + (page === totalPages ? ' disabled' : '')}>
            <a href="#" className="registrasi-page-button page-link" onClick={function (e) { e.preventDefault(); if (page !== totalPages) setPage(Math.min(totalPages, page + 1)); }} aria-label="Next" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}>»</a>
          </li>
        </ul>
      </nav>
    );
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
        .registrasi-page-button {
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
        .page-item:first-child .registrasi-page-button {
          border-left: 1px solid var(--border-color);
          border-radius: 6px 0 0 6px;
        }
        .page-item:last-child .registrasi-page-button {
          border-radius: 0 6px 6px 0;
        }
        .registrasi-page-button:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .registrasi-page-button.active {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .registrasi-page-button.active:hover {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .page-item.disabled .registrasi-page-button {
          color: #006876;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>
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
                  <th>No</th>
                  <th>Nama</th>
                  <th>Kontak</th>
                  <th>Paket</th>
                  <th>Masuk</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRegistrations.map(function (registration, idx) {
                  return (
                    <tr key={registration.id_pelanggan}>
                      <td style={{ color: 'var(--text-muted)' }}>{(page - 1) * registrationsPerPage + idx + 1}</td>
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
                          <button className="btn btn-danger btn-sm" onClick={function () { openReject(registration); }} disabled={actionLoading}>
                            Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>

      {rejectTarget && (
        <Modal
          isOpen={rejectTarget !== null}
          onClose={function () { if (!actionLoading) { setRejectTarget(null); setAlasanTolak(''); } }}
          title={<><TemplateIcon name="close" size={16} style={{ marginRight: '8px' }} /> Tolak Pendaftaran - {rejectTarget.nama}</>}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={function () { setRejectTarget(null); setAlasanTolak(''); }} disabled={actionLoading}>Batal</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading || !alasanTolak.trim()}>
                {actionLoading ? 'Mengirim...' : 'Tolak Pendaftaran'}
              </button>
            </>
          )}
        >
          <form onSubmit={handleReject} style={{ padding: '10px 0' }}>
            {error && <div className="login-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
              Berikan alasan penolakan. Alasan ini akan dikirimkan melalui email kepada pelanggan.
            </p>
            <div className="form-group">
              <label>Alasan Penolakan *</label>
              <textarea
                rows="4"
                maxLength="2000"
                placeholder="Tuliskan alasan pendaftaran belum dapat disetujui."
                value={alasanTolak}
                onChange={function (event) { setAlasanTolak(event.target.value); }}
                required
                autoFocus
              />
            </div>
          </form>
        </Modal>
      )}

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
                <select id="registration-pppoe" value={pppoeUsername} onChange={function (event) { setPppoeUsername(event.target.value); }} required>
                  <option value="">-- Pilih PPPoE Secret --</option>
                  {pppoeSecrets.map(function (secret) {
                    return (
                      <option key={secret.name} value={secret.name} disabled={secret.is_registered}>
                        {secret.name} ({secret.profile || 'default'}){secret.is_registered ? ' - sudah terdaftar' : ''}
                      </option>
                    );
                  })}
                </select>
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
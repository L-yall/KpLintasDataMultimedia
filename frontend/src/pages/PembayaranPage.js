import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';

function PembayaranPage({ socket }) {
  var [pendingPayments, setPendingPayments] = useState([]);
  var [loading, setLoading] = useState(true);
  
  // Modals state
  var [viewBukti, setViewBukti] = useState(null); // holds payment object
  var [rejectTarget, setRejectTarget] = useState(null); // holds payment object
  var [alasanTolak, setAlasanTolak] = useState('');
  var [actionLoading, setActionLoading] = useState(false);
  var [successMsg, setSuccessMsg] = useState('');

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function() {
    fetchPending();

    // Listen for new payments uploaded in real-time
    if (socket) {
      socket.on('pembayaran_masuk', function(newPayment) {
        console.log('Ada pembayaran masuk baru:', newPayment);
        setSuccessMsg(`Notifikasi: Pembayaran baru masuk dari ${newPayment.nama_pelanggan}!`);
        fetchPending();
        
        // Clear toast after 5s
        setTimeout(function() {
          setSuccessMsg('');
        }, 5000);
      });
    }

    return function() {
      if (socket) {
        socket.off('pembayaran_masuk');
      }
    };
  }, [socket]);

  async function fetchPending() {
    try {
      var response = await axios.get('http://localhost:3000/api/pembayaran/pending', { headers: headers });
      if (response.data.success) {
        setPendingPayments(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil pengajuan pembayaran:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id_pembayaran) {
    if (!window.confirm('Apakah Anda yakin ingin MENYETUJUI pembayaran ini? Akun internet pelanggan akan otomatis diaktifkan di Mikrotik.')) {
      return;
    }

    setActionLoading(true);
    try {
      var response = await axios.post(`http://localhost:3000/api/pembayaran/${id_pembayaran}/approve`, {}, { headers: headers });
      alert(response.data.message);
      setViewBukti(null);
      fetchPending();
    } catch (err) {
      alert('Gagal menyetujui pembayaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(e) {
    e.preventDefault();
    if (!alasanTolak) {
      alert('Silakan isi alasan penolakan terlebih dahulu.');
      return;
    }

    setActionLoading(true);
    try {
      var response = await axios.post(`http://localhost:3000/api/pembayaran/${rejectTarget.id_pembayaran}/reject`, {
        alasan_tolak: alasanTolak
      }, { headers: headers });

      alert(response.data.message);
      setRejectTarget(null);
      setAlasanTolak('');
      setViewBukti(null);
      fetchPending();
    } catch (err) {
      alert('Gagal menolak pembayaran: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Persetujuan Pembayaran</h1>
          <p>Verifikasi bukti transfer dari pelanggan dan aktifkan kembali layanan internet mereka.</p>
        </div>
      </div>

      {successMsg && (
        <div className="status-badge hijau animate-fadeIn" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          🔔 {successMsg}
        </div>
      )}

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3>📥 Antrean Verifikasi ({pendingPayments.length})</h3>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            <div className="skeleton skeleton-text lg" style={{ width: '30%' }} />
            <div className="skeleton skeleton-text" style={{ width: '80%', marginTop: '16px' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%', marginTop: '12px' }} />
          </div>
        ) : pendingPayments.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon">✅</div>
            <p>Tidak ada pengajuan pembayaran pending saat ini. Semua bersih!</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Pelanggan</th>
                <th>No HP</th>
                <th>Periode Tagihan</th>
                <th>Nominal</th>
                <th>Waktu Upload</th>
                <th>Bukti Transfer</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map(function(item, idx) {
                return (
                  <tr key={item.id_pembayaran}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.nama}</td>
                    <td>{item.no_hp}</td>
                    <td><code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{item.periode}</code></td>
                    <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>
                      Rp {Number(item.nominal).toLocaleString('id-ID')}
                    </td>
                    <td>{formatTanggal(item.tanggal_upload)}</td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={function() { setViewBukti(item); }}
                      >
                        🖼️ Lihat Bukti
                      </button>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={function() { handleApprove(item.id_pembayaran); }}
                          disabled={actionLoading}
                        >
                          ✓ Terima
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={function() { setRejectTarget(item); }}
                          disabled={actionLoading}
                        >
                          ✕ Tolak
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

      {/* Modal View Bukti Transfer */}
      {viewBukti && (
        <Modal
          isOpen={viewBukti !== null}
          onClose={function() { setViewBukti(null); }}
          title={`🖼️ Bukti Transfer - ${viewBukti.nama}`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={function() { setViewBukti(null); }}>Batal</button>
              <button 
                className="btn btn-danger" 
                onClick={function() { setRejectTarget(viewBukti); }}
                disabled={actionLoading}
              >
                ✕ Tolak
              </button>
              <button 
                className="btn btn-primary" 
                onClick={function() { handleApprove(viewBukti.id_pembayaran); }}
                disabled={actionLoading}
              >
                ✓ Terima Pembayaran
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
              Tagihan: <strong>Rp {Number(viewBukti.nominal).toLocaleString('id-ID')}</strong> | Periode: <strong>{viewBukti.periode}</strong>
            </p>
            <div style={{ background: '#000', borderRadius: '8px', padding: '8px', display: 'inline-block', border: '1px solid var(--border-color)', maxWidth: '100%' }}>
              <img 
                src={`http://localhost:3000${viewBukti.bukti_file}`} 
                alt="Bukti Transfer Pelanggan"
                style={{ maxWidth: '100%', maxHeight: '420px', display: 'block', objectFit: 'contain', margin: '0 auto' }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tolak Pembayaran */}
      {rejectTarget && (
        <Modal
          isOpen={rejectTarget !== null}
          onClose={function() { setRejectTarget(null); setAlasanTolak(''); }}
          title={`✕ Tolak Pembayaran - ${rejectTarget.nama}`}
          footer={
            <>
              <button 
                className="btn btn-secondary" 
                onClick={function() { setRejectTarget(null); setAlasanTolak(''); }}
              >
                Batal
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleReject}
                disabled={actionLoading || !alasanTolak}
              >
                {actionLoading ? '⏳ Mengirim...' : '✕ Tolak Bukti Transfer'}
              </button>
            </>
          }
        >
          <form onSubmit={handleReject} style={{ padding: '10px 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
              Berikan alasan penolakan. Alasan ini akan otomatis dikirimkan ke Email pelanggan agar mereka bisa mengunggah bukti yang valid.
            </p>
            <div className="form-group">
              <label>Alasan Penolakan Bukti *</label>
              <textarea
                rows="4"
                placeholder="Contoh: Nominal transfer kurang, gambar bukti transfer buram/terpotong, atau bukti transfer bukan untuk transaksi ini."
                value={alasanTolak}
                onChange={function(e) { setAlasanTolak(e.target.value); }}
                required
                autoFocus
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default PembayaranPage;

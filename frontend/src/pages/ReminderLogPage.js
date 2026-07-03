import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ReminderLogPage() {
  var [logs, setLogs] = useState([]);
  var [loading, setLoading] = useState(true);
  var [triggering, setTriggering] = useState(false);
  var [searchQuery, setSearchQuery] = useState('');
  var [messageModal, setMessageModal] = useState(null);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function() {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      var response = await axios.get('http://localhost:3000/api/reminder/logs', { headers: headers });
      if (response.data.success) {
        setLogs(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil log reminder:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerCron() {
    setTriggering(true);
    try {
      var response = await axios.post('http://localhost:3000/api/reminder/trigger-cron', {}, { headers: headers });
      alert(response.data.message);
      fetchLogs();
    } catch (err) {
      alert('Gagal memicu pengiriman reminder: ' + (err.response?.data?.message || err.message));
    } finally {
      setTriggering(false);
    }
  }

  // Filter logs by search query
  var filteredLogs = logs.filter(function(log) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    return (
      (log.nama && log.nama.toLowerCase().includes(q)) ||
      (log.no_hp && log.no_hp.includes(q)) ||
      (log.status_kirim && log.status_kirim.toLowerCase().includes(q))
    );
  });

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
          <h1>Log Reminder Email</h1>
          <p>Riwayat pengiriman notifikasi reminder jatuh tempo via Email ke pelanggan.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleTriggerCron} 
          disabled={triggering}
        >
          🚀 {triggering ? 'Memproses...' : 'Kirim Reminder Sekarang'}
        </button>
      </div>

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3>💬 Riwayat Pengiriman ({filteredLogs.length})</h3>
          <div className="table-header-actions">
            <input
              type="text"
              placeholder="🔍 Cari nama, HP..."
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
                  <div className="skeleton" style={{ width: '35%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '16px' }}></div>
                </div>
              );
            })}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon">✉️</div>
            <p>Belum ada riwayat pengiriman reminder Email.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Pelanggan</th>
                <th>Email</th>
                <th>Waktu Kirim</th>
                <th>Status</th>
                <th>Pesan</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(function(log, idx) {
                var isSuccess = log.status_kirim === 'terkirim';
                return (
                  <tr key={log.id_reminder}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{log.nama || 'Pelanggan Dihapus'}</td>
                    <td>{log.no_hp}</td>
                    <td>{formatTanggal(log.tanggal_kirim)}</td>
                    <td>
                      <span className={'status-badge ' + (isSuccess ? 'hijau' : 'merah')}>
                        {isSuccess ? 'Terkirim' : 'Gagal'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={function() { setMessageModal(log.pesan); }}
                      >
                        👁️ Lihat Isi Pesan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for viewing Email Message Body */}
      {messageModal && (
        <div className="modal-overlay" onClick={function() { setMessageModal(null); }}>
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2>Isi Pesan Email</h2>
              <button className="modal-close" onClick={function() { setMessageModal(null); }}>✕</button>
            </div>
            <div className="modal-body" style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', margin: '20px', border: '1px solid var(--border-color)' }}>
              {messageModal}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-sm" onClick={function() { setMessageModal(null); }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReminderLogPage;

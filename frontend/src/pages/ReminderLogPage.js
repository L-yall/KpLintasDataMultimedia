import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';

function ReminderLogPage() {
  var { showAlert, confirmDialog } = useDialog();
  var [logs, setLogs] = useState([]);
  var [loading, setLoading] = useState(true);
  var [triggering, setTriggering] = useState(false);
  var [searchQuery, setSearchQuery] = useState('');
  var [messageModal, setMessageModal] = useState(null);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/reminder/logs`, { headers: headers });
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
      var response = await axios.post(`${API_BASE_URL}/api/reminder/trigger-cron`, {}, { headers: headers });
      await showAlert(response.data.message, { tone: 'success' });
      fetchLogs();
    } catch (err) {
      await showAlert('Gagal memicu pengiriman reminder: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    } finally {
      setTriggering(false);
    }
  }

  async function handleDeleteLog(id) {
    if (!await confirmDialog('Apakah Anda yakin ingin menghapus log reminder ini?', { tone: 'danger', confirmLabel: 'Ya, hapus', cancelLabel: 'Batal' })) return;
    try {
      var response = await axios.delete(`${API_BASE_URL}/api/reminder/logs/` + id, { headers: headers });
      await showAlert(response.data.message, { tone: 'success' });
      fetchLogs();
    } catch (err) {
      await showAlert('Gagal menghapus log: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    }
  }

  async function handleClearAllLogs() {
    if (!await confirmDialog('Apakah Anda yakin ingin menghapus SEMUA log reminder?', { tone: 'danger', confirmLabel: 'Hapus semua log', cancelLabel: 'Batal' })) return;
    try {
      var response = await axios.delete(`${API_BASE_URL}/api/reminder/logs`, { headers: headers });
      await showAlert(response.data.message, { tone: 'success' });
      fetchLogs();
    } catch (err) {
      await showAlert('Gagal membersihkan log: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    }
  }

  // Filter logs by search query
  var filteredLogs = logs.filter(function (log) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    return (
      (log.nama && log.nama.toLowerCase().includes(q)) ||
      (log.email && log.email.toLowerCase().includes(q)) ||
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-danger"
            onClick={handleClearAllLogs}
          >
            <TemplateIcon name="trash" size={16} style={{ marginRight: '6px' }} /> Bersihkan Semua Log
          </button>
          <button
            className="btn btn-primary"
            onClick={handleTriggerCron}
            disabled={triggering}
            style={{
              background: 'var(--md-primary-fixed)',
              color: 'var(--md-on-primary-fixed-variant)',
              fontWeight: '700'
            }}
          >
            <TemplateIcon name="refresh" size={16} style={{ marginRight: '6px' }} /> {triggering ? 'Memproses...' : 'Kirim Reminder Sekarang'}
          </button>
        </div>
      </div>

      <div className="table-container animate-fadeIn">
        <div className="table-header">
          <h3><TemplateIcon name="mail" size={18} style={{ marginRight: '8px' }} /> Riwayat Pengiriman ({filteredLogs.length})</h3>
          <div className="table-header-actions">
            <input
              type="text"
              placeholder="Cari nama,email..."
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
                  <div className="skeleton" style={{ width: '35%', height: '16px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '16px' }}></div>
                </div>
              );
            })}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><TemplateIcon name="mail" size={28} /></div>
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
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(function (log, idx) {
                var isSuccess = log.status_kirim === 'terkirim';
                return (
                  <tr key={log.id_reminder}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{log.nama || 'Pelanggan Dihapus'}</td>
                    <td>{log.email}</td>
                    <td>{formatTanggal(log.tanggal_kirim)}</td>
                    <td>
                      <span className={'status-badge ' + (isSuccess ? 'hijau' : 'merah')}>
                        {isSuccess ? 'Terkirim' : 'Gagal'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={function () { setMessageModal(log.pesan); }}
                      >
                        <TemplateIcon name="document" size={14} style={{ marginRight: '6px' }} /> Lihat Isi Pesan
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={function () { handleDeleteLog(log.id_reminder); }}
                        title="Hapus Log"
                      >
                        <TemplateIcon name="trash" size={14} />
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
        <div className="modal-overlay" onClick={function () { setMessageModal(null); }}>
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2>Isi Pesan Email</h2>
              <button className="modal-close" onClick={function () { setMessageModal(null); }}><TemplateIcon name="close" size={16} /></button>
            </div>
            <div className="modal-body" style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '5px', margin: '20px', border: '1px solid var(--border-color)' }}>
              {messageModal}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-sm" onClick={function () { setMessageModal(null); }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReminderLogPage;

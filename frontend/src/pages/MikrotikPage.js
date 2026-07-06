import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MikrotikStatus from '../components/MikrotikStatus';
import TemplateIcon from '../components/TemplateIcon';

function MikrotikPage({ socket }) {
  var [status, setStatus] = useState({ online: false, error: 'Memuat...' });
  var [activeConns, setActiveConns] = useState([]);
  var [unregistered, setUnregistered] = useState([]);
  var [loading, setLoading] = useState(true);
  var [activeTab, setActiveTab] = useState('unregistered'); // 'unregistered' or 'active'

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function() {
    fetchData();

    // Listen to real-time events from websocket
    if (socket) {
      socket.on('mikrotik_ping', function(pingData) {
        setStatus(pingData);
      });

      socket.on('pppoe_summary', function(summary) {
        setUnregistered(summary.unregistered_list || []);
      });
    }

    return function() {
      if (socket) {
        socket.off('mikrotik_ping');
        socket.off('pppoe_summary');
      }
    };
  }, [socket]);

  async function fetchData() {
    try {
      var statusRes = await axios.get('http://localhost:3000/api/mikrotik/status', { headers: headers });
      setStatus(statusRes.data.data);

      var activeRes = await axios.get('http://localhost:3000/api/mikrotik/active', { headers: headers });
      setActiveConns(activeRes.data.data);

      var unregRes = await axios.get('http://localhost:3000/api/mikrotik/unregistered', { headers: headers });
      setUnregistered(unregRes.data.data);
    } catch (err) {
      console.error('Gagal mengambil data Mikrotik:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshActive() {
    setLoading(true);
    try {
      var activeRes = await axios.get('http://localhost:3000/api/mikrotik/active', { headers: headers });
      setActiveConns(activeRes.data.data);
      var unregRes = await axios.get('http://localhost:3000/api/mikrotik/unregistered', { headers: headers });
      setUnregistered(unregRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Integrasi Mikrotik</h1>
          <p>Pantau status koneksi router dan active sessions PPPoE secara real-time.</p>
        </div>
        <button className="btn btn-secondary" onClick={refreshActive} disabled={loading}>
          <TemplateIcon name="refresh" size={16} style={{ marginRight: '6px' }} /> Refresh Data
        </button>
      </div>

      <div style={{ marginBottom: '24px', maxWidth: '380px' }}>
        <MikrotikStatus status={status} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button 
          className={'btn btn-sm ' + (activeTab === 'unregistered' ? 'btn-primary' : 'btn-secondary')}
          onClick={function() { setActiveTab('unregistered'); }}
        >
          <TemplateIcon name="alert" size={16} style={{ marginRight: '6px' }} /> Belum Terdaftar ({unregistered.length})
        </button>
        <button 
          className={'btn btn-sm ' + (activeTab === 'active' ? 'btn-primary' : 'btn-secondary')}
          onClick={function() { setActiveTab('active'); }}
        >
          <TemplateIcon name="router" size={16} style={{ marginRight: '6px' }} /> Active Connections ({activeConns.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="table-container animate-fadeIn">
        {loading ? (
          <div style={{ padding: '40px' }}>
            <div className="skeleton skeleton-text lg" style={{ width: '40%' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '80%', marginTop: '16px' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '60%', marginTop: '12px' }}></div>
          </div>
        ) : activeTab === 'unregistered' ? (
          // Unregistered PPPoE Connections
          <div>
            <div className="table-header" style={{ borderBottom: 'none' }}>
              <div>
                <h3>PPPoE Aktif tapi Belum Terdaftar di Sistem</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Admin harus mendaftarkan akun-akun ini agar pembayaran dan monitoring tagihan dapat diproses.
                </p>
              </div>
            </div>

            {unregistered.length === 0 ? (
              <div className="table-empty">
                <div className="table-empty-icon"><TemplateIcon name="check" size={28} /></div>
                <p>Semua PPPoE yang aktif di router sudah terdaftar di database pelanggan.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>PPPoE Username</th>
                    <th>IP Address</th>
                    <th>Uptime</th>
                    <th>Service</th>
                    <th>Caller ID (MAC)</th>
                  </tr>
                </thead>
                <tbody>
                  {unregistered.map(function(item, idx) {
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td>
                          <code style={{ 
                            background: 'var(--status-merah-bg)', 
                            color: 'var(--status-merah)',
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.85rem' 
                          }}>
                            {item.name}
                          </code>
                        </td>
                        <td>{item.address}</td>
                        <td>{item.uptime}</td>
                        <td>{item.service}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item['caller-id'] || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          // All Active PPPoE Connections
          <div>
            <div className="table-header" style={{ borderBottom: 'none' }}>
              <h3>Semua Sesi PPPoE yang Sedang Aktif</h3>
            </div>

            {activeConns.length === 0 ? (
              <div className="table-empty">
                <div className="table-empty-icon"><TemplateIcon name="router" size={28} /></div>
                <p>Tidak ada sesi PPPoE yang aktif saat ini.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Username</th>
                    <th>IP Address</th>
                    <th>Uptime</th>
                    <th>Caller ID (MAC)</th>
                  </tr>
                </thead>
                <tbody>
                  {activeConns.map(function(item, idx) {
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td>{item.address}</td>
                        <td>{item.uptime}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item['caller-id'] || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MikrotikPage;

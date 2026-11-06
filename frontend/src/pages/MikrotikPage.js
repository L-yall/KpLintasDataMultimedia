import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MikrotikStatus from '../components/MikrotikStatus';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';

function MikrotikPage({ socket }) {
  var [status, setStatus] = useState({ online: false, error: 'Memuat...' });
  var [activeConns, setActiveConns] = useState([]);
  var [unregistered, setUnregistered] = useState([]);
  var [loading, setLoading] = useState(true);
  var [activeTab, setActiveTab] = useState('unregistered'); // 'unregistered' or 'active'
  var [unregPage, setUnregPage] = useState(1);
  var [activePage, setActivePage] = useState(1);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };
  var itemsPerPage = 10;
  var unregTotalPages = Math.max(1, Math.ceil(unregistered.length / itemsPerPage));
  var activeTotalPages = Math.max(1, Math.ceil(activeConns.length / itemsPerPage));
  var paginatedUnregistered = unregistered.slice((unregPage - 1) * itemsPerPage, unregPage * itemsPerPage);
  var paginatedActive = activeConns.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  useEffect(function () {
    if (unregPage > unregTotalPages) setUnregPage(unregTotalPages);
    if (activePage > activeTotalPages) setActivePage(activeTotalPages);
  }, [unregPage, unregTotalPages, activePage, activeTotalPages]);

  useEffect(function () {
    setUnregPage(1);
    setActivePage(1);
  }, [activeTab]);

  useEffect(function () {
    fetchData();

    // Listen to real-time events from websocket
    if (socket) {
      socket.on('mikrotik_ping', function (pingData) {
        setStatus(pingData);
      });

      socket.on('pppoe_summary', function (summary) {
        setUnregistered(summary.unregistered_list || []);
      });
    }

    return function () {
      if (socket) {
        socket.off('mikrotik_ping');
        socket.off('pppoe_summary');
      }
    };
  }, [socket]);

  async function fetchData() {
    try {
      var statusRes = await axios.get(`${API_BASE_URL}/api/mikrotik/status`, { headers: headers });
      setStatus(statusRes.data.data);

      var activeRes = await axios.get(`${API_BASE_URL}/api/mikrotik/active`, { headers: headers });
      setActiveConns(activeRes.data.data);

      var unregRes = await axios.get(`${API_BASE_URL}/api/mikrotik/unregistered`, { headers: headers });
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
      var activeRes = await axios.get(`${API_BASE_URL}/api/mikrotik/active`, { headers: headers });
      setActiveConns(activeRes.data.data);
      var unregRes = await axios.get(`${API_BASE_URL}/api/mikrotik/unregistered`, { headers: headers });
      setUnregistered(unregRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function renderPagination(currentPage, totalPages, setPage) {
    if (totalPages <= 1) return null;

    var pages = [];
    for (var page = 1; page <= totalPages; page++) pages.push(page);

    return (
      <nav aria-label="Page navigation" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (currentPage === 1 ? ' disabled' : '')}>
            <a href="#" className="mikrotik-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== 1) setPage(Math.max(1, currentPage - 1)); }} aria-label="Previous" aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined}>«</a>
          </li>
          {pages.map(function (pageNumber) {
            return (
              <li key={pageNumber}>
                <a href="#" className={'mikrotik-page-button page-link' + (currentPage === pageNumber ? ' active' : '')} onClick={function (e) { e.preventDefault(); setPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={currentPage === pageNumber ? 'page' : undefined}>{pageNumber}</a>
              </li>
            );
          })}
          <li className={'page-item' + (currentPage === totalPages ? ' disabled' : '')}>
            <a href="#" className="mikrotik-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== totalPages) setPage(Math.min(totalPages, currentPage + 1)); }} aria-label="Next" aria-disabled={currentPage === totalPages} tabIndex={currentPage === totalPages ? -1 : undefined}>»</a>
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
        .mikrotik-page-button {
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
        .page-item:first-child .mikrotik-page-button {
          border-left: 1px solid var(--border-color);
          border-radius: 6px 0 0 6px;
        }
        .page-item:last-child .mikrotik-page-button {
          border-radius: 0 6px 6px 0;
        }
        .mikrotik-page-button:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .mikrotik-page-button.active {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .mikrotik-page-button.active:hover {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .page-item.disabled .mikrotik-page-button {
          color: #006876;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>
      <div className="page-header">
        <div>
          <h1>Integrasi Mikrotik</h1>
          <p>Pantau status koneksi router dan active sessions PPPoE secara real-time.</p>
        </div>
        <button className="btn btn-primary" onClick={refreshActive} disabled={loading} style={{
          background: 'var(--md-primary-fixed)',
          color: 'var(--md-on-primary-fixed-variant)',
          fontWeight: '700'
        }}>
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
          onClick={function () { setActiveTab('unregistered'); }}
        >
          <TemplateIcon name="alert" size={16} style={{ marginRight: '6px' }} /> Belum Terdaftar ({unregistered.length})
        </button>
        <button
          className={'btn btn-sm ' + (activeTab === 'active' ? 'btn-primary' : 'btn-secondary')}
          onClick={function () { setActiveTab('active'); }}
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
              <>
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
                    {paginatedUnregistered.map(function (item, idx) {
                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{(unregPage - 1) * itemsPerPage + idx + 1}</td>
                          <td>
                            <code style={{
                              background: 'var(--status-merah-bg)',
                              color: 'var(--status-merah)',
                              padding: '2px 8px',
                              borderRadius: '5px',
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
                {renderPagination(unregPage, unregTotalPages, setUnregPage)}
              </>
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
              <>
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
                    {paginatedActive.map(function (item, idx) {
                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{(activePage - 1) * itemsPerPage + idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>{item.address}</td>
                          <td>{item.uptime}</td>
                          <td style={{ fontFamily: 'monospace' }}>{item['caller-id'] || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {renderPagination(activePage, activeTotalPages, setActivePage)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MikrotikPage;

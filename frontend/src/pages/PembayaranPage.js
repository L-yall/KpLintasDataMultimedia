import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';

function PembayaranPage({ socket }) {
  var { showAlert, confirmDialog } = useDialog();
  var [pendingPayments, setPendingPayments] = useState([]);
  var [approvedManualPayments, setApprovedManualPayments] = useState([]);
  var [manualPage, setManualPage] = useState(1);
  var [gatewayPage, setGatewayPage] = useState(1);
  var [loading, setLoading] = useState(true);
  var location = useLocation();
  var queryType = new URLSearchParams(location.search).get('type') || 'manual'; // 'manual', 'duitku', or 'midtrans'

  // Modals state
  var [viewBukti, setViewBukti] = useState(null); // holds payment object
  var [rejectTarget, setRejectTarget] = useState(null); // holds payment object
  var [alasanTolak, setAlasanTolak] = useState('');
  var [actionLoading, setActionLoading] = useState(false);
  var [zoomScale, setZoomScale] = useState(1);
  var [successMsg, setSuccessMsg] = useState('');

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };
  var paymentsPerPage = 10;
  var manualTotalPages = Math.max(1, Math.ceil(approvedManualPayments.length / paymentsPerPage));
  var gatewayTotalPages = Math.max(1, Math.ceil(pendingPayments.length / paymentsPerPage));
  var paginatedManualPayments = approvedManualPayments.slice((manualPage - 1) * paymentsPerPage, manualPage * paymentsPerPage);
  var paginatedGatewayPayments = pendingPayments.slice((gatewayPage - 1) * paymentsPerPage, gatewayPage * paymentsPerPage);

  useEffect(function () {
    setManualPage(1);
    setGatewayPage(1);
  }, [queryType]);

  useEffect(function () {
    if (manualPage > manualTotalPages) setManualPage(manualTotalPages);
    if (gatewayPage > gatewayTotalPages) setGatewayPage(gatewayTotalPages);
  }, [manualPage, manualTotalPages, gatewayPage, gatewayTotalPages]);

  useEffect(function () {
    fetchPending();

    // Listen for new payments uploaded in real-time
    if (socket) {
      socket.on('pembayaran_masuk', function (newPayment) {
        console.log('Ada pembayaran masuk baru:', newPayment);
        setSuccessMsg(`Notifikasi: Pembayaran baru masuk dari ${newPayment.nama_pelanggan}!`);
        fetchPending();

        // Clear toast after 5s
        setTimeout(function () {
          setSuccessMsg('');
        }, 5000);
      });
    }

    return function () {
      if (socket) {
        socket.off('pembayaran_masuk');
      }
    };
  }, [socket, queryType]);

  async function fetchPending() {
    setLoading(true);
    try {
      var url = `${API_BASE_URL}/api/pembayaran/pending`;
      if (queryType === 'duitku') {
        url = `${API_BASE_URL}/api/pembayaran/duitku`;
      } else if (queryType === 'midtrans') {
        url = `${API_BASE_URL}/api/pembayaran/midtrans`;
      }

      var response = await axios.get(url, { headers: headers });
      if (response.data.success) {
        setPendingPayments(response.data.data);
      }

      // Jika halaman manual, ambil juga riwayat pembayaran manual yang sudah disetujui
      if (queryType === 'manual') {
        try {
          var resp2 = await axios.get(`${API_BASE_URL}/api/pembayaran/manual`, { headers: headers });
          if (resp2.data.success) setApprovedManualPayments(resp2.data.data);
        } catch (err2) {
          console.error('Gagal mengambil riwayat pembayaran manual:', err2);
        }
      } else {
        // kosongkan state riwayat jika bukan halaman manual
        setApprovedManualPayments([]);
      }
    } catch (err) {
      console.error('Gagal mengambil pengajuan pembayaran:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id_pembayaran) {
    if (!await confirmDialog('Apakah Anda yakin ingin MENYETUJUI pembayaran ini? Akun internet pelanggan akan otomatis diaktifkan di Mikrotik.', { tone: 'info', confirmLabel: 'Ya, setujui', cancelLabel: 'Batal' })) {
      return;
    }

    setActionLoading(true);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/pembayaran/${id_pembayaran}/approve`, {}, { headers: headers });
      await showAlert(response.data.message, { tone: 'success' });
      setViewBukti(null);
      fetchPending();
    } catch (err) {
      await showAlert('Gagal menyetujui pembayaran: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(e) {
    e.preventDefault();
    if (!alasanTolak) {
      showAlert('Silakan isi alasan penolakan terlebih dahulu.', { tone: 'error' });
      return;
    }

    setActionLoading(true);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/pembayaran/${rejectTarget.id_pembayaran}/reject`, {
        alasan_tolak: alasanTolak
      }, { headers: headers });

      await showAlert(response.data.message, { tone: 'success' });
      setRejectTarget(null);
      setAlasanTolak('');
      setViewBukti(null);
      fetchPending();
    } catch (err) {
      await showAlert('Gagal menolak pembayaran: ' + (err.response?.data?.message || err.message), { tone: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function parseOnlineBukti(buktiStr) {
    if (!buktiStr) return { gateway: 'Online', tipe: 'Online Gateway', bank: '-', status: 'Selesai' };
    var parts = buktiStr.split(' / ');
    var gateway = (parts[0] || 'Online').trim();
    var rawType = (parts[1] || 'automatic').trim();
    var rawStatus = (parts[2] || 'success').trim();

    var channelInfoMap = {
      // Duitku Virtual Account Codes
      'BC': { label: 'Virtual Account', bank: 'Bank BCA (Virtual Account)' },
      'M2': { label: 'Virtual Account', bank: 'Bank Mandiri (Virtual Account H2H)' },
      'BR': { label: 'Virtual Account', bank: 'Bank BRI (Virtual Account)' },
      'I1': { label: 'Virtual Account', bank: 'Bank BNI (Virtual Account)' },
      'BV': { label: 'Virtual Account', bank: 'Bank BSI (Bank Syariah Indonesia VA)' },
      'NC': { label: 'Virtual Account', bank: 'Bank Neo Commerce (BNC VA)' },
      'AG': { label: 'Virtual Account', bank: 'Bank Artha Graha (Virtual Account)' },
      'SP': { label: 'Virtual Account / E-Wallet', bank: 'Bank Sahabat Sampoerna / ShopeePay' },

      // Duitku QRIS & E-Wallets
      'LQ': { label: 'QRIS Real-Time', bank: 'QRIS (Semua Bank & E-Wallet)' },
      'OV': { label: 'E-Wallet', bank: 'OVO' },
      'DA': { label: 'E-Wallet', bank: 'DANA' },
      'LA': { label: 'E-Wallet', bank: 'LinkAja' },

      // Duitku Retail & Card
      'IR': { label: 'Minimarket', bank: 'Indomaret' },
      'FT': { label: 'Gerai Retail', bank: 'Retail / Alfamart / Pos Indonesia' },
      'VC': { label: 'Kartu Kredit / Debit', bank: 'Kartu Kredit / Debit Online' },

      // Midtrans Types
      'bank_transfer': { label: 'Virtual Account', bank: 'Virtual Account (Transfer Bank)' },
      'echannel': { label: 'Virtual Account', bank: 'Bank Mandiri (Bill Payment / VA)' },
      'bca': { label: 'Virtual Account', bank: 'Bank BCA (Virtual Account)' },
      'bni': { label: 'Virtual Account', bank: 'Bank BNI (Virtual Account)' },
      'bri': { label: 'Virtual Account', bank: 'Bank BRI (Virtual Account)' },
      'permata': { label: 'Virtual Account', bank: 'Bank Permata (Virtual Account)' },
      'cimb': { label: 'Virtual Account', bank: 'Bank CIMB Niaga (Virtual Account)' },
      'qris': { label: 'QRIS Real-Time', bank: 'QRIS (Gopay/OVO/Dana/LinkAja/Semua Bank)' },
      'gopay': { label: 'E-Wallet', bank: 'GoPay / GoPay Later' },
      'shopeepay': { label: 'E-Wallet', bank: 'ShopeePay / SPayLater' },
      'cstore': { label: 'Minimarket', bank: 'Minimarket (Indomaret / Alfamart)' },
      'credit_card': { label: 'Kartu Kredit', bank: 'Kartu Kredit (Visa / Mastercard / JCB)' }
    };

    var matched = channelInfoMap[rawType] || channelInfoMap[rawType.toLowerCase()] || {
      label: rawType.replace(/_/g, ' ').toUpperCase(),
      bank: rawType.replace(/_/g, ' ').toUpperCase()
    };

    var statusMap = {
      '00': 'Sukses (00)',
      'settlement': 'Sukses (Settlement)',
      'capture': 'Sukses (Captured)',
      'success': 'Sukses',
      'pending': 'Tertunda (Pending)',
      'deny': 'Ditolak (Denied)',
      'expire': 'Kadaluarsa (Expired)',
      'cancel': 'Dibatalkan (Cancelled)'
    };

    return {
      gateway: gateway,
      tipe: gateway + ' (' + matched.label + ')',
      bank: matched.bank,
      status: statusMap[rawStatus] || rawStatus.toUpperCase()
    };
  }

  function handleBuktiWheel(e) {
    e.preventDefault();
    setZoomScale(function (prev) {
      var nextScale = prev - e.deltaY * 0.0012;
      return Math.min(3, Math.max(1, nextScale));
    });
  }

  function resetBuktiZoom() {
    setZoomScale(1);
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

  function renderPagination(currentPage, totalPages, setPage) {
    if (totalPages <= 1) return null;

    var pages = [];
    for (var page = 1; page <= totalPages; page++) pages.push(page);

    return (
      <nav aria-label="Page navigation" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (currentPage === 1 ? ' disabled' : '')}>
            <a href="#" className="payment-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== 1) setPage(Math.max(1, currentPage - 1)); }} aria-label="Previous" aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined}>«</a>
          </li>
          {pages.map(function (pageNumber) {
            return (
              <li
                key={pageNumber}
              >
                <a href="#" className={'payment-page-button page-link' + (currentPage === pageNumber ? ' active' : '')} onClick={function (e) { e.preventDefault(); setPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={currentPage === pageNumber ? 'page' : undefined}>{pageNumber}</a>
              </li>
            );
          })}
          <li className={'page-item' + (currentPage === totalPages ? ' disabled' : '')}>
            <a href="#" className="payment-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== totalPages) setPage(Math.min(totalPages, currentPage + 1)); }} aria-label="Next" aria-disabled={currentPage === totalPages} tabIndex={currentPage === totalPages ? -1 : undefined}>»</a>
          </li>
        </ul>
      </nav>
    );
  }

  var getTitle = function () {
    if (queryType === 'duitku') return 'Riwayat Pembayaran Duitku Gateway';
    if (queryType === 'midtrans') return 'Riwayat Pembayaran Midtrans Gateway';
    return 'Persetujuan Pembayaran Transfer Manual';
  };

  var getSubTitle = function () {
    if (queryType === 'duitku') return 'Daftar transaksi pembayaran tagihan otomatis via Duitku Gateway (QRIS, VA, ShopeePay, Minimarket, dll).';
    if (queryType === 'midtrans') return 'Daftar transaksi pembayaran tagihan otomatis via Midtrans Gateway.';
    return 'Verifikasi bukti transfer dari pelanggan dan aktifkan kembali layanan internet mereka.';
  };

  var getEmptyMessage = function () {
    if (queryType === 'duitku') return 'Belum ada transaksi pembayaran via Duitku Gateway.';
    if (queryType === 'midtrans') return 'Belum ada transaksi pembayaran via Midtrans Gateway.';
    return 'Tidak ada pengajuan pembayaran pending saat ini. Semua bersih!';
  };

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
        .payment-page-button {
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
        .page-item:first-child .payment-page-button {
          border-left: 1px solid var(--border-color);
          border-radius: 6px 0 0 6px;
        }
        .page-item:last-child .payment-page-button {
          border-radius: 0 6px 6px 0;
        }
        .payment-page-button:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .payment-page-button.active {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .payment-page-button.active:hover {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .page-item.disabled .payment-page-button {
          color: #006876;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>
      <div className="page-header">
        <div>
          <h1>{getTitle()}</h1>
          <p>{getSubTitle()}</p>
        </div>
      </div>

      {/* Payment Gateway Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link
          to="/dashboard/pembayaran?type=manual"
          className={'btn ' + (queryType === 'manual' ? 'btn-primary' : 'btn-secondary')}
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <TemplateIcon name="camera" size={16} /> Transfer Manual
        </Link>
        <Link
          to="/dashboard/pembayaran?type=duitku"
          className={'btn ' + (queryType === 'duitku' ? 'btn-primary' : 'btn-secondary')}
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span> Duitku Gateway
        </Link>
        <Link
          to="/dashboard/pembayaran?type=midtrans"
          className={'btn ' + (queryType === 'midtrans' ? 'btn-primary' : 'btn-secondary')}
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shield</span> Midtrans Gateway
        </Link>
      </div>

      {/* Riwayat Pembayaran Manual (Disetujui) */}
      {queryType === 'manual' && (
        <div className="table-container animate-fadeIn" style={{ marginTop: '28px' }}>
          <div className="table-header">
            <h3>
              <TemplateIcon name="history" size={18} style={{ marginRight: '8px' }} />
              Riwayat Pembayaran Manual (Disetujui) ({approvedManualPayments.length})
            </h3>
          </div>

          {loading ? (
            <div style={{ padding: '40px' }}>
              <div className="skeleton skeleton-text lg" style={{ width: '30%' }} />
            </div>
          ) : approvedManualPayments.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="check" size={28} /></div>
              <p>Belum ada pembayaran manual yang disetujui.</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Pelanggan</th>
                    <th>No HP</th>
                    <th>Periode Tagihan</th>
                    <th>Nominal</th>
                    <th>Waktu Verifikasi</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedManualPayments.map(function (item, idx) {
                    return (
                      <tr key={item.id_pembayaran}>
                        <td style={{ color: 'var(--text-muted)' }}>{(manualPage - 1) * paymentsPerPage + idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.nama}</td>
                        <td>{item.no_hp}</td>
                        <td><code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '5px' }}>{item.periode}</code></td>
                        <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>Rp {Number(item.nominal).toLocaleString('id-ID')}</td>
                        <td>{formatTanggal(item.verified_at || item.tanggal_upload)}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={function () { setZoomScale(1); setViewBukti(Object.assign({}, item, { isApprovedManual: true })); }}>
                            <TemplateIcon name="camera" size={14} style={{ marginRight: '6px' }} /> Lihat Bukti
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {renderPagination(manualPage, manualTotalPages, setManualPage)}
            </>
          )}
        </div>
      )}



      {successMsg && (
        <div className="status-badge hijau animate-fadeIn" style={{ width: '100%', padding: '12px 16px', borderRadius: '5px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <TemplateIcon name="bell" size={16} style={{ marginRight: '8px' }} /> {successMsg}
        </div>
      )}

      {queryType !== 'manual' && (
        <div className="table-container animate-fadeIn">
          <div className="table-header">
            <h3>
              <TemplateIcon name="document" size={18} style={{ marginRight: '8px' }} />
              Transaksi Sukses ({pendingPayments.length})
            </h3>
          </div>

          {loading ? (
            <div style={{ padding: '40px' }}>
              <div className="skeleton skeleton-text lg" style={{ width: '30%' }} />
              <div className="skeleton skeleton-text" style={{ width: '80%', marginTop: '16px' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%', marginTop: '12px' }} />
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon"><TemplateIcon name="check" size={28} /></div>
              <p>{getEmptyMessage()}</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Pelanggan</th>
                    <th>No HP</th>
                    <th>Periode Tagihan</th>
                    <th>Nominal</th>
                    <th>Waktu Transaksi</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGatewayPayments.map(function (item, idx) {
                    var isOnlinePayment = item.bukti_file && (item.bukti_file.includes('Midtrans') || item.bukti_file.includes('Duitku'));
                    return (
                      <tr key={item.id_pembayaran}>
                        <td style={{ color: 'var(--text-muted)' }}>{(gatewayPage - 1) * paymentsPerPage + idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.nama}</td>
                        <td>{item.no_hp}</td>
                        <td><code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '5px' }}>{item.periode}</code></td>
                        <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>
                          Rp {Number(item.nominal).toLocaleString('id-ID')}
                        </td>
                        <td>{formatTanggal(item.tanggal_upload)}</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={function () { setZoomScale(1); setViewBukti(item); }}
                          >
                            <TemplateIcon name={isOnlinePayment ? 'document' : 'camera'} size={14} style={{ marginRight: '6px' }} />
                            {isOnlinePayment ? 'Detail Transaksi' : 'Lihat Bukti'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {renderPagination(gatewayPage, gatewayTotalPages, setGatewayPage)}
            </>
          )}
        </div>
      )}

      {/* Modal View Bukti Transfer / Detail Transaksi */}
      {viewBukti && (
        <Modal
          isOpen={viewBukti !== null}
          onClose={function () { resetBuktiZoom(); setViewBukti(null); }}
          title={
            viewBukti.bukti_file && (viewBukti.bukti_file.includes('Midtrans') || viewBukti.bukti_file.includes('Duitku')) ? (
              <><TemplateIcon name="document" size={16} style={{ marginRight: '8px' }} /> Detail Transaksi Online - {viewBukti.nama}</>
            ) : (
              <><TemplateIcon name="camera" size={16} style={{ marginRight: '8px' }} /> Bukti Transfer - {viewBukti.nama}</>
            )
          }
          footer={
            viewBukti.bukti_file && (viewBukti.bukti_file.includes('Midtrans') || viewBukti.bukti_file.includes('Duitku')) ? (
              <button className="btn btn-primary btn-sm" onClick={function () { setViewBukti(null); }}>Tutup</button>
            ) : viewBukti.isApprovedManual ? (
              <button className="btn btn-primary btn-sm" onClick={function () { setViewBukti(null); }}>Tutup</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={function () { setViewBukti(null); }}>Batal</button>
                <button
                  className="btn btn-danger"
                  onClick={function () { setRejectTarget(viewBukti); }}
                  disabled={actionLoading}
                >
                  <TemplateIcon name="close" size={14} style={{ marginRight: '6px' }} /> Tolak
                </button>
                <button
                  className="btn btn-primary"
                  onClick={function () { handleApprove(viewBukti.id_pembayaran); }}
                  disabled={actionLoading}
                >
                  <TemplateIcon name="check" size={14} style={{ marginRight: '6px' }} /> Terima Pembayaran
                </button>
              </>
            )
          }
        >
          {viewBukti.bukti_file && (viewBukti.bukti_file.includes('Midtrans') || viewBukti.bukti_file.includes('Duitku')) ? (
            <div style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nama Pelanggan</span>
                  <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{viewBukti.nama}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No HP</span>
                  <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{viewBukti.no_hp}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Periode Tagihan</span>
                  <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{viewBukti.periode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nominal</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.88rem' }}>
                    Rp {Number(viewBukti.nominal).toLocaleString('id-ID')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Metode Pembayaran</span>
                  <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                    {parseOnlineBukti(viewBukti.bukti_file).tipe}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Bank / Saluran Pembayaran</span>
                  <span style={{ fontWeight: '700', color: 'var(--md-primary, #006876)', fontSize: '0.88rem' }}>
                    {parseOnlineBukti(viewBukti.bukti_file).bank}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Status Transaksi</span>
                  <span className="status-badge hijau" style={{ fontSize: '0.78rem' }}>
                    {parseOnlineBukti(viewBukti.bukti_file).status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Waktu Transaksi</span>
                  <span style={{ fontSize: '0.88rem' }}>{formatTanggal(viewBukti.tanggal_upload)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>ID Pembayaran</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontFamily: 'monospace' }}>#{viewBukti.id_pembayaran}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
                Tagihan: <strong>Rp {Number(viewBukti.nominal).toLocaleString('id-ID')}</strong> | Periode: <strong>{viewBukti.periode}</strong>
              </p>
              <div className="image-zoom-wrapper">
                <img
                  src={`${API_BASE_URL}${viewBukti.bukti_file}`}
                  alt="Bukti Transfer Pelanggan"
                  className={zoomScale > 1 ? 'image-zoom-image zoomed' : 'image-zoom-image'}
                  onWheel={handleBuktiWheel}
                  style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center center' }}
                />
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal Tolak Pembayaran */}
      {rejectTarget && (
        <Modal
          isOpen={rejectTarget !== null}
          onClose={function () { setRejectTarget(null); setAlasanTolak(''); }}
          title={<><TemplateIcon name="close" size={16} style={{ marginRight: '8px' }} /> Tolak Pembayaran - {rejectTarget.nama}</>}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={function () { setRejectTarget(null); setAlasanTolak(''); }}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={actionLoading || !alasanTolak}
              >
                {actionLoading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Mengirim...</> : <><TemplateIcon name="close" size={16} style={{ marginRight: '6px' }} /> Tolak Bukti Transfer</>}
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
                onChange={function (e) { setAlasanTolak(e.target.value); }}
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

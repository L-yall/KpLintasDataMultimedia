import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';
import { Link } from 'react-router-dom';

function TagihanPage({ socket, admin }) {
  var { showAlert } = useDialog();
  var savedAdminStr = localStorage.getItem('admin');
  var currentAdmin = admin || (savedAdminStr ? JSON.parse(savedAdminStr) : null);
  var isSuperAdmin = currentAdmin && currentAdmin.role === 'superadmin';

  var [tagihanList, setTagihanList] = useState([]);
  var [stats, setStats] = useState({
    total_tagihan: 0,
    total_unpaid: 0,
    total_pending: 0,
    total_paid: 0,
    nominal_unpaid: 0,
    nominal_paid: 0,
    nominal_pending: 0
  });
  var [pelangganList, setPelangganList] = useState([]);
  var [loading, setLoading] = useState(true);
  var [searchQuery, setSearchQuery] = useState('');
  var [filterStatus, setFilterStatus] = useState('semua'); // 'semua', 'belum_bayar', 'menunggu_verifikasi', 'lunas', 'terlambat'
  var [periodeFilter, setPeriodeFilter] = useState('');
  var [currentPage, setCurrentPage] = useState(1);
  var [copiedId, setCopiedId] = useState(null);
  var [viewBuktiItem, setViewBuktiItem] = useState(null);

  // Modal State for Manual Invoice Creation
  var [showModal, setShowModal] = useState(false);
  var [formSubmitting, setFormSubmitting] = useState(false);
  var [formError, setFormError] = useState('');
  var [selectedPelanggan, setSelectedPelanggan] = useState('');
  var [formPeriode, setFormPeriode] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  var [formJumlah, setFormJumlah] = useState('');
  var [formDueDate, setFormDueDate] = useState('');

  // Delete Confirmation Modal
  var [deleteConfirm, setDeleteConfirm] = useState(null);
  var [deleting, setDeleting] = useState(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  var pageSize = filterStatus === 'lunas' ? 10 : 10;
  var totalPages = Math.max(1, Math.ceil(tagihanList.length / pageSize));
  var paginatedTagihan = tagihanList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(function () {
    setCurrentPage(1);
  }, [filterStatus, periodeFilter, searchQuery]);

  useEffect(function () {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  var fetchStats = useCallback(async function () {
    try {
      var res = await axios.get(API_BASE_URL + '/api/tagihan/stats', { headers: headers });
      if (res.data.success && res.data.data) {
        var d = res.data.data;
        setStats({
          total_tagihan: d.total_tagihan !== undefined ? d.total_tagihan : (d.total_count || 0),
          total_unpaid: d.total_unpaid !== undefined ? d.total_unpaid : (d.belum_bayar ? d.belum_bayar.count : 0),
          nominal_unpaid: d.nominal_unpaid !== undefined ? d.nominal_unpaid : (d.belum_bayar ? d.belum_bayar.nominal : 0),
          total_pending: d.total_pending !== undefined ? d.total_pending : (d.menunggu_verifikasi ? d.menunggu_verifikasi.count : 0),
          nominal_pending: d.nominal_pending !== undefined ? d.nominal_pending : (d.menunggu_verifikasi ? d.menunggu_verifikasi.nominal : 0),
          total_paid: d.total_paid !== undefined ? d.total_paid : (d.lunas ? d.lunas.count : 0),
          nominal_paid: d.nominal_paid !== undefined ? d.nominal_paid : (d.lunas ? d.lunas.nominal : 0)
        });
      }
    } catch (err) {
      console.error('Gagal fetch stats tagihan:', err);
    }
  }, [token]);

  var fetchTagihan = useCallback(async function () {
    try {
      setLoading(true);
      var params = {};
      if (filterStatus !== 'semua') params.status = filterStatus;
      if (periodeFilter) params.periode = periodeFilter;
      if (searchQuery) {
        params.search = searchQuery;
        params.q = searchQuery;
      }

      var res = await axios.get(API_BASE_URL + '/api/tagihan', {
        headers: headers,
        params: params
      });
      if (res.data.success) {
        setTagihanList(res.data.data || []);
      }
    } catch (err) {
      console.error('Gagal fetch data tagihan:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, periodeFilter, searchQuery, token]);

  var fetchPelanggan = useCallback(async function () {
    try {
      var res = await axios.get(API_BASE_URL + '/api/pelanggan', { headers: headers });
      if (res.data.success) {
        setPelangganList(res.data.data || []);
      }
    } catch (err) {
      console.error('Gagal fetch pelanggan:', err);
    }
  }, [token]);

  useEffect(function () {
    fetchStats();
    fetchTagihan();
    fetchPelanggan();

    if (socket) {
      var handleSocketUpdate = function () {
        fetchStats();
        fetchTagihan();
      };
      socket.on('tagihan_created', handleSocketUpdate);
      socket.on('tagihan_updated', handleSocketUpdate);
      socket.on('tagihan_deleted', handleSocketUpdate);
      socket.on('pembayaran_masuk', handleSocketUpdate);
      socket.on('pembayaran_approved', handleSocketUpdate);

      return function () {
        socket.off('tagihan_created', handleSocketUpdate);
        socket.off('tagihan_updated', handleSocketUpdate);
        socket.off('tagihan_deleted', handleSocketUpdate);
        socket.off('pembayaran_masuk', handleSocketUpdate);
        socket.off('pembayaran_approved', handleSocketUpdate);
      };
    }
  }, [socket, fetchStats, fetchTagihan, fetchPelanggan]);

  // When customer is selected in manual invoice modal, autofill price & due date
  function handlePelangganChange(e) {
    var pId = e.target.value;
    setSelectedPelanggan(pId);
    var found = pelangganList.find(function (p) { return String(p.id_pelanggan) === String(pId); });
    if (found) {
      if (found.harga) setFormJumlah(found.harga);
      if (found.due_date) {
        setFormDueDate(found.due_date.split('T')[0]);
      } else {
        var d = new Date();
        d.setDate(d.getDate() + 7);
        setFormDueDate(d.toISOString().split('T')[0]);
      }
    }
  }

  async function handleCreateTagihan(e) {
    e.preventDefault();
    setFormError('');

    if (!selectedPelanggan || !formPeriode || !formJumlah || !formDueDate) {
      setFormError('Semua field wajib diisi.');
      return;
    }

    setFormSubmitting(true);
    try {
      var res = await axios.post(
        API_BASE_URL + '/api/tagihan',
        {
          id_pelanggan: selectedPelanggan,
          periode: formPeriode,
          jumlah: formJumlah,
          due_date: formDueDate
        },
        { headers: headers }
      );

      if (res.data.success) {
        setShowModal(false);
        setSelectedPelanggan('');
        setFormJumlah('');
        setFormDueDate('');
        fetchStats();
        fetchTagihan();
      } else {
        setFormError(res.data.message || 'Gagal membuat tagihan.');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteTagihan() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      var res = await axios.delete(API_BASE_URL + '/api/tagihan/' + deleteConfirm.id_tagihan, {
        headers: headers
      });
      if (res.data.success) {
        setDeleteConfirm(null);
        fetchStats();
        fetchTagihan();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Gagal menghapus tagihan.', { tone: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  function handleCopyPaymentLink(item) {
    var host = window.location.origin;
    var payLink = host + '/bayar?hp=' + encodeURIComponent(item.no_hp || '');
    navigator.clipboard.writeText(payLink).then(function () {
      setCopiedId(item.id_tagihan);
      setTimeout(function () {
        setCopiedId(null);
      }, 2500);
    });
  }

  function handleSendWhatsApp(item) {
    var phone = (item.no_hp || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
    var portalLink = window.location.origin + '/bayar?hp=' + encodeURIComponent(item.no_hp || '');
    var finalNominal = Number(item.nominal || item.jumlah || 0);
    var text =
      `Halo Bapak/Ibu *${item.nama}*,\n\n` +
      `Kami menginformasikan tagihan internet Anda dari *Lintas Data Multimedia*:\n\n` +
      `📄 No. Tagihan: *#INV-${item.id_tagihan}*\n` +
      `📦 Paket: *${item.paket || '-'}*\n` +
      `📅 Periode: *${item.periode}*\n` +
      `💰 Total Tagihan: *Rp ${finalNominal.toLocaleString('id-ID')}*\n` +
      `⏰ Batas Jatuh Tempo: *${formatTanggal(item.due_date)}*\n` +
      `📌 Status: *${item.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}*\n\n` +
      `Untuk kemudahan pembayaran otomatis (QRIS, VA, E-Wallet) dan cek tagihan, silakan akses portal pelanggan berikut:\n` +
      `${portalLink}\n\n` +
      `Terima kasih telah menggunakan layanan Lintas Data Multimedia.`;

    var waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function hitungSelisihHari(dueDate) {
    if (!dueDate) return null;
    var hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    var tanggalJT = new Date(dueDate);
    tanggalJT.setHours(0, 0, 0, 0);
    return Math.ceil((tanggalJT.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24));
  }

  function renderStatusBadge(item) {
    var status = item.status;
    if (status === 'lunas') {
      return (
        <span className="badge-pill" style={{ background: 'rgba(15, 157, 91, 0.12)', color: '#0f9d58', border: '1px solid rgba(15, 157, 91, 0.3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
          Lunas
        </span>
      );
    }
    if (status === 'menunggu_verifikasi') {
      return (
        <span className="badge-pill" style={{ background: 'rgba(2, 136, 209, 0.12)', color: '#0288d1', border: '1px solid rgba(2, 136, 209, 0.3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>hourglass_top</span>
          Menunggu Verifikasi
        </span>
      );
    }

    var selisih = hitungSelisihHari(item.due_date);
    if (selisih !== null && selisih < 0) {
      return (
        <span className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
          Terlambat ({Math.abs(selisih)} hari)
        </span>
      );
    }

    if (selisih !== null && selisih <= 3) {
      return (
        <span className="badge-pill" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
          H-{selisih} Jatuh Tempo
        </span>
      );
    }

    return (
      <span className="badge-pill" style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.3)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>receipt</span>
        Belum Bayar
      </span>
    );
  }

  function renderPagination() {
    if (tagihanList.length <= pageSize) return null;

    var pages = [];
    for (var page = 1; page <= totalPages; page++) {
      pages.push(page);
    }

    return (
      <nav aria-label="Page navigation" className="tagihan-pagination" style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '12px 20px',
        borderTop: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (currentPage === 1 ? ' disabled' : '')}>
            <a href="#" className="tagihan-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== 1) setCurrentPage(Math.max(1, currentPage - 1)); }} aria-label="Previous" aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined}>«</a>
          </li>
          {pages.map(function (pageNumber) {
            return (
              <li
                key={pageNumber}
              >
                <a href="#" className={'tagihan-page-button page-link' + (currentPage === pageNumber ? ' active' : '')} onClick={function (e) { e.preventDefault(); setCurrentPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={currentPage === pageNumber ? 'page' : undefined}>{pageNumber}</a>
              </li>
            );
          })}
          <li className={'page-item' + (currentPage === totalPages ? ' disabled' : '')}>
            <a href="#" className="tagihan-page-button page-link" onClick={function (e) { e.preventDefault(); if (currentPage !== totalPages) setCurrentPage(Math.min(totalPages, currentPage + 1)); }} aria-label="Next" aria-disabled={currentPage === totalPages} tabIndex={currentPage === totalPages ? -1 : undefined}>»</a>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
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
        .tagihan-hero {
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
        .tagihan-hero h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .tagihan-hero p {
          color: rgba(255, 255, 255, 0.85);
          max-width: 600px;
          line-height: 1.5;
          font-size: 0.95rem;
          margin: 0;
        }
        .tagihan-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 1024px) {
          .tagihan-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .tagihan-stats-grid {
            grid-template-columns: 1fr;
          }
        }
        .tagihan-stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 20px 22px;
          box-shadow: var(--shadow-sm);
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .tagihan-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .tagihan-stat-card.active {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-glow);
        }
        .tagihan-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tagihan-stat-val {
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1.1;
        }
        .tagihan-stat-lbl {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .tagihan-stat-sub {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .action-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }
        .action-icon-btn:hover {
          background: var(--bg-hover);
          color: var(--primary);
          border-color: var(--primary);
        }
        .action-icon-btn.whatsapp:hover {
          background: #25d366;
          color: white;
          border-color: #25d366;
        }
        .action-icon-btn.delete:hover {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }
        .tagihan-page-button {
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
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .page-item:first-child .tagihan-page-button {
          border-left: 1px solid var(--border-color);
          border-radius: 6px 0 0 6px;
        }
        .page-item:last-child .tagihan-page-button {
          border-radius: 0 6px 6px 0;
        }
        .tagihan-page-button:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }
        .tagihan-page-button.active {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .tagihan-page-button.active:hover {
          background: #006876;
          color: #ffffff;
          border-color: #006876;
        }
        .page-item.disabled .tagihan-page-button {
          color: #006876;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>

      {/* Hero Banner */}
      <section className="tagihan-hero animate-fadeIn">
        <div>
          <h1>Billing & Manajemen Tagihan</h1>
          <p>Kelola seluruh tagihan pelanggan, monitor pembayaran jatuh tempo, kirim notifikasi tagihan WhatsApp, dan terbitkan invoice baru secara terintegrasi.</p>
        </div>
        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={function () { setShowModal(true); setFormError(''); }}
              style={{
                background: '#ffffff',
                color: '#004e5a',
                fontWeight: '800',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
              Buat Tagihan Baru
            </button>
            <Link
              to="/dashboard/pembayaran"
              className="btn btn-outline"
              style={{
                borderColor: 'rgba(255,255,255,0.4)',
                color: '#ffffff',
                fontWeight: '700'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
              Approval Pembayaran
            </Link>
          </div>
        )}
      </section>

      {/* Stats Cards */}
      <div className="tagihan-stats-grid">
        <div
          className={'tagihan-stat-card' + (filterStatus === 'semua' ? ' active' : '')}
          onClick={function () { setFilterStatus('semua'); }}
        >
          <div className="tagihan-stat-icon" style={{ background: 'rgba(0, 78, 90, 0.1)', color: '#004e5a' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>receipt_long</span>
          </div>
          <div>
            <div className="tagihan-stat-val" style={{ color: '#004e5a' }}>{stats.total_tagihan || 0}</div>
            <div className="tagihan-stat-lbl">Total Tagihan</div>
            <div className="tagihan-stat-sub">Semua Periode</div>
          </div>
        </div>

        <div
          className={'tagihan-stat-card' + (filterStatus === 'belum_bayar' ? ' active' : '')}
          onClick={function () { setFilterStatus(filterStatus === 'belum_bayar' ? 'semua' : 'belum_bayar'); }}
        >
          <div className="tagihan-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>pending_actions</span>
          </div>
          <div>
            <div className="tagihan-stat-val" style={{ color: '#dc2626' }}>{stats.total_unpaid || 0}</div>
            <div className="tagihan-stat-lbl">Belum Dibayar</div>
            <div className="tagihan-stat-sub">Rp {Number(stats.nominal_unpaid || 0).toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div
          className={'tagihan-stat-card' + (filterStatus === 'menunggu_verifikasi' ? ' active' : '')}
          onClick={function () { setFilterStatus(filterStatus === 'menunggu_verifikasi' ? 'semua' : 'menunggu_verifikasi'); }}
        >
          <div className="tagihan-stat-icon" style={{ background: 'rgba(2, 136, 209, 0.1)', color: '#0288d1' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>hourglass_top</span>
          </div>
          <div>
            <div className="tagihan-stat-val" style={{ color: '#0288d1' }}>{stats.total_pending || 0}</div>
            <div className="tagihan-stat-lbl">Menunggu Verifikasi</div>
            <div className="tagihan-stat-sub">Rp {Number(stats.nominal_pending || 0).toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div
          className={'tagihan-stat-card' + (filterStatus === 'lunas' ? ' active' : '')}
          onClick={function () { setFilterStatus(filterStatus === 'lunas' ? 'semua' : 'lunas'); }}
        >
          <div className="tagihan-stat-icon" style={{ background: 'rgba(15, 157, 91, 0.1)', color: '#0f9d58' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>verified</span>
          </div>
          <div>
            <div className="tagihan-stat-val" style={{ color: '#0f9d58' }}>{stats.total_paid || 0}</div>
            <div className="tagihan-stat-lbl">Tagihan Lunas</div>
            <div className="tagihan-stat-sub">Rp {Number(stats.nominal_paid || 0).toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="tagihan-table-card card animate-fadeIn" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary)' }}>receipt</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>Daftar Invoice & Tagihan ({tagihanList.length})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1', minWidth: '300px' }}>
            {/* Filter Status Dropdown */}
            <select
              value={filterStatus}
              onChange={function (e) { setFilterStatus(e.target.value); }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                fontSize: '0.85rem',
                outline: 'none',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="semua">Semua Status</option>
              <option value="belum_bayar">Belum Bayar</option>
              <option value="menunggu_verifikasi">Menunggu Verifikasi</option>
              <option value="lunas">Lunas</option>
              <option value="terlambat">Terlambat (Overdue)</option>
            </select>

            {/* Filter Periode */}
            <input
              type="month"
              value={periodeFilter}
              onChange={function (e) { setPeriodeFilter(e.target.value); }}
              placeholder="Periode (YYYY-MM)"
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                fontSize: '0.85rem',
                outline: 'none',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            />

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                search
              </span>
              <input
                type="text"
                placeholder="Cari nama, HP, PPPoE..."
                value={searchQuery}
                onChange={function (e) { setSearchQuery(e.target.value); }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px 0 34px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px' }}>
            {[1, 2, 3, 4, 5].map(function (i) {
              return (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="skeleton" style={{ width: '15%', height: '18px' }}></div>
                  <div className="skeleton" style={{ width: '25%', height: '18px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '18px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '18px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '18px' }}></div>
                  <div className="skeleton" style={{ width: '15%', height: '18px' }}></div>
                </div>
              );
            })}
          </div>
        ) : tagihanList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 78, 90, 0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--primary)' }}>receipt_long</span>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>Tidak Ada Tagihan</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              Tidak ditemukan data tagihan sesuai kriteria filter atau pencarian Anda.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>ID Invoice</th>
                  <th>Pelanggan</th>
                  <th>Paket</th>
                  <th>Periode</th>
                  <th>Nominal</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTagihan.map(function (item, idx) {
                  return (
                    <tr key={item.id_tagihan}>
                      <td style={{ color: 'var(--text-muted)' }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                          #INV-{item.id_tagihan}
                        </span>
                        {item.tanggal_terbit && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Terbit: {formatTanggal(item.tanggal_terbit)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.nama}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>call</span>
                          {item.no_hp || '-'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.paket || '-'}</span>
                        {item.pppoe_username && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            PPPoE: <code>{item.pppoe_username}</code>
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {item.periode}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          Rp {Number(item.nominal || item.jumlah || 0).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatTanggal(item.due_date)}</div>
                      </td>
                      <td>{renderStatusBadge(item)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          {/* Copy Link Bayar */}
                          {/* <button
                            type="button"
                            className="action-icon-btn"
                            title="Salin Link Pembayaran Pelanggan"
                            onClick={function () { handleCopyPaymentLink(item); }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: copiedId === item.id_tagihan ? '#0f9d58' : 'inherit' }}>
                              {copiedId === item.id_tagihan ? 'done' : 'link'}
                            </span>
                          </button> */}

                          {/* WhatsApp Reminder */}
                          {item.no_hp && item.status !== 'lunas' && (
                            <button
                              type="button"
                              className="action-icon-btn whatsapp"
                              title="Kirim Pengingat Tagihan via WhatsApp"
                              onClick={function () { handleSendWhatsApp(item); }}
                            >
                              <TemplateIcon name="whatsapp" size={16} />
                            </button>
                          )}

                          {/* Lihat Bukti Pembayaran */}
                          {(item.bukti_file || item.status === 'menunggu_verifikasi') && (
                            <button
                              type="button"
                              className="action-icon-btn"
                              title="Lihat Bukti Pembayaran Pelanggan"
                              onClick={function () { setViewBuktiItem(item); }}
                              style={{ color: '#006876' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                            </button>
                          )}

                          {/* Delete Tagihan (Super Admin only, and only if not lunas) */}
                          {isSuperAdmin && item.status !== 'lunas' && (
                            <button
                              type="button"
                              className="action-icon-btn delete"
                              title="Hapus Tagihan"
                              onClick={function () { setDeleteConfirm(item); }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          )}
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

      {/* Modal Buat Tagihan Baru */}
      <Modal
        isOpen={showModal}
        onClose={function () { setShowModal(false); }}
        title="Buat Tagihan Pelanggan Baru"
      >
        <form onSubmit={handleCreateTagihan}>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Pilih Pelanggan *</label>
            <select
              value={selectedPelanggan}
              onChange={handlePelangganChange}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                fontSize: '0.9rem',
                outline: 'none',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)'
              }}
            >
              <option value="">-- Pilih Pelanggan --</option>
              {pelangganList.map(function (p) {
                return (
                  <option key={p.id_pelanggan} value={p.id_pelanggan}>
                    {p.nama} ({p.paket || 'Tanpa Paket'} - {p.no_hp})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Periode Tagihan (Bulan) *</label>
            <input
              type="month"
              value={formPeriode}
              onChange={function (e) { setFormPeriode(e.target.value); }}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Jumlah Tagihan (Rp) *</label>
            <input
              type="number"
              value={formJumlah}
              onChange={function (e) { setFormJumlah(e.target.value); }}
              placeholder="Contoh: 150000"
              required
              min="1000"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>Batas Jatuh Tempo *</label>
            <input
              type="date"
              value={formDueDate}
              onChange={function (e) { setFormDueDate(e.target.value); }}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={function () { setShowModal(false); }}
              disabled={formSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Menyimpan...' : 'Terbitkan Tagihan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Tagihan */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={function () { setDeleteConfirm(null); }}
        title="Konfirmasi Hapus Tagihan"
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Apakah Anda yakin ingin menghapus tagihan <strong>#INV-{deleteConfirm?.id_tagihan}</strong> untuk pelanggan <strong>{deleteConfirm?.nama}</strong> senilai <strong>Rp {Number(deleteConfirm?.nominal || deleteConfirm?.jumlah || 0).toLocaleString('id-ID')}</strong>?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={function () { setDeleteConfirm(null); }}
              disabled={deleting}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteTagihan}
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Ya, Hapus Tagihan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Lihat Bukti Pembayaran */}
      {viewBuktiItem && (
        <Modal
          isOpen={viewBuktiItem !== null}
          onClose={function () { setViewBuktiItem(null); }}
          title={
            <>
              <TemplateIcon name="camera" size={16} style={{ marginRight: '8px' }} />
              Bukti Pembayaran - {viewBuktiItem.nama} ({viewBuktiItem.periode})
            </>
          }
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn btn-secondary btn-sm" onClick={function () { setViewBuktiItem(null); }}>
                Tutup
              </button>
              <Link to="/dashboard/notifikasi" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                Buka Menu Verifikasi Pembayaran
              </Link>
            </div>
          }
        >
          <div style={{ padding: '10px 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nominal Tagihan:</span>
              <strong style={{ color: 'var(--primary)' }}>Rp {Number(viewBuktiItem.nominal).toLocaleString('id-ID')}</strong>
            </div>
            {viewBuktiItem.bukti_file ? (
              viewBuktiItem.bukti_file.includes('Midtrans') || viewBuktiItem.bukti_file.includes('Duitku') ? (
                <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Pembayaran Otomatis Online</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{viewBuktiItem.bukti_file}</div>
                </div>
              ) : (
                <div style={{ maxHeight: '420px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#000' }}>
                  <img
                    src={`${API_BASE_URL}${viewBuktiItem.bukti_file}`}
                    alt="Bukti Transfer Pelanggan"
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    onError={function (e) {
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = '<div style="padding: 30px; color: #fff;">File gambar bukti tidak dapat dimuat atau belum tersedia.</div>';
                    }}
                  />
                </div>
              )
            ) : (
              <div style={{ padding: '30px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                Pelanggan belum mengunggah file bukti pembayaran.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TagihanPage;

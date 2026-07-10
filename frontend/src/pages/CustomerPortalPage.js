import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function CustomerPortalPage({ onLogout }) {
  var [billing, setBilling] = useState(null);
  var [lastPayment, setLastPayment] = useState(null);
  var [loading, setLoading] = useState(true);
  var [file, setFile] = useState(null);
  var [preview, setPreview] = useState('');
  var [uploading, setUploading] = useState(false);
  var [message, setMessage] = useState({ type: '', text: '' });
  var [paymentMethod, setPaymentMethod] = useState('midtrans');
  var [midtransClientKey, setMidtransClientKey] = useState('');
  var [midtransLoading, setMidtransLoading] = useState(false);
  var [dropdownOpen, setDropdownOpen] = useState(false);
  var dropdownRef = useRef(null);

  var token = localStorage.getItem('customer_token');
  var headers = { Authorization: 'Bearer ' + token };

  // Payment method options with logos
  var paymentOptions = [
    { value: 'midtrans', label: 'Bayar Online Instan (QRIS, E-Wallet, VA Bank Transfer)', sublabel: 'Otomatis', icon: 'payments', logo: null },
    { value: 'qris', label: 'Manual: QRIS', sublabel: 'Scan & Transfer', icon: 'qr_code_2', logo: null },
    { value: 'bri', label: 'Manual: Bank BRI', sublabel: 'Transfer Bank', icon: null, logo: process.env.PUBLIC_URL + '/BRI.jpg' },
    { value: 'mandiri', label: 'Manual: Bank Mandiri', sublabel: 'Transfer Bank', icon: null, logo: process.env.PUBLIC_URL + '/MANDIRI.png' },
    { value: 'bca', label: 'Manual: Bank BCA', sublabel: 'Transfer Bank', icon: null, logo: process.env.PUBLIC_URL + '/BCA.png' }
  ];

  // Close dropdown when clicking outside
  useEffect(function () {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return function () {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(function () {
    fetchBilling();
    fetchMidtransConfig();
  }, []);

  async function fetchMidtransConfig() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/customer/portal/midtrans-config`, { headers: headers });
      if (response.data.success) {
        var clientKey = response.data.clientKey;
        setMidtransClientKey(clientKey);
        var isSandbox = response.data.isSandbox;
        var snapScriptUrl = isSandbox
          ? 'https://app.sandbox.midtrans.com/snap/snap.js'
          : 'https://app.midtrans.com/snap/snap.js';
        var existingScript = document.getElementById('midtrans-snap-js');
        if (!existingScript) {
          var script = document.createElement('script');
          script.src = snapScriptUrl;
          script.id = 'midtrans-snap-js';
          script.setAttribute('data-client-key', clientKey);
          script.async = true;
          document.body.appendChild(script);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil konfigurasi Midtrans:', err);
    }
  }

  async function fetchBilling() {
    try {
      var response = await axios.get(`${API_BASE_URL}/api/customer/portal/billing`, { headers: headers });
      if (response.data.success) {
        setBilling(response.data.data);
        setLastPayment(response.data.lastPayment);
      }
    } catch (err) {
      console.error('Gagal mengambil data tagihan:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e) {
    var selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setMessage({ type: 'error', text: 'Silakan pilih file gambar bukti transfer terlebih dahulu.' });
      return;
    }
    setUploading(true);
    setMessage({ type: '', text: '' });
    var formData = new FormData();
    formData.append('id_tagihan', billing.id_tagihan);
    formData.append('bukti', file);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/portal/pay`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setFile(null);
        setPreview('');
        fetchBilling();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Gagal mengunggah bukti pembayaran.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleMidtransPay() {
    if (!billing || !billing.id_tagihan) return;
    setMidtransLoading(true);
    setMessage({ type: '', text: '' });
    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/portal/midtrans-token`, {
        id_tagihan: billing.id_tagihan
      }, { headers: headers });
      if (response.data.success) {
        var snapToken = response.data.token;
        if (window.snap) {
          window.snap.pay(snapToken, {
            onSuccess: function (result) {
              setMessage({ type: 'success', text: 'Pembayaran sukses! Layanan internet Anda sedang diaktifkan.' });
              fetchBilling();
            },
            onPending: function (result) {
              setMessage({ type: 'info', text: 'Pembayaran Anda sedang diproses. Silakan selesaikan pembayaran Anda.' });
              fetchBilling();
            },
            onError: function (result) {
              setMessage({ type: 'error', text: 'Pembayaran gagal. Silakan coba kembali atau gunakan metode lain.' });
            },
            onClose: function () {
              console.log('Customer closed payment popup without finishing.');
            }
          });
        } else {
          window.location.href = response.data.redirect_url;
        }
      }
    } catch (err) {
      console.error('Midtrans payment error:', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Gagal memulai pembayaran online.' });
    } finally {
      setMidtransLoading(false);
    }
  }

  function getSelectedOption() {
    return paymentOptions.find(function (opt) { return opt.value === paymentMethod; });
  }

  function handleSelectOption(value) {
    setPaymentMethod(value);
    setDropdownOpen(false);
  }

  // Styles
  var S = {
    page: { background: 'var(--md-background)', minHeight: '100vh', fontFamily: "'Hanken Grotesk', sans-serif" },
    nav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(248,249,250,0.8)', backdropFilter: 'blur(12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    navInner: { maxWidth: 640, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    content: { maxWidth: 640, margin: '0 auto', padding: '88px 20px 40px' },
    card: { background: 'var(--md-surface-container-lowest)', border: '1px solid rgba(188,201,204,0.3)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: '0px 4px 20px rgba(0,75,122,0.08)', marginBottom: 20 },
    label: { fontSize: '0.82rem', color: 'var(--md-on-surface-variant)', fontWeight: 600, textTransform: 'uppercase' },
    h3: { fontSize: '1rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
    btnPrimary: { width: '100%', background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'Hanken Grotesk', sans-serif" },
    infoBox: { background: 'var(--md-surface-container-low)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--md-outline-variant)', marginTop: 12, textAlign: 'center' },
    select: { width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--md-surface-container-low)', color: 'var(--md-on-surface)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'auto', fontFamily: "'Hanken Grotesk', sans-serif" }
  };

  // Custom dropdown styles
  var dropdownStyles = {
    container: { position: 'relative', marginBottom: 16 },
    trigger: {
      width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)',
      border: dropdownOpen ? '2px solid var(--md-primary)' : '2px solid transparent',
      background: 'var(--md-surface-container-low)', color: 'var(--md-on-surface)',
      fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none',
      fontFamily: "'Hanken Grotesk', sans-serif",
      display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
      transition: 'border-color 0.2s ease'
    },
    triggerLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
    menu: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
      background: 'var(--md-surface-container-lowest)',
      border: '1px solid var(--md-outline-variant)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 30px rgba(0,75,122,0.15)',
      zIndex: 20, overflow: 'hidden',
      animation: 'slideDown 0.2s ease-out'
    },
    option: function (isSelected) {
      return {
        padding: '12px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        background: isSelected ? 'var(--md-primary-fixed)' : 'transparent',
        borderBottom: '1px solid rgba(188,201,204,0.2)',
        transition: 'background 0.15s ease',
        fontSize: '0.88rem', fontWeight: isSelected ? 700 : 500,
        color: isSelected ? 'var(--md-primary)' : 'var(--md-on-surface)'
      };
    },
    optionLogo: {
      width: 28, height: 28, objectFit: 'contain', borderRadius: 4,
      background: 'none', padding: 0, border: 'none',
      flexShrink: 0
    },
    optionIcon: {
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--md-primary-fixed)', borderRadius: 4, flexShrink: 0,
      color: 'var(--md-primary)'
    },
    optionText: { flex: 1 },
    optionLabel: { fontSize: '0.88rem', fontWeight: 600 },
    optionSublabel: { fontSize: '0.72rem', color: 'var(--md-on-surface-variant)', fontWeight: 400 },
    selectedCheck: { color: 'var(--md-primary)', flexShrink: 0, fontSize: 18 }
  };

  function renderOptionIcon(opt) {
    if (opt.logo) {
      return <img src={opt.logo} alt={opt.label} style={dropdownStyles.optionLogo} />;
    }
    if (opt.icon) {
      return (
        <div style={dropdownStyles.optionIcon}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{opt.icon}</span>
        </div>
      );
    }
    return null;
  }

  function renderPaymentDetail() {
    switch (paymentMethod) {
      case 'midtrans':
        return (
          <div style={S.infoBox}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--md-primary)' }}>
              Pembayaran Online Otomatis (Midtrans)
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.4, marginBottom: 16 }}>
              Bayar menggunakan QRIS, GoPay, ShopeePay, Mandiri Billpayment, BCA/BRI Virtual Account, atau Kartu Kredit. Pembayaran akan terverifikasi secara instan.
            </p>
            <button type="button" style={{ ...S.btnPrimary, opacity: midtransLoading ? 0.7 : 1 }} onClick={handleMidtransPay} disabled={midtransLoading}>
              {midtransLoading ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Menghubungkan...</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span> Bayar Sekarang</>
              )}
            </button>
          </div>
        );
      case 'qris':
        return (
          <div style={{ ...S.infoBox, textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12 }}>Scan Kode QRIS di bawah:</div>
            <div style={{ display: 'inline-block', padding: 10, background: 'white', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
              <img src={`${API_BASE_URL}/images/qris.png`} alt="QRIS" style={{ width: 180, height: 180, display: 'block', objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--md-outline)' }}>Support semua bank & e-wallet</div>
          </div>
        );
      case 'bri':
        return (
          <div style={S.infoBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              <img src={process.env.PUBLIC_URL + '/logo_bri.png'} alt="Bank BRI" style={{ height: 32, objectFit: 'contain' }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--md-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Transfer Bank BRI</div>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0', color: 'var(--md-primary)' }}>0346-01-001962-50-8</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface-variant)' }}>a/n ESP Lintas Data Multimedia</div>
          </div>
        );
      case 'mandiri':
        return (
          <div style={S.infoBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              <img src={process.env.PUBLIC_URL + '/logo_mandiri.png'} alt="Bank Mandiri" style={{ height: 32, objectFit: 'contain' }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--md-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Transfer Bank Mandiri</div>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0', color: 'var(--md-primary)' }}>131-00-1572912-3</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface-variant)' }}>a/n ESP Lintas Data Multimedia</div>
          </div>
        );
      case 'bca':
        return (
          <div style={S.infoBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              <img src={process.env.PUBLIC_URL + '/logo_bca.png'} alt="Bank BCA" style={{ height: 32, objectFit: 'contain' }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--md-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Transfer Bank BCA</div>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0', color: 'var(--md-primary)' }}>869-0577-888</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface-variant)' }}>a/n ESP Lintas Data Multimedia</div>
          </div>
        );
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--md-background)', color: 'var(--md-on-surface)', fontFamily: "'Hanken Grotesk', sans-serif" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, marginRight: 8, animation: 'pulse 1s infinite' }}>hourglass_top</span> Memuat tagihan Anda...
      </div>
    );
  }

  var selectedOpt = getSelectedOption();

  return (
    <div style={S.page}>
      {/* Navbar — fixed, blur, shadow */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--md-on-surface)' }}>Portal Pelanggan</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>ESP Lintas Data Multimedia</p>
          </div>
          <button onClick={onLogout} style={{
            background: 'var(--md-surface-container)', color: 'var(--md-on-surface)', border: '1px solid var(--md-outline-variant)',
            borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Hanken Grotesk', sans-serif"
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span> Keluar
          </button>
        </div>
      </nav>

      <div style={S.content}>
        {/* Messages */}
        {message.text && (
          <div style={{
            background: message.type === 'success' ? 'var(--status-hijau-bg)' : 'var(--status-merah-bg)',
            color: message.type === 'success' ? 'var(--status-hijau)' : 'var(--status-merah)',
            padding: '14px 16px', borderRadius: 'var(--radius-md)', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
            {message.text}
          </div>
        )}

        {/* Rejected Payment Alert */}
        {lastPayment && lastPayment.status === 'ditolak' && (
          <div style={{
            background: 'var(--status-merah-bg)', color: 'var(--status-merah)',
            padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
            <div>
              <strong>Pembayaran Ditolak Admin!</strong> Bukti pembayaran periode <strong>{lastPayment.periode}</strong> ditolak. <br />Alasan: <em>"{lastPayment.alasan_tolak}"</em>. Silakan upload ulang bukti pembayaran yang valid.
            </div>
          </div>
        )}

        {/* Content */}
        {!billing ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '48px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--md-primary)', marginBottom: 16, display: 'block' }}>check_circle</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Semua Tagihan Lunas</h3>
            <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.88rem' }}>Terima kasih atas pembayaran Anda. Layanan internet Anda aktif.</p>
          </div>
        ) : (
          <>
            {/* Billing Card */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={S.label}>Tagihan Periode {billing.periode}</span>
                <span className={`status-badge ${billing.status_tagihan}`}>
                  {billing.status === 'menunggu_verifikasi' ? 'Verifikasi Pending' : (billing.status_tagihan === 'kuning' ? 'Jatuh Tempo' : (billing.status_tagihan === 'merah' ? 'Menunggak' : 'Belum Bayar'))}
                </span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0', color: 'var(--md-primary)' }}>
                Rp {Number(billing.nominal).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--md-on-surface-variant)' }}>
                Batas Jatuh Tempo: <strong>{new Date(billing.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
            </div>

            {/* Payment Method */}
            {billing.status !== 'menunggu_verifikasi' && (
              <div style={S.card}>
                <h3 style={S.h3}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>payments</span> Metode Pembayaran
                </h3>

                {/* Custom Dropdown */}
                <div style={dropdownStyles.container} ref={dropdownRef}>
                  <button
                    type="button"
                    style={dropdownStyles.trigger}
                    onClick={function () { setDropdownOpen(!dropdownOpen); }}
                  >
                    <div style={dropdownStyles.triggerLeft}>
                      {selectedOpt && renderOptionIcon(selectedOpt)}
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>{selectedOpt ? selectedOpt.label : ''}</div>
                        {selectedOpt && selectedOpt.sublabel && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--md-on-surface-variant)', fontWeight: 400 }}>{selectedOpt.sublabel}</div>
                        )}
                      </div>
                    </div>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 20, color: 'var(--md-on-surface-variant)',
                      transition: 'transform 0.2s ease',
                      transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)'
                    }}>expand_more</span>
                  </button>

                  {dropdownOpen && (
                    <div style={dropdownStyles.menu}>
                      {paymentOptions.map(function (opt) {
                        var isSelected = opt.value === paymentMethod;
                        return (
                          <div
                            key={opt.value}
                            style={dropdownStyles.option(isSelected)}
                            onClick={function () { handleSelectOption(opt.value); }}
                            onMouseEnter={function (e) {
                              if (!isSelected) e.currentTarget.style.background = 'var(--md-surface-container-low)';
                            }}
                            onMouseLeave={function (e) {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {renderOptionIcon(opt)}
                            <div style={dropdownStyles.optionText}>
                              <div style={dropdownStyles.optionLabel}>{opt.label}</div>
                              {opt.sublabel && (
                                <div style={dropdownStyles.optionSublabel}>{opt.sublabel}</div>
                              )}
                            </div>
                            {isSelected && (
                              <span className="material-symbols-outlined" style={dropdownStyles.selectedCheck}>check_circle</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {renderPaymentDetail()}
              </div>
            )}

            {/* Upload Proof */}
            {paymentMethod !== 'midtrans' && (
              <div style={S.card}>
                <h3 style={S.h3}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {billing.status === 'menunggu_verifikasi' ? 'description' : 'upload_file'}
                  </span>
                  {billing.status === 'menunggu_verifikasi' ? 'Bukti Transfer Anda' : 'Upload Bukti Transfer'}
                </h3>

                {billing.status === 'menunggu_verifikasi' ? (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 42, color: 'var(--md-primary)', marginBottom: 12, display: 'block', animation: 'pulse 1.5s infinite' }}>hourglass_top</span>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--md-on-surface)' }}>Pembayaran Sedang Diverifikasi Admin</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--md-on-surface-variant)', marginTop: 4 }}>
                      Admin sedang mencocokkan nominal transfer Anda. Internet Anda akan otomatis aktif setelah verifikasi disetujui.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleUpload}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{
                        display: 'block', padding: 20, background: 'var(--md-surface-container-low)',
                        border: '2px dashed var(--md-outline-variant)', borderRadius: 'var(--radius-md)',
                        textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 4, color: 'var(--md-primary)' }}>add_a_photo</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--md-primary)' }}>
                          {file ? 'Ganti File Gambar' : 'Pilih Foto / Screenshot Bukti'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} required />
                      </label>
                    </div>

                    {preview && (
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--md-outline)', marginBottom: 6 }}>Preview Bukti:</div>
                        <img src={preview} alt="Preview Bukti Transfer" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-md)', border: '1px solid var(--md-outline-variant)' }} />
                      </div>
                    )}

                    <button type="submit" style={{ ...S.btnPrimary, opacity: (uploading || !file) ? 0.5 : 1 }} disabled={uploading || !file}>
                      {uploading ? (
                        <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Mengunggah...</>
                      ) : (
                        <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span> Kirim Konfirmasi Pembayaran</>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CustomerPortalPage;

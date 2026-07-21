import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function CustomerPortalPage({ onLogout }) {
  var location = useLocation();
  var initialTab = (location.state && location.state.activeTab) || 'billing';
  var [activeTab, setActiveTab] = useState(initialTab); // 'billing', 'history', 'profile'
  var [isSidebarOpen, setIsSidebarOpen] = useState(false);
  var [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  var [billing, setBilling] = useState(null);
  var [lastPayment, setLastPayment] = useState(null);
  var [profileData, setProfileData] = useState(null);
  var [paymentHistory, setPaymentHistory] = useState([]);
  var [loading, setLoading] = useState(true);
  var [loadingProfile, setLoadingProfile] = useState(false);
  var [loadingHistory, setLoadingHistory] = useState(false);
  var [file, setFile] = useState(null);
  var [preview, setPreview] = useState('');
  var [uploading, setUploading] = useState(false);
  var [message, setMessage] = useState({ type: '', text: '' });
  var [paymentMethod, setPaymentMethod] = useState('midtrans');
  var [midtransClientKey, setMidtransClientKey] = useState('');
  var [midtransLoading, setMidtransLoading] = useState(false);
  var [dropdownOpen, setDropdownOpen] = useState(false);
  var [profileOpen, setProfileOpen] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile() {
    setLoadingProfile(true);
    try {
      var response = await axios.get(`${API_BASE_URL}/api/customer/portal/profile`, { headers: headers });
      if (response.data.success) {
        setProfileData(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data profil:', err);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      var response = await axios.get(`${API_BASE_URL}/api/customer/portal/payments`, { headers: headers });
      if (response.data.success) {
        setPaymentHistory(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat pembayaran:', err);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(function () {
    if (activeTab === 'profile') {
      fetchProfile();
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'billing') {
      fetchBilling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  // Styles (only basic inline overrides, most styles moved to injected CSS classes)
  var S = {
    btnPrimary: { width: '100%', background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'Open Sans', sans-serif" },
    infoBox: { background: 'var(--md-surface-container-low)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--md-outline-variant)', marginTop: 12, textAlign: 'center' }
  };

  // Custom dropdown styles
  var dropdownStyles = {
    container: { position: 'relative', marginBottom: 16 },
    trigger: {
      width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)',
      border: dropdownOpen ? '2px solid var(--md-primary)' : '2px solid transparent',
      background: 'var(--md-surface-container-low)', color: 'var(--md-on-surface)',
      fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none',
      fontFamily: "'Open Sans', sans-serif",
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
      width: 28, height: 28, objectFit: 'contain', borderRadius: 5,
      background: 'none', padding: 0, border: 'none',
      flexShrink: 0
    },
    optionIcon: {
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--md-primary-fixed)', borderRadius: 5, flexShrink: 0,
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

  var savedInfo = localStorage.getItem('customer_info');
  var customer = savedInfo ? JSON.parse(savedInfo) : null;

  function getInitials(name) {
    if (!name) return 'C';
    return name.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  if (loading && activeTab === 'billing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--md-background)', color: 'var(--md-on-surface)', fontFamily: "'Open Sans', sans-serif" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, marginRight: 8, animation: 'pulse 1s infinite' }}>hourglass_top</span> Memuat portal Anda...
      </div>
    );
  }

  var selectedOpt = getSelectedOption();

  function renderTabContent() {
    if (activeTab === 'billing') {
      if (loading) {
        return (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--md-on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, animation: 'pulse 1s' + ' infinite', display: 'block', marginBottom: 12 }}>hourglass_top</span>
            Memuat data tagihan...
          </div>
        );
      }

      if (!billing) {
        return (
          <div className="portal-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--status-hijau)', marginBottom: 16, display: 'block' }}>check_circle</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: 'var(--status-hijau)' }}>Semua Tagihan Lunas</h3>
            <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.88rem' }}>Terima kasih atas pembayaran Anda. Layanan internet Anda aktif.</p>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Billing Card */}
          <div className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tagihan Periode {billing.periode}</span>
              <span className={`status-badge ${billing.status === 'menunggu_verifikasi' ? 'abu' : (billing.status_tagihan === 'kuning' ? 'kuning' : (billing.status_tagihan === 'merah' ? 'merah' : 'hijau'))}`}>
                {billing.status === 'menunggu_verifikasi' ? 'Verifikasi Pending' : (billing.status_tagihan === 'kuning' ? 'Jatuh Tempo' : (billing.status_tagihan === 'merah' ? 'Menunggak' : 'Belum Bayar'))}
              </span>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '8px 0', color: 'var(--md-primary)', letterSpacing: '-1px' }}>
              Rp {Number(billing.nominal).toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--md-on-surface-variant)', marginTop: 12 }}>
              Batas Jatuh Tempo: <strong style={{ color: 'var(--md-on-surface)' }}>{new Date(billing.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
          </div>

          {/* Payment Method */}
          {billing.status !== 'menunggu_verifikasi' && (
            <div className="portal-card">
              <div className="portal-card-header">
                <span className="portal-card-title">
                  <span className="material-symbols-outlined">payments</span> Metode Pembayaran
                </span>
              </div>

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
            <div className="portal-card">
              <div className="portal-card-header">
                <span className="portal-card-title">
                  <span className="material-symbols-outlined">
                    {billing.status === 'menunggu_verifikasi' ? 'description' : 'upload_file'}
                  </span>
                  {billing.status === 'menunggu_verifikasi' ? 'Bukti Transfer Anda' : 'Upload Bukti Transfer'}
                </span>
              </div>

              {billing.status === 'menunggu_verifikasi' ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-primary)', marginBottom: 12, display: 'block', animation: 'pulse 1.5s' + ' infinite' }}>hourglass_top</span>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--md-on-surface)' }}>Pembayaran Sedang Diverifikasi Admin</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)', marginTop: 6, lineHeight: 1.5 }}>
                    Admin sedang memverifikasi bukti pembayaran Anda. Layanan internet WiFi Anda akan otomatis diperpanjang setelah disetujui.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUpload}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{
                      display: 'block', padding: '24px 20px', background: 'var(--md-surface-container-low)',
                      border: '2px dashed var(--md-outline-variant)', borderRadius: 'var(--radius-md)',
                      textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, color: 'var(--md-primary)' }}>add_a_photo</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--md-primary)' }}>
                        {file ? 'Ganti File Gambar Bukti' : 'Pilih Foto / Screenshot Bukti Transfer'}
                      </span>
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} required />
                    </label>
                  </div>

                  {preview && (
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--md-outline)', marginBottom: 8, fontWeight: 600 }}>Preview Bukti Transfer:</div>
                      <img src={preview} alt="Preview Bukti Transfer" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 'var(--radius-md)', border: '1px solid var(--md-outline-variant)' }} />
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
        </div>
      );
    }

    if (activeTab === 'history') {
      if (loadingHistory) {
        return (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--md-on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, animation: 'pulse 1s' + ' infinite', display: 'block', marginBottom: 12 }}>hourglass_top</span>
            Memuat riwayat pembayaran...
          </div>
        );
      }

      if (paymentHistory.length === 0) {
        return (
          <div className="portal-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--md-outline)', marginBottom: 16, display: 'block' }}>history</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Belum Ada Riwayat</h3>
            <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.88rem' }}>Anda belum memiliki catatan riwayat transaksi pembayaran.</p>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {paymentHistory.map(function (pay) {
            var isOnline = pay.bukti_file.startsWith('Midtrans');
            var paymentUrl = isOnline ? '#' : `${API_BASE_URL}${pay.bukti_file}`;
            var badgeClass = pay.status === 'diterima' ? 'hijau' : (pay.status === 'ditolak' ? 'merah' : 'kuning');
            var statusText = pay.status === 'diterima' ? 'Lunas / Disetujui' : (pay.status === 'ditolak' ? 'Ditolak' : 'Menunggu Verifikasi');

            return (
              <div key={pay.id_pembayaran} className="portal-card" style={{ padding: 24, marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Periode Tagihan {pay.periode}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-primary)', margin: '6px 0', letterSpacing: '-0.5px' }}>
                      Rp {Number(pay.nominal).toLocaleString('id-ID')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--md-outline)' }}>
                      Diupload: {new Date(pay.tanggal_upload).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className={`status-badge ${badgeClass}`}>{statusText}</span>
                </div>

                {pay.status === 'ditolak' && pay.alasan_tolak && (
                  <div style={{ marginTop: 14, padding: 14, background: 'var(--status-merah-bg)', color: 'var(--status-merah)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    <strong>Catatan Penolakan:</strong> "{pay.alasan_tolak}"
                  </div>
                )}

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--md-outline-variant)', paddingTop: 16 }}>
                  {isOnline ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--status-hijau)', fontWeight: 700 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span> Pembayaran Online Instan (Midtrans)
                    </div>
                  ) : (
                    <a href={paymentUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700,
                      color: 'var(--md-primary)', textDecoration: 'none', padding: '8px 16px', background: 'var(--md-primary-fixed)',
                      borderRadius: 'var(--radius-md)', transition: 'all 0.2s ease'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span> Lihat Bukti Transfer
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'profile') {
      if (loadingProfile) {
        return (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--md-on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, animation: 'pulse 1s' + ' infinite', display: 'block', marginBottom: 12 }}>hourglass_top</span>
            Memuat profil pelanggan...
          </div>
        );
      }

      if (!profileData) {
        return (
          <div className="portal-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--md-outline)', marginBottom: 16, display: 'block' }}>person</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Gagal Memuat Profil</h3>
            <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.88rem' }}>Data profil Anda tidak dapat diambil saat ini.</p>
          </div>
        );
      }

      var pppoeStatusBadge = profileData.pppoe_status === 'active' ? 'hijau' : (profileData.pppoe_status === 'inactive' ? 'merah' : 'abu');
      var pppoeStatusText = profileData.pppoe_status === 'active' ? 'Koneksi Aktif' : (profileData.pppoe_status === 'inactive' ? 'Koneksi Nonaktif' : 'Status Unknown');

      return (
        <div className="profile-grid">
          {/* Account Info */}
          <div className="portal-card" style={{ marginBottom: 0 }}>
            <div className="portal-card-header">
              <span className="portal-card-title">
                <span className="material-symbols-outlined">person</span> Informasi Akun
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="portal-info-row">
                <span className="portal-info-label">Nama Lengkap</span>
                <span className="portal-info-value" style={{ fontSize: '1rem', fontWeight: 700 }}>{profileData.nama}</span>
              </div>

              <div className="portal-info-row">
                <span className="portal-info-label">Email Terdaftar</span>
                <span className="portal-info-value">{profileData.email || '-'}</span>
              </div>

              <div className="portal-info-row">
                <span className="portal-info-label">Nomor WhatsApp / HP</span>
                <span className="portal-info-value">{profileData.no_hp}</span>
              </div>

              <div className="portal-info-row">
                <span className="portal-info-label">Alamat Pemasangan WiFi</span>
                <span className="portal-info-value" style={{ lineHeight: 1.5, fontWeight: 500 }}>{profileData.alamat}</span>
              </div>
            </div>
          </div>

          {/* Wifi Service Subscription Info */}
          <div className="portal-card" style={{ marginBottom: 0 }}>
            <div className="portal-card-header">
              <span className="portal-card-title">
                <span className="material-symbols-outlined">wifi</span> Berlangganan WiFi
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="portal-info-row">
                  <span className="portal-info-label">Paket Internet</span>
                  <span className="portal-info-value highlight" style={{ fontSize: '1.15rem' }}>{profileData.paket || 'Belum Berlangganan'}</span>
                </div>
                <div className="portal-info-row" style={{ textAlign: 'right' }}>
                  <span className="portal-info-label">Kecepatan</span>
                  <span className="portal-info-value" style={{ fontSize: '1.1rem', fontWeight: 800 }}>{profileData.kecepatan || '-'}</span>
                </div>
              </div>

              <div className="portal-info-row">
                <span className="portal-info-label">Harga Bulanan</span>
                <span className="portal-info-value">
                  Rp {profileData.harga ? Number(profileData.harga).toLocaleString('id-ID') : '-'} /bulan (Unlimited)
                </span>
              </div>

              <div className="portal-info-row">
                <span className="portal-info-label">Jatuh Tempo Berikutnya</span>
                <span className="portal-info-value" style={{ color: 'var(--md-primary)', fontWeight: 700 }}>
                  {profileData.due_date ? new Date(profileData.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </span>
              </div>

              <div className="portal-info-row">
                <span className="portal-info-label">Status Router PPPoE</span>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, gap: 10 }}>
                  <span className={`status-badge ${pppoeStatusBadge}`}>{pppoeStatusText}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--md-outline)', fontFamily: 'monospace' }}>({profileData.pppoe_username || '-'})</span>
                </div>
              </div>

              {profileData.deskripsi && (
                <div style={{ marginTop: 4, borderTop: '1px solid var(--md-outline-variant)', paddingTop: 14 }}>
                  <span className="portal-info-label" style={{ display: 'block', marginBottom: 8 }}>Fasilitas Paket</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {profileData.deskripsi.split(',').map(function (f, i) {
                      var text = f.trim();
                      if (!text) return null;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)' }}>check_circle</span> {text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  var activeTabTitle = activeTab === 'billing' ? 'Tagihan Saya' : (activeTab === 'history' ? 'Riwayat Pembayaran' : 'Profil & WiFi');

  return (
    <div className="portal-layout">
      {/* Dynamic styles injection */}
      <style>{`
        .portal-layout { display: flex; min-height: 100vh; background-color: #f1f5f9; font-family: 'Open Sans', sans-serif; width: 100%; }
        .portal-sidebar { width: 260px; background: #ffffff; border-right: 1px solid var(--border-color, #e2e8f0); position: fixed; top: 0; bottom: 0; left: 0; z-index: 1000; display: flex; flex-direction: column; transition: transform 0.3s ease; overflow: hidden; }
        .portal-sidebar-brand { min-height: 70px; border-bottom: 1px solid var(--border-color, #e2e8f0); display: flex; align-items: center; justify-content: flex-start; padding: 0 24px; background: #ffffff; }
        .portal-sidebar-logo { width: 135px; height: auto; max-height: 42px; object-fit: contain; }
        .portal-sidebar-profile { padding: 20px 24px 10px 24px; border-bottom: 1px solid var(--border-color, #e2e8f0); }
        .portal-sidebar-profile-trigger { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 10px 12px; border-radius: 8px; transition: background 0.2s ease; background: transparent; border: none; width: 100%; text-align: left; font-family: 'Open Sans', sans-serif; }
        .portal-sidebar-profile-trigger:hover { background: var(--bg-primary, #f8fafc); }
        .portal-sidebar-profile-trigger.open { background: var(--bg-secondary, #f1f5f9); }
        .portal-user-avatar { width: 42px; height: 42px; background: linear-gradient(135deg, var(--primary, #006876) 0%, var(--primary-light, #0891b2) 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; flex-shrink: 0; }
        .portal-user-info { flex: 1; min-width: 0; }
        .portal-user-name { font-size: 0.88rem; font-weight: 700; color: var(--text-primary, #1e293b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .portal-user-role { font-size: 0.72rem; color: var(--text-muted, #94a3b8); font-weight: 600; }
        .portal-profile-dropdown { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; background: var(--bg-primary, #f8fafc); border-radius: 8px; padding: 6px; border: 1px solid var(--border-color, #e2e8f0); animation: portalFadeIn 0.2s ease-out; }
        .portal-profile-dropdown-item { padding: 8px 12px; font-size: 0.8rem; color: var(--text-secondary, #64748b); font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; border-radius: 6px; transition: background 0.15s ease; border: none; background: transparent; width: 100%; text-align: left; font-family: 'Open Sans', sans-serif; }
        .portal-profile-dropdown-item:hover { background: var(--bg-tertiary, #e2e8f0); }
        .portal-profile-dropdown-item.danger { color: var(--status-merah, #ef4444); }
        .portal-profile-dropdown-item.danger:hover { background: var(--status-merah-bg, rgba(239,68,68,0.1)); }
        .portal-sidebar-nav { flex: 1; padding: 20px 14px; overflow-y: auto; }
        .portal-sidebar-section { margin-bottom: 22px; }
        .portal-sidebar-section-title { font-size: 0.68rem; font-weight: 700; color: var(--text-muted, #94a3b8); text-transform: uppercase; letter-spacing: 1.5px; padding: 0 12px; margin-bottom: 10px; }
        .portal-nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; color: var(--text-secondary, #64748b); font-size: 0.88rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.25s ease; border: none; background: transparent; text-align: left; width: 100%; font-family: 'Open Sans', sans-serif; margin-bottom: 4px; text-decoration: none; position: relative; }
        .portal-nav-item:hover { background: var(--bg-secondary, #f1f5f9); color: var(--text-primary, #1e293b); }
        .portal-nav-item.active { background: var(--primary-glow, rgba(0,104,118,0.08)); color: var(--primary, #006876); font-weight: 700; }
        .portal-nav-item .material-symbols-outlined { font-size: 1.3rem; }
        .portal-nav-item.active .material-symbols-outlined { color: var(--primary, #006876); }
        .portal-nav-item:not(.active) .material-symbols-outlined { color: var(--text-muted, #94a3b8); }
        .portal-main { flex: 1; margin-left: 260px; display: flex; flex-direction: column; min-height: 100vh; transition: margin-left 0.3s ease; }
        .portal-main.collapsed { margin-left: 72px; }
        .portal-sidebar.collapsed { width: 72px; }
        .portal-sidebar.collapsed .portal-sidebar-brand { justify-content: center; padding: 0; }
        .portal-sidebar.collapsed .portal-sidebar-logo { display: none; }
        .portal-sidebar.collapsed .portal-sidebar-profile { display: none; }
        .portal-sidebar.collapsed .portal-sidebar-section-title { display: none; }
        .portal-sidebar.collapsed .portal-nav-item { justify-content: center; padding: 10px 0; }
        .portal-sidebar.collapsed .portal-nav-item .nav-text { display: none; }
        .portal-sidebar.collapsed .portal-nav-item .material-symbols-outlined { margin: 0; }
        .portal-topbar { height: 70px; background: #004e5a; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; padding: 0 32px; position: sticky; top: 0; z-index: 90; }
        .portal-topbar-left { display: flex; align-items: center; gap: 16px; }
        .portal-menu-toggle { display: inline-flex; background: none; border: none; color: #ffffff; cursor: pointer; padding: 8px; border-radius: 50%; align-items: center; justify-content: center; }
        .portal-menu-toggle:hover { background: rgba(255, 255, 255, 0.1); }
        .portal-page-title { font-size: 1.15rem; font-weight: 800; color: #ffffff; }
        .portal-hero-atlantis { background: var(--primary-dark, #004e5a); padding: 40px 48px 90px 48px; color: white; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; box-shadow: 0px 4px 20px rgba(0,75,122,0.08); border-radius: 0; }
        .portal-hero-atlantis h2 { font-size: 2.1rem; font-weight: 800; color: #ffffff; margin-bottom: 6px; letter-spacing: -0.02em; }
        .portal-hero-atlantis p { color: rgba(255, 255, 255, 0.82); max-width: 600px; line-height: 1.5; font-size: 0.95rem; }
        .portal-content-area { padding: 32px 48px; max-width: 1100px; width: 100%; margin: -60px auto 0; flex: 1; position: relative; z-index: 10; }
        .portal-sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 990; }
        .portal-card { background: #ffffff; border: 1px solid rgba(188,201,204,0.3); border-radius: var(--radius-lg); padding: 24px; box-shadow: 0px 4px 20px rgba(0,75,122,0.06); margin-bottom: 24px; }
        .portal-card-header { border-bottom: 1px solid var(--md-outline-variant); padding-bottom: 12px; margin-bottom: 18px; }
        .portal-card-title { font-size: 1rem; font-weight: 800; color: var(--md-on-surface); display: flex; align-items: center; gap: 8px; }
        .portal-info-row { display: flex; flex-direction: column; gap: 4px; }
        .portal-info-label { font-size: 0.72rem; color: var(--md-on-surface-variant); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .portal-info-value { font-size: 0.9rem; color: var(--md-on-surface); font-weight: 600; }
        .portal-info-value.highlight { color: var(--md-primary); font-weight: 800; }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @keyframes portalFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 992px) {
          .portal-main { margin-left: 0; }
          .portal-main.collapsed { margin-left: 0; }
          .portal-sidebar, .portal-sidebar.collapsed { width: 260px; transform: translateX(-100%); }
          .portal-sidebar.open { transform: translateX(0); }
          .portal-sidebar-overlay.open { display: block; }
          .portal-menu-toggle { display: inline-flex; }
          .portal-topbar { padding: 0 16px; }
          .portal-hero-atlantis { padding: 30px 20px 80px 20px; }
          .portal-content-area { padding: 20px 16px; margin-top: -40px; }
        }
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Sidebar mobile overlay */}
      <div
        className={'portal-sidebar-overlay' + (isSidebarOpen ? ' open' : '')}
        onClick={function () { setIsSidebarOpen(false); }}
      ></div>

      {/* Sidebar Drawer */}
      <aside className={'portal-sidebar' + (isSidebarOpen ? ' open' : '') + (isDesktopCollapsed ? ' collapsed' : '')}>
        {/* Brand Header */}
        <div className="portal-sidebar-brand">
          {isDesktopCollapsed ? (
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--primary, #006876) 0%, var(--primary-light, #0891b2) 100%)', color: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>LD</div>
          ) : (
            <img src={process.env.PUBLIC_URL + '/logo_ldm.png'} alt="Logo LDM" className="portal-sidebar-logo" />
          )}
        </div>

        {/* Profile Card with Dropdown */}
        <div className="portal-sidebar-profile">
          <button
            type="button"
            className={'portal-sidebar-profile-trigger' + (profileOpen ? ' open' : '')}
            onClick={function () { setProfileOpen(!profileOpen); }}
          >
            <div className="portal-user-avatar">
              {getInitials(customer ? customer.nama : 'Pelanggan')}
            </div>
            <div className="portal-user-info">
              <div className="portal-user-name">{customer ? customer.nama : 'Nama Pelanggan'}</div>
              <div className="portal-user-role">Pelanggan</div>
            </div>
            <span className="material-symbols-outlined" style={{
              fontSize: '1.1rem',
              color: 'var(--text-muted, #94a3b8)',
              transform: profileOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}>
              keyboard_arrow_down
            </span>
          </button>

          {/* Collapsible Dropdown */}
          {profileOpen && (
            <div className="portal-profile-dropdown">
              <button
                type="button"
                className="portal-profile-dropdown-item"
                onClick={function () { setActiveTab('profile'); setIsSidebarOpen(false); setProfileOpen(false); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person</span>
                Profil Saya
              </button>
              <button
                type="button"
                className="portal-profile-dropdown-item danger"
                onClick={onLogout}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>logout</span>
                Keluar (Logout)
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="portal-sidebar-nav">
          <div className="portal-sidebar-section">
            <div className="portal-sidebar-section-title">Portal</div>
            <button
              type="button"
              className={'portal-nav-item' + (activeTab === 'billing' ? ' active' : '')}
              onClick={function () { setActiveTab('billing'); setIsSidebarOpen(false); }}
            >
              <span className="material-symbols-outlined">receipt_long</span>
              <span className="nav-text">Tagihan Saya</span>
            </button>
            <button
              type="button"
              className={'portal-nav-item' + (activeTab === 'history' ? ' active' : '')}
              onClick={function () { setActiveTab('history'); setIsSidebarOpen(false); }}
            >
              <span className="material-symbols-outlined">history</span>
              <span className="nav-text">Riwayat Pembayaran</span>
            </button>
            <button
              type="button"
              className={'portal-nav-item' + (activeTab === 'profile' ? ' active' : '')}
              onClick={function () { setActiveTab('profile'); setIsSidebarOpen(false); }}
            >
              <span className="material-symbols-outlined">person</span>
              <span className="nav-text">Profil & WiFi</span>
            </button>
          </div>

          <div className="portal-sidebar-section">
            <div className="portal-sidebar-section-title">Lainnya</div>
            <button
              type="button"
              className="portal-nav-item"
              onClick={function () { window.location.href = '/'; }}
            >
              <span className="material-symbols-outlined">home</span>
              <span className="nav-text">Kembali ke Web</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Layout Area */}
      <main className={'portal-main' + (isDesktopCollapsed ? ' collapsed' : '')}>
        {/* Topbar sticky header */}
        <header className="portal-topbar">
          <div className="portal-topbar-left">
            <button className="portal-menu-toggle" onClick={function () { 
              if (window.innerWidth > 992) {
                setIsDesktopCollapsed(!isDesktopCollapsed);
              } else {
                setIsSidebarOpen(!isSidebarOpen);
              }
            }}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="portal-page-title">{activeTabTitle}</h1>
          </div>
          <div className="portal-topbar-right">
            {profileData && (
              <span className="status-badge" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: '#ffffff', 
                color: profileData.pppoe_status === 'active' ? 'var(--status-hijau)' : 'var(--status-merah)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontWeight: '700',
                fontSize: '0.8rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>wifi</span>
                {profileData.pppoe_status === 'active' ? 'Internet Aktif' : 'Internet Terputus'}
              </span>
            )}
          </div>
        </header>

        {/* Hero Banner Section */}
        <section className="portal-hero-atlantis animate-fadeIn">
          <div>
            <h2>{activeTabTitle}</h2>
            <p>
              {activeTab === 'billing' && 'Kelola tagihan internet Anda, cek rincian biaya, dan lakukan konfirmasi pembayaran dengan mengunggah bukti transfer.'}
              {activeTab === 'history' && 'Rekapitulasi riwayat transaksi pembayaran Anda. Pantau pembayaran yang sudah divalidasi maupun yang sebelumnya ditolak.'}
              {activeTab === 'profile' && 'Informasi lengkap profil akun pelanggan. Periksa detail kecepatan paket WiFi dan status koneksi router PPPoE Anda.'}
            </p>
          </div>
        </section>

        {/* Content area */}
        <div className="portal-content-area">
          {/* Messages Alerts */}
          {message.text && (
            <div style={{
              background: message.type === 'success' ? 'var(--status-hijau-bg)' : 'var(--status-merah-bg)',
              color: message.type === 'success' ? 'var(--status-hijau)' : 'var(--status-merah)',
              padding: '14px 16px', borderRadius: 'var(--radius-md)', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
              {message.text}
            </div>
          )}

          {/* Rejected Payment Alert */}
          {lastPayment && lastPayment.status === 'ditolak' && activeTab === 'billing' && (
            <div style={{
              background: 'var(--status-merah-bg)', color: 'var(--status-merah)',
              padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', lineHeight: 1.5
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--status-merah)' }}>warning</span>
              <div>
                <strong style={{ display: 'block', marginBottom: 2 }}>Pembayaran Ditolak Admin!</strong>
                Bukti transfer periode <strong>{lastPayment.periode}</strong> ditolak. <br />
                Alasan Penolakan: <em style={{ fontWeight: 600 }}>"{lastPayment.alasan_tolak}"</em>. Silakan upload kembali bukti transfer yang valid.
              </div>
            </div>
          )}

          {/* Render Active Tab Content */}
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}

export default CustomerPortalPage;

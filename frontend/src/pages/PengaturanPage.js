import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';
import TemplateIcon from '../components/TemplateIcon';

function PengaturanPage() {
  var { refreshLogo } = useLogo();
  var [activeTab, setActiveTab] = useState('umum'); // 'umum', 'mikrotik', 'email', 'midtrans', 'duitku', 'manual', 'reminder'
  var [saving, setSaving] = useState(false);
  var [loadingConfig, setLoadingConfig] = useState(true);
  var [successMsg, setSuccessMsg] = useState('');
  var [errorMsg, setErrorMsg] = useState('');

  // General settings state
  var [umum, setUmum] = useState({
    namaIsp: 'Lintas Data Multimedia',
    emailCs: 'helpdesk@ldm.net.id',
    telpCs: '+62 857-2242-2448',
    alamat: 'Intiland Tower 11th Floor 3A Jl. Panglima Sudirman 101-103  Surabaya, Jawa Timur, Indonesia 60271'
  });

  // Logo upload state
  var [logoPreview, setLogoPreview] = useState(null);
  var [logoFile, setLogoFile] = useState(null);
  var [uploading, setUploading] = useState(false);
  var [currentLogo, setCurrentLogo] = useState(null);
  var [isDefaultLogo, setIsDefaultLogo] = useState(true);
  var [dragOver, setDragOver] = useState(false);
  var logoInputRef = useRef(null);

  // Mikrotik settings state
  var [mikrotik, setMikrotik] = useState({
    host: '192.168.50.1',
    port: '8728',
    username: 'api_isp',
    password: ''
  });
  var [checkingRouter, setCheckingRouter] = useState(false);
  var [routerStatus, setRouterStatus] = useState('idle'); // 'connected', 'error', 'idle'

  // Email SMTP settings state
  var [emailSmtp, setEmailSmtp] = useState({
    user: '24percobaan24@gmail.com',
    pass: '',
    from: 'ESP Lintas Data <24percobaan24@gmail.com>',
    testTarget: ''
  });
  var [testingEmail, setTestingEmail] = useState(false);

  // Midtrans settings state
  var [midtrans, setMidtrans] = useState({
    isSandbox: true,
    merchantId: '',
    clientKey: '',
    serverKey: ''
  });

  // Duitku settings state
  var [duitku, setDuitku] = useState({
    isSandbox: true,
    merchantCode: '',
    apiKey: '',
    appUrl: ''
  });

  // Manual payment settings state
  var [manualPaymentEnabled, setManualPaymentEnabled] = useState(true);

  // Reminder settings state
  var [reminder, setReminder] = useState({
    dueDays: '3',
    waTemplate: 'Halo [Nama],\n\nIni adalah pengingat otomatis dari Lintas Data Multimedia.\nTagihan internet Anda untuk periode [Periode] sebesar Rp [Nominal] akan jatuh tempo pada [JatuhTempo].\n\nSilakan lakukan pembayaran agar layanan tidak terputus. Terima kasih.',
    autoSend: true
  });

  // Fetch current configs on mount
  useEffect(function () {
    var token = localStorage.getItem('token');
    if (!token) return;

    var headers = { Authorization: 'Bearer ' + token };

    // 1. Fetch Logo
    axios.get(API_BASE_URL + '/api/pengaturan/logo', { headers: headers })
      .then(function (res) {
        if (res.data.success && res.data.data) {
          setCurrentLogo(API_BASE_URL + res.data.data.logo_url);
          setIsDefaultLogo(!!res.data.data.is_default);
        }
      }).catch(function () { });

    // 2. Fetch Config Service Data
    axios.get(API_BASE_URL + '/api/pengaturan/config', { headers: headers })
      .then(function (res) {
        if (res.data.success && res.data.data) {
          var cfg = res.data.data;
          setUmum({
            namaIsp: cfg.NAMA_ISP || 'Lintas Data Multimedia',
            emailCs: cfg.EMAIL_CS || 'helpdesk@ldm.net.id',
            telpCs: cfg.TELP_CS || '+62 857-2242-2448',
            alamat: cfg.ALAMAT_ISP || 'Intiland Tower 11th Floor 3A Jl. Panglima Sudirman 101-103  Surabaya, Jawa Timur, Indonesia 60271'
          });

          setMikrotik({
            host: cfg.MIKROTIK_HOST || '192.168.50.1',
            port: cfg.MIKROTIK_PORT || '8728',
            username: cfg.MIKROTIK_USER || 'api_isp',
            password: cfg.MIKROTIK_PASS || ''
          });

          setEmailSmtp({
            user: cfg.EMAIL_USER || '24percobaan24@gmail.com',
            pass: cfg.EMAIL_PASS || '',
            from: cfg.EMAIL_FROM || 'ESP Lintas Data <24percobaan24@gmail.com>',
            testTarget: cfg.EMAIL_USER || ''
          });

          setMidtrans({
            isSandbox: cfg.MIDTRANS_IS_SANDBOX === 'true',
            merchantId: cfg.MIDTRANS_MERCHANT_ID || '',
            clientKey: cfg.MIDTRANS_CLIENT_KEY || '',
            serverKey: cfg.MIDTRANS_SERVER_KEY || ''
          });

          setDuitku({
            isSandbox: cfg.DUITKU_IS_SANDBOX === 'true',
            merchantCode: cfg.DUITKU_MERCHANT_CODE || '',
            apiKey: cfg.DUITKU_API_KEY || '',
            appUrl: cfg.APP_URL || ''
          });

          setManualPaymentEnabled(cfg.MANUAL_PAYMENT_ENABLED !== 'false');

          setReminder({
            dueDays: cfg.REMINDER_DUE_DAYS || '3',
            autoSend: cfg.REMINDER_AUTO_SEND === 'true',
            waTemplate: cfg.REMINDER_WA_TEMPLATE || ''
          });
        }
      })
      .catch(function (err) {
        console.error('Gagal mengambil konfigurasi:', err);
      })
      .finally(function () {
        setLoadingConfig(false);
      });
  }, []);

  // Handle logo file selection
  var handleLogoSelect = function (file) {
    if (!file) return;

    var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.indexOf(file.type) === -1) {
      alert('Format file tidak didukung. Gunakan PNG atau JPG.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file melebihi batas maksimal 2MB.');
      return;
    }

    setLogoFile(file);
    var reader = new FileReader();
    reader.onloadend = function () {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle logo upload to server
  var handleLogoUpload = function () {
    if (!logoFile) return;

    var token = localStorage.getItem('token');
    if (!token) {
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      return;
    }

    setUploading(true);
    var formData = new FormData();
    formData.append('logo', logoFile);

    axios.post(API_BASE_URL + '/api/pengaturan/logo', formData, {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'multipart/form-data'
      }
    }).then(function (res) {
      setUploading(false);
      if (res.data.success) {
        setCurrentLogo(API_BASE_URL + res.data.data.logo_url + '?t=' + Date.now());
        setIsDefaultLogo(false);
        setLogoFile(null);
        setLogoPreview(null);
        setSuccessMsg('Logo perusahaan berhasil diperbarui!');
        refreshLogo();
        setTimeout(function () { setSuccessMsg(''); }, 4000);
      }
    }).catch(function (err) {
      setUploading(false);
      var msg = (err.response && err.response.data && err.response.data.message) || 'Gagal mengunggah logo.';
      alert(msg);
    });
  };

  // Handle logo reset to default
  var handleLogoReset = function () {
    if (!window.confirm('Reset logo ke default?')) return;

    var token = localStorage.getItem('token');
    axios.delete(API_BASE_URL + '/api/pengaturan/logo', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(function (res) {
      if (res.data.success) {
        setCurrentLogo(API_BASE_URL + '/logo_ldm.png');
        setIsDefaultLogo(true);
        setLogoFile(null);
        setLogoPreview(null);
        setSuccessMsg('Logo berhasil di-reset ke default.');
        refreshLogo();
        setTimeout(function () { setSuccessMsg(''); }, 4000);
      }
    }).catch(function () {
      alert('Gagal mereset logo.');
    });
  };

  var handleLogoCancelSelect = function () {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  var handleDragOver = function (e) {
    e.preventDefault();
    setDragOver(true);
  };
  var handleDragLeave = function (e) {
    e.preventDefault();
    setDragOver(false);
  };
  var handleDrop = function (e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoSelect(e.dataTransfer.files[0]);
    }
  };

  // Handle Save Configurations
  var handleSave = function (e) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    var token = localStorage.getItem('token');
    var payload = {
      NAMA_ISP: umum.namaIsp,
      EMAIL_CS: umum.emailCs,
      TELP_CS: umum.telpCs,
      ALAMAT_ISP: umum.alamat,

      MIKROTIK_HOST: mikrotik.host,
      MIKROTIK_PORT: mikrotik.port,
      MIKROTIK_USER: mikrotik.username,
      MIKROTIK_PASS: mikrotik.password,

      EMAIL_USER: emailSmtp.user,
      EMAIL_PASS: emailSmtp.pass,
      EMAIL_FROM: emailSmtp.from,

      MIDTRANS_MERCHANT_ID: midtrans.merchantId,
      MIDTRANS_CLIENT_KEY: midtrans.clientKey,
      MIDTRANS_SERVER_KEY: midtrans.serverKey,
      MIDTRANS_IS_SANDBOX: String(midtrans.isSandbox),

      DUITKU_MERCHANT_CODE: duitku.merchantCode,
      DUITKU_API_KEY: duitku.apiKey,
      DUITKU_IS_SANDBOX: String(duitku.isSandbox),
      APP_URL: duitku.appUrl,

      MANUAL_PAYMENT_ENABLED: String(manualPaymentEnabled),

      REMINDER_DUE_DAYS: reminder.dueDays,
      REMINDER_AUTO_SEND: String(reminder.autoSend),
      REMINDER_WA_TEMPLATE: reminder.waTemplate
    };

    axios.post(API_BASE_URL + '/api/pengaturan/config', payload, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (res) {
        if (res.data.success) {
          setSuccessMsg('Semua pengaturan sistem berhasil disimpan!');
          setTimeout(function () { setSuccessMsg(''); }, 4000);
        }
      })
      .catch(function (err) {
        var msg = (err.response && err.response.data && err.response.data.message) || 'Gagal menyimpan pengaturan.';
        setErrorMsg(msg);
      })
      .finally(function () {
        setSaving(false);
      });
  };

  // Test Mikrotik Connection
  var handleCheckRouter = function () {
    setCheckingRouter(true);
    var token = localStorage.getItem('token');
    axios.post(API_BASE_URL + '/api/pengaturan/test-mikrotik', {
      host: mikrotik.host,
      port: mikrotik.port,
      user: mikrotik.username,
      pass: mikrotik.password
    }, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (res) {
        if (res.data.success) {
          setRouterStatus('connected');
          alert(res.data.message);
        } else {
          setRouterStatus('error');
          alert(res.data.message);
        }
      })
      .catch(function (err) {
        setRouterStatus('error');
        var msg = (err.response && err.response.data && err.response.data.message) || 'Gagal terhubung ke Mikrotik.';
        alert(msg);
      })
      .finally(function () {
        setCheckingRouter(false);
      });
  };

  // Test Email SMTP
  var handleTestEmail = function () {
    if (!emailSmtp.user || !emailSmtp.pass) {
      alert('Email User dan Password App Gmail wajib diisi terlebih dahulu untuk menguji coba.');
      return;
    }

    setTestingEmail(true);
    var token = localStorage.getItem('token');
    axios.post(API_BASE_URL + '/api/pengaturan/test-email', {
      email_user: emailSmtp.user,
      email_pass: emailSmtp.pass,
      email_from: emailSmtp.from,
      target_email: emailSmtp.testTarget || emailSmtp.user
    }, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (res) {
        if (res.data.success) {
          alert(res.data.message);
        }
      })
      .catch(function (err) {
        var msg = (err.response && err.response.data && err.response.data.message) || 'Gagal mengirim email uji coba.';
        alert(msg);
      })
      .finally(function () {
        setTestingEmail(false);
      });
  };

  if (loadingConfig) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <TemplateIcon name="loading" size={24} style={{ marginRight: 8 }} /> Memuat pengaturan sistem...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <div className="page-header">
        <div>
          <h1>Pengaturan Sistem</h1>
          <p>Konfigurasi profil perusahaan, integrasi gateway pembayaran (Midtrans & Duitku), koneksi router Mikrotik, SMTP email, dan template penagihan.</p>
        </div>
      </div>

      {successMsg && (
        <div className="status-badge hijau animate-fadeIn" style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.9rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <TemplateIcon name="check" size={16} style={{ marginRight: '8px' }} /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="status-badge merah animate-fadeIn" style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.9rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span> {errorMsg}
        </div>
      )}

      {/* Settings Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '250px 1fr',
        gap: '30px',
        alignItems: 'start'
      }}>
        {/* Left Side Sidebar Tabs */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {[
            { id: 'umum', label: 'Profil & Umum', icon: 'info' },
            { id: 'mikrotik', label: 'Router Mikrotik', icon: 'router' },
            { id: 'email', label: 'Email SMTP', icon: 'mail' },
            { id: 'midtrans', label: 'Midtrans Gateway', icon: 'shield' },
            { id: 'duitku', label: 'Duitku Gateway', icon: 'account_balance_wallet' },
            { id: 'manual', label: 'Pembayaran Manual', icon: 'payments' },
            { id: 'reminder', label: 'Pengingat Tagihan', icon: 'notifications' }

          ].map(function (tab) {
            var isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={function () { setActiveTab(tab.id); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-glow)' : 'transparent',
                  marginBottom: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={function (e) {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
                onMouseLeave={function (e) {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span className="material-symbols-outlined" style={{
                  fontSize: '1.25rem',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)'
                }}>
                  {tab.icon}
                </span>
                {tab.label}
              </div>
            );
          })}
        </div>

        {/* Right Side Content Panel */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: 'var(--shadow-sm)'
        }} className="animate-fadeIn">

          <form onSubmit={handleSave}>

            {/* 1. UMUM & PROFIL TAB */}
            {activeTab === 'umum' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Profil Perusahaan & Umum</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Konfigurasi identitas layanan ISP untuk kwitansi/invoice tagihan pelanggan.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Nama Layanan ISP *</label>
                    <input
                      type="text"
                      value={umum.namaIsp}
                      onChange={function (e) { setUmum({ ...umum, namaIsp: e.target.value }); }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Customer Service *</label>
                    <input
                      type="email"
                      value={umum.emailCs}
                      onChange={function (e) { setUmum({ ...umum, emailCs: e.target.value }); }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Nomor Telepon / WhatsApp CS *</label>
                  <input
                    type="text"
                    value={umum.telpCs}
                    onChange={function (e) { setUmum({ ...umum, telpCs: e.target.value }); }}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Alamat Kantor Utama</label>
                  <textarea
                    rows="3"
                    value={umum.alamat}
                    onChange={function (e) { setUmum({ ...umum, alamat: e.target.value }); }}
                  />
                </div>

                {/* Logo Upload Section */}
                <label style={{ fontSize: '0.82rem', fontWeight: '700', marginBottom: '8px', display: 'block', color: 'var(--text-secondary)' }}>Logo Perusahaan</label>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {(logoPreview || currentLogo) ? (
                      <img
                        src={logoPreview || currentLogo}
                        alt="Logo Perusahaan"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
                      />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}>image</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      onClick={function () { if (!uploading) logoInputRef.current.click(); }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        border: dragOver ? '2px dashed var(--primary)' : '1.5px dashed var(--border-color)',
                        borderRadius: '8px',
                        padding: '20px',
                        textAlign: 'center',
                        background: dragOver ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: uploading ? 0.6 : 1
                      }}
                    >
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        style={{ display: 'none' }}
                        onChange={function (e) {
                          if (e.target.files && e.target.files[0]) {
                            handleLogoSelect(e.target.files[0]);
                          }
                        }}
                      />
                      <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: dragOver ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '4px' }}>
                        cloud_upload
                      </span>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        {logoFile ? logoFile.name : 'Klik atau seret file ke sini'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Format PNG/JPG maksimal 2MB
                      </div>
                    </div>

                    {logoFile && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleLogoUpload}
                          disabled={uploading}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {uploading ? (
                            <><TemplateIcon name="loading" size={14} /> Mengunggah...</>
                          ) : (
                            <><span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>upload</span> Simpan Logo</>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleLogoCancelSelect}
                          disabled={uploading}
                        >
                          Batal
                        </button>
                      </div>
                    )}

                    {!logoFile && !isDefaultLogo && currentLogo && (
                      <button
                        type="button"
                        onClick={handleLogoReset}
                        style={{
                          marginTop: '10px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0
                        }}
                      >
                        Reset ke logo default
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. MIKROTIK ROUTER TAB */}
            {activeTab === 'mikrotik' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Koneksi Mikrotik Router</h3>
                  <span className={'status-badge ' + (routerStatus === 'connected' ? 'hijau' : (routerStatus === 'error' ? 'merah' : 'abu'))} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: routerStatus === 'connected' ? 'var(--status-hijau)' : (routerStatus === 'error' ? 'var(--status-merah)' : '#aaa'),
                      display: 'inline-block'
                    }} />
                    {routerStatus === 'connected' ? 'Terhubung' : (routerStatus === 'error' ? 'Gagal Terhubung' : 'Belum Diuji')}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Atur kredensial router Mikrotik (`MIKROTIK_HOST`, `MIKROTIK_USER`, `MIKROTIK_PASS`, `MIKROTIK_PORT`) untuk pengaktifan dan isolir otomatis rahasia PPPoE.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>IP Address / Hostname Router *</label>
                    <input
                      type="text"
                      value={mikrotik.host}
                      placeholder="e.g. 192.168.50.1"
                      onChange={function (e) { setMikrotik({ ...mikrotik, host: e.target.value }); }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>API Port *</label>
                    <input
                      type="text"
                      value={mikrotik.port}
                      placeholder="e.g. 8728"
                      onChange={function (e) { setMikrotik({ ...mikrotik, port: e.target.value }); }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <div className="form-group">
                    <label>Username API Mikrotik *</label>
                    <input
                      type="text"
                      value={mikrotik.username}
                      placeholder="e.g. api_isp"
                      onChange={function (e) { setMikrotik({ ...mikrotik, username: e.target.value }); }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password API Mikrotik *</label>
                    <input
                      type="password"
                      value={mikrotik.password}
                      placeholder="Password API Mikrotik"
                      onChange={function (e) { setMikrotik({ ...mikrotik, password: e.target.value }); }}
                      required
                    />
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Uji Sambungan API Mikrotik</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Pastikan service api pada Mikrotik aktif (default port 8728).</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCheckRouter}
                    disabled={checkingRouter}
                  >
                    {checkingRouter ? 'Menghubungkan...' : 'Tes Koneksi'}
                  </button>
                </div>
              </div>
            )}

            {/* 3. EMAIL SMTP TAB */}
            {activeTab === 'email' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Konfigurasi Email SMTP (Nodemailer)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Atur kredensial email (`EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`) untuk mengalirkan OTP login dan invoice kwitansi PDF ke email pelanggan.
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Email Pengirim (EMAIL_USER) *</label>
                  <input
                    type="email"
                    value={emailSmtp.user}
                    placeholder="e.g. 24percobaan24@gmail.com"
                    onChange={function (e) { setEmailSmtp({ ...emailSmtp, user: e.target.value }); }}
                    required
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Alamat Gmail yang digunakan untuk mengirim email.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Password Aplikasi Gmail (EMAIL_PASS) *</label>
                  <input
                    type="password"
                    value={emailSmtp.pass}
                    placeholder="e.g. jacb ramz jsmh urkf"
                    onChange={function (e) { setEmailSmtp({ ...emailSmtp, pass: e.target.value }); }}
                    required
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Gunakan <strong>App Password</strong> 16 digit yang dibuat pada Google Account &gt; Security &gt; 2-Step Verification.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Nama Tampilan Pengirim (EMAIL_FROM) *</label>
                  <input
                    type="text"
                    value={emailSmtp.from}
                    placeholder='e.g. ESP Lintas Data <24percobaan24@gmail.com>'
                    onChange={function (e) { setEmailSmtp({ ...emailSmtp, from: e.target.value }); }}
                    required
                  />
                </div>

                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '8px' }}>Uji Coba Pengiriman Email</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="email"
                      placeholder="Masukkan email tujuan pengujian..."
                      value={emailSmtp.testTarget}
                      onChange={function (e) { setEmailSmtp({ ...emailSmtp, testTarget: e.target.value }); }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleTestEmail}
                      disabled={testingEmail}
                    >
                      {testingEmail ? 'Mengirim...' : 'Tes Kirim Email'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. MIDTRANS TAB */}
            {activeTab === 'midtrans' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Midtrans Payment Gateway</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Konfigurasi kredensial API Midtrans Snap SDK untuk pembayaran otomatis via Snap Pop-Up.
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Environment Mode</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                      <input
                        type="radio"
                        name="midtransEnv"
                        checked={midtrans.isSandbox}
                        onChange={function () { setMidtrans({ ...midtrans, isSandbox: true }); }}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      /> Sandbox (Simulasi Uji Coba)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                      <input
                        type="radio"
                        name="midtransEnv"
                        checked={!midtrans.isSandbox}
                        onChange={function () { setMidtrans({ ...midtrans, isSandbox: false }); }}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      /> Production (Live / Asli)
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Merchant ID</label>
                  <input
                    type="text"
                    value={midtrans.merchantId}
                    placeholder="e.g. M1094827"
                    onChange={function (e) { setMidtrans({ ...midtrans, merchantId: e.target.value }); }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Client Key *</label>
                  <input
                    type="text"
                    value={midtrans.clientKey}
                    placeholder="e.g. SB-Mid-client-XXXXX"
                    onChange={function (e) { setMidtrans({ ...midtrans, clientKey: e.target.value }); }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Server Key *</label>
                  <input
                    type="password"
                    value={midtrans.serverKey}
                    placeholder="e.g. SB-Mid-server-XXXXX"
                    onChange={function (e) { setMidtrans({ ...midtrans, serverKey: e.target.value }); }}
                  />
                </div>
              </div>
            )}

            {/* 5. DUITKU TAB */}
            {activeTab === 'duitku' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Duitku Payment Gateway</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Konfigurasi API Duitku Payment Gateway untuk pembayaran instan via QRIS, Virtual Account, E-Wallet, dan Minimarket.
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Environment Mode</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                      <input
                        type="radio"
                        name="duitkuEnv"
                        checked={duitku.isSandbox}
                        onChange={function () { setDuitku({ ...duitku, isSandbox: true }); }}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      /> Sandbox (Simulasi Uji Coba)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                      <input
                        type="radio"
                        name="duitkuEnv"
                        checked={!duitku.isSandbox}
                        onChange={function () { setDuitku({ ...duitku, isSandbox: false }); }}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      /> Production (Live / Asli)
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Kode Merchant Duitku (DUITKU_MERCHANT_CODE) *</label>
                  <input
                    type="text"
                    value={duitku.merchantCode}
                    placeholder="e.g. D12345"
                    onChange={function (e) { setDuitku({ ...duitku, merchantCode: e.target.value }); }}
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Kode Merchant resmi yang tertera pada Dashboard Duitku.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>API Key / Secret Key Duitku (DUITKU_API_KEY) *</label>
                  <input
                    type="password"
                    value={duitku.apiKey}
                    placeholder="e.g. 8a9b7c6d5e4f3a2b1c"
                    onChange={function (e) { setDuitku({ ...duitku, apiKey: e.target.value }); }}
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Kunci rahasia API Duitku yang digunakan untuk menghasilkan Signature MD5 transaksi & webhook.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Webhook / Callback URL (APP_URL) *</label>
                  <input
                    type="text"
                    value={duitku.appUrl}
                    placeholder="e.g. https://subdomain.ngrok-free.dev"
                    onChange={function (e) { setDuitku({ ...duitku, appUrl: e.target.value }); }}
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    URL publik (ngrok) agar server Duitku & Midtrans dapat mengirim callback pembayaran ke backend Anda. Contoh: <strong>https://abcdef.ngrok-free.dev</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 6. MANUAL PAYMENT TAB */}
            {activeTab === 'manual' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Pembayaran Manual</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Atur apakah pilihan pembayaran melalui QRIS dan transfer bank manual dapat digunakan pelanggan.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Aktifkan Pembayaran Manual</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {manualPaymentEnabled ? 'QRIS dan transfer bank manual tampil di halaman customer.' : 'Semua pilihan pembayaran manual disembunyikan dari halaman customer.'}
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={manualPaymentEnabled}
                      onChange={function (e) { setManualPaymentEnabled(e.target.checked); }}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: manualPaymentEnabled ? 'var(--primary)' : '#ccc', transition: '.3s', borderRadius: '24px' }}>
                      <span style={{ position: 'absolute', height: '18px', width: '18px', left: manualPaymentEnabled ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }} />
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* 7. REMINDER & TEMPLATE TAB */}
            {activeTab === 'reminder' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Reminder & Pengingat Tagihan</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                  Konfigurasi waktu jatuh tempo dan template pesan penagihan otomatis via Email/WhatsApp.
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Batas Kirim Reminder (Hari sebelum jatuh tempo) *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="number"
                      value={reminder.dueDays}
                      style={{ width: '100px' }}
                      onChange={function (e) { setReminder({ ...reminder, dueDays: e.target.value }); }}
                      min="1"
                      max="10"
                      required
                    />
                    <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>Hari sebelum tanggal jatuh tempo</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Pesan Reminder Otomatis</label>
                  <textarea
                    rows="6"
                    value={reminder.waTemplate}
                    onChange={function (e) { setReminder({ ...reminder, waTemplate: e.target.value }); }}
                    placeholder="Tulis format template pesan..."
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Gunakan placeholder: <code>[Nama]</code> (Nama pelanggan), <code>[Periode]</code> (Bulan tagihan), <code>[Nominal]</code> (Jumlah tagihan), <code>[JatuhTempo]</code> (Tanggal jatuh tempo).
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Pengiriman Otomatis Harian</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Aktifkan sistem cron untuk mengirim reminder secara otomatis setiap jam 08:00 pagi.</span>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={reminder.autoSend}
                      onChange={function (e) { setReminder({ ...reminder, autoSend: e.target.checked }); }}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: reminder.autoSend ? 'var(--primary)' : '#ccc',
                      transition: '.3s',
                      borderRadius: '24px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px', width: '18px',
                        left: reminder.autoSend ? '26px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '.3s',
                        borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Form Footer Action */}
            <div style={{
              marginTop: '30px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ minWidth: '150px' }}
              >
                {saving ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TemplateIcon name="loading" size={16} /> Menyimpan...
                  </div>
                ) : 'Simpan Perubahan'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

export default PengaturanPage;

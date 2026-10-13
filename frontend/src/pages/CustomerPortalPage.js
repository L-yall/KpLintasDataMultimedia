import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';

function CustomerPortalPage({ onLogout }) {
  var location = useLocation();
  var { logoUrl } = useLogo();
  var initialTab = (location.state && location.state.activeTab) || 'billing';
  var [activeTab, setActiveTab] = useState(initialTab); // 'billing', 'history', 'profile'
  var [isSidebarOpen, setIsSidebarOpen] = useState(false);
  var [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  var [billing, setBilling] = useState(null);
  var [lastPayment, setLastPayment] = useState(null);
  var [isPaidThisMonth, setIsPaidThisMonth] = useState(false);
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
  var [activePaymentGateway, setActivePaymentGateway] = useState('midtrans');
  var [manualPaymentEnabled, setManualPaymentEnabled] = useState(true);
  var [midtransClientKey, setMidtransClientKey] = useState('');
  var [midtransLoading, setMidtransLoading] = useState(false);
  var [duitkuLoading, setDuitkuLoading] = useState(false);
  var [duitkuModalOpen, setDuitkuModalOpen] = useState(false);
  var [duitkuSelectedChannel, setDuitkuSelectedChannel] = useState(null);
  var [duitkuChannels, setDuitkuChannels] = useState([]);
  var [duitkuChannelsLoading, setDuitkuChannelsLoading] = useState(false);
  var [duitkuExpandedCategory, setDuitkuExpandedCategory] = useState(null);
  var [duitkuDetailsOpen, setDuitkuDetailsOpen] = useState(false);
  var [duitkuOrderId, setDuitkuOrderId] = useState('');
  var [copiedTip, setCopiedTip] = useState('');
  var [countdown, setCountdown] = useState(86395);
  var [dropdownOpen, setDropdownOpen] = useState(false);
  var [profileOpen, setProfileOpen] = useState(false);
  var dropdownRef = useRef(null);

  // Dynamic QRIS and bank accounts state
  var [qrisUrl, setQrisUrl] = useState(`${API_BASE_URL}/images/qris.png`);
  var [bankAccounts, setBankAccounts] = useState([]);
  var [manualModalOpen, setManualModalOpen] = useState(false);
  var [copiedRekening, setCopiedRekening] = useState(false);

  function getBankLogo(namaBank) {
    var lower = (namaBank || '').toLowerCase();
    if (lower.includes('bca')) return process.env.PUBLIC_URL + '/BCA.png';
    if (lower.includes('bri')) return process.env.PUBLIC_URL + '/BRI.jpg';
    if (lower.includes('mandiri')) return process.env.PUBLIC_URL + '/MANDIRI.png';
    return null;
  }

  var token = localStorage.getItem('customer_token');
  var headers = { Authorization: 'Bearer ' + token };

  // Payment method options with logos
  var dynamicBankOptions = bankAccounts.map(function (acc) {
    return {
      value: 'bank_' + acc.id,
      label: 'Manual: ' + acc.nama_bank,
      sublabel: 'Transfer Bank / E-Wallet',
      icon: getBankLogo(acc.nama_bank) ? null : 'account_balance',
      logo: getBankLogo(acc.nama_bank),
      accountData: acc
    };
  });

  var paymentOptions = [
    { value: 'midtrans', label: 'Bayar Online Instan -  (QRIS, E-Wallet, VA)', icon: 'payments', logo: null },
    { value: 'duitku', label: 'Bayar Online Instan -  (QRIS, VA, E-Wallet, Retail)', icon: 'account_balance_wallet', logo: null },
    { value: 'qris', label: 'Manual: QRIS', sublabel: 'Scan & Transfer', icon: 'qr_code_2', logo: null },
    ...dynamicBankOptions
  ].filter(function (option) {
    var isManual = option.value === 'qris' || option.value.startsWith('bank_');
    var gatewayVisible = ['midtrans', 'duitku'].indexOf(option.value) === -1 || option.value === activePaymentGateway;
    return gatewayVisible && (manualPaymentEnabled || !isManual);
  });
  var singlePaymentMethod = paymentOptions.length === 1 ? paymentOptions[0].value : null;
  var singleGatewayPayment = ['midtrans', 'duitku'].indexOf(singlePaymentMethod) !== -1;

  useEffect(function () {
    var isManual = paymentMethod === 'qris' || paymentMethod.startsWith('bank_');
    if (singlePaymentMethod && paymentMethod !== singlePaymentMethod) {
      setPaymentMethod(singlePaymentMethod);
      setDropdownOpen(false);
    } else if (!manualPaymentEnabled && isManual) {
      setPaymentMethod(activePaymentGateway !== 'none' ? activePaymentGateway : 'qris');
    } else if (['midtrans', 'duitku'].indexOf(paymentMethod) !== -1 && paymentMethod !== activePaymentGateway) {
      setPaymentMethod(activePaymentGateway !== 'none' ? activePaymentGateway : (manualPaymentEnabled ? 'qris' : 'midtrans'));
    }
  }, [manualPaymentEnabled, paymentMethod, activePaymentGateway, singlePaymentMethod]);

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
    fetchManualPaymentConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchManualPaymentConfig() {
    try {
      var [qrisRes, rekRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/pengaturan/qris`),
        axios.get(`${API_BASE_URL}/api/pengaturan/rekening?active_only=true`)
      ]);
      if (qrisRes.data.success && qrisRes.data.data?.qris_url) {
        setQrisUrl(`${API_BASE_URL}${qrisRes.data.data.qris_url}`);
      }
      if (rekRes.data.success && rekRes.data.data) {
        setBankAccounts(rekRes.data.data);
      }
    } catch (err) {
      console.error('Gagal memuat info pembayaran manual:', err);
    }
  }

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

  var [deletingPaymentId, setDeletingPaymentId] = useState(null);
  var [clearingHistory, setClearingHistory] = useState(false);

  async function handleDeletePayment(idPembayaran) {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan riwayat pembayaran ini dari portal Anda?')) {
      return;
    }
    setDeletingPaymentId(idPembayaran);
    try {
      var response = await axios.delete(`${API_BASE_URL}/api/customer/portal/payments/${idPembayaran}`, { headers: headers });
      if (response.data.success) {
        setPaymentHistory(function (prev) {
          return prev.filter(function (p) { return p.id_pembayaran !== idPembayaran; });
        });
        setMessage({ type: 'success', text: 'Riwayat pembayaran berhasil dihapus.' });
        setTimeout(function () { setMessage({ type: '', text: '' }); }, 4000);
      } else {
        alert(response.data.message || 'Gagal menghapus riwayat pembayaran.');
      }
    } catch (err) {
      console.error('Gagal menghapus riwayat pembayaran:', err);
      alert(err.response?.data?.message || 'Terjadi kesalahan saat menghapus riwayat pembayaran.');
    } finally {
      setDeletingPaymentId(null);
    }
  }

  async function handleClearAllPayments() {
    if (!window.confirm('Apakah Anda yakin ingin menghapus SEMUA catatan riwayat pembayaran Anda? Catatan yang dihapus tidak dapat dipulihkan.')) {
      return;
    }
    setClearingHistory(true);
    try {
      var response = await axios.delete(`${API_BASE_URL}/api/customer/portal/payments`, { headers: headers });
      if (response.data.success) {
        setPaymentHistory([]);
        setMessage({ type: 'success', text: 'Semua riwayat pembayaran berhasil dibersihkan.' });
        setTimeout(function () { setMessage({ type: '', text: '' }); }, 4000);
      } else {
        alert(response.data.message || 'Gagal membersihkan riwayat pembayaran.');
      }
    } catch (err) {
      console.error('Gagal membersihkan riwayat pembayaran:', err);
      alert(err.response?.data?.message || 'Terjadi kesalahan saat membersihkan riwayat pembayaran.');
    } finally {
      setClearingHistory(false);
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
        setManualPaymentEnabled(response.data.manualPaymentEnabled !== false);
        var configuredGateway = ['midtrans', 'duitku', 'none'].indexOf(response.data.activeGateway) !== -1 ? response.data.activeGateway : 'midtrans';
        setActivePaymentGateway(configuredGateway);
        setPaymentMethod(configuredGateway !== 'none' ? configuredGateway : 'qris');
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
        setIsPaidThisMonth(!!response.data.isPaidThisMonth);
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
            onSuccess: async function (result) {
              setMessage({ type: 'success', text: 'Pembayaran sukses! Layanan internet Anda sedang diaktifkan.' });
              try {
                await axios.post(`${API_BASE_URL}/api/customer/portal/midtrans-finish`, {
                  order_id: result.order_id,
                  id_tagihan: billing.id_tagihan
                }, { headers: headers });
              } catch (finishErr) {
                console.error('Midtrans finish notification error:', finishErr);
              }
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

  async function handleDuitkuPay(channelCode) {
    if (!billing || !billing.id_tagihan) return;
    setDuitkuSelectedChannel(channelCode);
    setDuitkuLoading(true);
    setMessage({ type: '', text: '' });
    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/portal/duitku-payment`, {
        id_tagihan: billing.id_tagihan,
        paymentMethod: channelCode
      }, { headers: headers });
      if (response.data.success && response.data.paymentUrl) {
        setDuitkuModalOpen(false);
        window.location.href = response.data.paymentUrl;
      } else {
        setDuitkuModalOpen(false);
        setMessage({ type: 'error', text: response.data?.message || 'Gagal membuat transaksi Duitku.' });
      }
    } catch (err) {
      console.error('Duitku payment error:', err);
      setDuitkuModalOpen(false);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Gagal memulai pembayaran Duitku.' });
    } finally {
      setDuitkuLoading(false);
      setDuitkuSelectedChannel(null);
    }
  }

  var defaultDuitkuChannels = [
    // Virtual Account / Transfer Bank
    { paymentMethod: 'BC', paymentName: 'BCA Virtual Account', paymentImage: 'https://images.duitku.com/hotlink-ok/BCA.SVG', totalFee: '0' },
    { paymentMethod: 'M2', paymentName: 'Mandiri Virtual Account', paymentImage: 'https://images.duitku.com/hotlink-ok/MV.PNG', totalFee: '0' },
    { paymentMethod: 'BR', paymentName: 'BRI Virtual Account', paymentImage: 'https://images.duitku.com/hotlink-ok/BR.PNG', totalFee: '0' },
    { paymentMethod: 'I1', paymentName: 'BNI Virtual Account', paymentImage: 'https://images.duitku.com/hotlink-ok/I1.PNG', totalFee: '0' },
    { paymentMethod: 'BV', paymentName: 'BSI Virtual Account', paymentImage: 'https://images.duitku.com/hotlink-ok/BSI.PNG', totalFee: '0' },
    { paymentMethod: 'NC', paymentName: 'BNC (Neo Commerce) VA', paymentImage: 'https://images.duitku.com/hotlink-ok/NC.PNG', totalFee: '0' },
    { paymentMethod: 'AG', paymentName: 'Bank Artha Graha VA', paymentImage: 'https://images.duitku.com/hotlink-ok/AG.PNG', totalFee: '0' },
    { paymentMethod: 'SP', paymentName: 'Bank Sahabat Sampoerna VA', paymentImage: 'https://images.duitku.com/hotlink-ok/SP.PNG', totalFee: '0' },

    // QRIS & E-Wallet
    { paymentMethod: 'LQ', paymentName: 'QRIS (Semua Bank & E-Wallet)', paymentImage: 'https://images.duitku.com/hotlink-ok/LINKAJA.PNG', totalFee: '0' },
    { paymentMethod: 'SP', paymentName: 'ShopeePay QRIS', paymentImage: 'https://images.duitku.com/hotlink-ok/SHOPEEPAY.PNG', totalFee: '0' },
    { paymentMethod: 'OV', paymentName: 'OVO E-Wallet', paymentImage: 'https://images.duitku.com/hotlink-ok/OV.PNG', totalFee: '0' },
    { paymentMethod: 'DA', paymentName: 'DANA E-Wallet', paymentImage: 'https://images.duitku.com/hotlink-ok/DA.PNG', totalFee: '0' },
    { paymentMethod: 'LA', paymentName: 'LinkAja E-Wallet', paymentImage: 'https://images.duitku.com/hotlink-ok/LINKAJA.PNG', totalFee: '0' },

    // Minimarket
    { paymentMethod: 'IR', paymentName: 'Indomaret', paymentImage: 'https://images.duitku.com/hotlink-ok/IR.PNG', totalFee: '0' },
    { paymentMethod: 'FT', paymentName: 'Retail / Alfamart / Pos', paymentImage: 'https://images.duitku.com/hotlink-ok/RETAIL.PNG', totalFee: '0' },

    // Kartu Kredit
    { paymentMethod: 'VC', paymentName: 'Kartu Kredit / Debit Online', paymentImage: 'https://images.duitku.com/hotlink-ok/VC.PNG', totalFee: '0' }
  ];

  async function fetchDuitkuChannels() {
    if (!billing || !billing.nominal) return;
    setDuitkuChannelsLoading(true);
    try {
      var response = await axios.get(`${API_BASE_URL}/api/customer/portal/duitku-payment-methods?amount=${Math.round(billing.nominal)}`, { headers: headers });
      if (response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
        setDuitkuChannels(response.data.data);
      }
    } catch (err) {
      console.warn('Gagal mengambil channel Duitku real-time, menggunakan channel default:', err);
    } finally {
      setDuitkuChannelsLoading(false);
    }
  }

  useEffect(function () {
    var timer;
    if (duitkuModalOpen) {
      setCountdown(86395); // ~23:59:55
      timer = setInterval(function () {
        setCountdown(function (prev) {
          if (prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return function () {
      if (timer) clearInterval(timer);
    };
  }, [duitkuModalOpen]);

  function formatCountdown(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  function handleCopyText(text, label) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedTip(label);
      setTimeout(function () { setCopiedTip(''); }, 2000);
    }
  }

  function handleOpenDuitkuModal() {
    setDuitkuModalOpen(true);
    setDuitkuExpandedCategory(null);
    setDuitkuDetailsOpen(false);
    setDuitkuOrderId('TRX-DUITKU-' + (billing ? billing.id_tagihan : '0') + '-' + Date.now().toString().slice(-6));
    fetchDuitkuChannels();
  }

  function parseDuitkuChannel(item) {
    var code = item.paymentMethod || item.code || '';
    var rawName = item.paymentName || item.name || code;
    var nameUpper = rawName.toUpperCase();
    var img = item.paymentImage || item.image || '';
    var fee = item.totalFee && Number(item.totalFee) > 0
      ? '+Rp ' + Number(item.totalFee).toLocaleString('id-ID')
      : 'Otomatis Real-time';

    var category = 'va';
    var categoryLabel = 'Transfer Bank (VA)';
    var icon = 'account_balance';
    var iconBg = '#e0f2fe';
    var iconColor = '#0284c7';
    var isPopular = false;

    if (code === 'LQ' || nameUpper.includes('QRIS')) {
      category = 'ewallet';
      categoryLabel = 'QRIS & E-Wallet';
      icon = 'qr_code_2';
      iconBg = '#ecfdf5';
      iconColor = '#059669';
      isPopular = true;
      rawName = 'QRIS (Semua Bank & E-Wallet)';
    } else if (code === 'BC' || code === 'M2' || code === 'BR' || code === 'I1' || code === 'BV' || code === 'NC' || code === 'AG' || (code === 'SP' && nameUpper.includes('VA')) || nameUpper.includes('VA') || nameUpper.includes('BANK')) {
      category = 'va';
      categoryLabel = 'Virtual Account (Transfer Bank)';
      icon = 'account_balance';
      iconBg = '#e0f2fe';
      iconColor = '#0284c7';
      if (code === 'BC' || code === 'M2' || code === 'BR') isPopular = true;
      if (code === 'BC') rawName = 'BCA Virtual Account';
      else if (code === 'M2') rawName = 'Mandiri Virtual Account (H2H)';
      else if (code === 'BR') rawName = 'BRI Virtual Account';
      else if (code === 'I1' && nameUpper.includes('BNI')) rawName = 'BNI Virtual Account';
      else if (code === 'BV') rawName = 'BSI Virtual Account';
      else if (code === 'NC') rawName = 'BNC (Neo Commerce) VA';
    } else if (code === 'OV' || code === 'DA' || code === 'LA' || code === 'SP' || code === 'SA' || nameUpper.includes('OVO') || nameUpper.includes('DANA') || nameUpper.includes('LINKAJA') || nameUpper.includes('SHOPEE')) {
      category = 'ewallet';
      categoryLabel = 'E-Wallet';
      icon = 'account_balance_wallet';
      iconBg = '#fff7ed';
      iconColor = '#ea580c';
      if (code === 'SP' || code === 'SA') rawName = 'ShopeePay';
      else if (code === 'OV') rawName = 'OVO';
      else if (code === 'DA') rawName = 'DANA';
      else if (code === 'LA') rawName = 'LinkAja';
    } else if (code === 'IR' || code === 'FT' || nameUpper.includes('INDOMARET') || nameUpper.includes('ALFAMART') || nameUpper.includes('RETAIL')) {
      category = 'retail';
      categoryLabel = 'Minimarket & Retail';
      icon = 'storefront';
      iconBg = '#fefce8';
      iconColor = '#ca8a04';
      if (code === 'IR') rawName = 'Indomaret';
      else if (code === 'FT') rawName = 'Retail / Pos / Pegadaian';
    } else if (code === 'VC' || nameUpper.includes('CREDIT') || nameUpper.includes('CARD')) {
      category = 'cc';
      categoryLabel = 'Kartu Kredit / Debit';
      icon = 'credit_card';
      iconBg = '#f5f3ff';
      iconColor = '#7c3aed';
      rawName = 'Kartu Kredit / Debit Online';
    }

    return {
      code: code,
      name: rawName,
      image: img,
      fee: fee,
      category: category,
      categoryLabel: categoryLabel,
      icon: icon,
      iconBg: iconBg,
      iconColor: iconColor,
      isPopular: isPopular
    };
  }

  function getSelectedOption() {
    return paymentOptions.find(function (opt) { return opt.value === paymentMethod; });
  }

  function handleSelectOption(value) {
    setPaymentMethod(value);
    setDropdownOpen(false);
    if (value === 'qris' || value.startsWith('bank_')) {
      setManualModalOpen(true);
    }
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

  function renderPaymentDetail(showDescription) {
    switch (paymentMethod) {
      case 'midtrans':
        return (
          <div style={S.infoBox}>
            {showDescription && (
              <p style={{ fontSize: '0.78rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.4, marginBottom: 16 }}>
                Bayar menggunakan QRIS, GoPay, ShopeePay, Mandiri Billpayment, BCA/BRI Virtual Account, atau Kartu Kredit. Pembayaran akan terverifikasi secara instan.
              </p>
            )}
            <button type="button" style={{ ...S.btnPrimary, opacity: midtransLoading ? 0.7 : 1 }} onClick={handleMidtransPay} disabled={midtransLoading}>
              {midtransLoading ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Menghubungkan...</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span> Bayar Sekarang</>
              )}
            </button>
          </div>
        );
      case 'duitku':
        return (
          <div style={S.infoBox}>
            {showDescription && (
              <p style={{ fontSize: '0.78rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.4, marginBottom: 16 }}>
                QRIS, Virtual Account, ShopeePay, Indomaret, Kartu Kredit & lebih banyak lagi. Pembayaran terverifikasi otomatis secara instan.
              </p>
            )}
            <button type="button" style={{ ...S.btnPrimary }} onClick={handleOpenDuitkuModal}>
              <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span> Bayar Sekarang</>
            </button>
          </div>
        );
      case 'qris':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'var(--md-surface-container-low)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--md-outline-variant)',
            marginTop: 12,
            gap: 12,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-primary)' }}>qr_code_2</span>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>Kode QRIS Siap di-Scan</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--md-on-surface-variant)' }}>Bisa menggunakan semua aplikasi m-Banking & E-Wallet</div>
              </div>
            </div>
            <button
              type="button"
              onClick={function () { setManualModalOpen(true); }}
              style={{
                padding: '9px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--md-primary)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fullscreen</span>
              Buka Pop-up QRIS
            </button>
          </div>
        );
      default:
        if (paymentMethod && paymentMethod.startsWith('bank_')) {
          var accId = parseInt(paymentMethod.replace('bank_', ''), 10);
          var acc = bankAccounts.find(function (a) { return a.id === accId; });
          if (acc) {
            var bankLogo = getBankLogo(acc.nama_bank);
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'var(--md-surface-container-low)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--md-outline-variant)',
                marginTop: 12,
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {bankLogo ? (
                    <img src={bankLogo} alt={acc.nama_bank} style={{ height: 28, objectFit: 'contain' }} />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-primary)' }}>account_balance</span>
                  )}
                  <div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--md-primary)' }}>
                      {acc.nomor_rekening}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--md-on-surface-variant)' }}>
                      {acc.nama_bank} &bull; a/n {acc.atas_nama}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={function () {
                      navigator.clipboard.writeText(acc.nomor_rekening);
                      setCopiedRekening(acc.id);
                      setTimeout(function () { setCopiedRekening(false); }, 2000);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      color: 'var(--md-primary)',
                      border: '1px solid var(--md-primary)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {copiedRekening === acc.id ? 'check' : 'content_copy'}
                    </span>
                    {copiedRekening === acc.id ? 'Tersalin!' : 'Salin'}
                  </button>
                  <button
                    type="button"
                    onClick={function () { setManualModalOpen(true); }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--md-primary)',
                      color: 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                    Petunjuk
                  </button>
                </div>
              </div>
            );
          }
        }
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

  var effectiveMethod = singleGatewayPayment ? singlePaymentMethod : paymentMethod;
  var isPayLoading = effectiveMethod === 'midtrans' ? midtransLoading : false;
  var payIcon = effectiveMethod === 'duitku' ? 'account_balance_wallet' : 'payments';

  function handlePayNow() {
    if (effectiveMethod === 'duitku') {
      handleOpenDuitkuModal();
    } else {
      handleMidtransPay();
    }
  }

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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: 'var(--status-hijau)' }}>Tagihan Bulan Ini Sudah Lunas</h3>
            <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.88rem' }}>Terima kasih atas pembayaran Anda. Layanan internet Anda aktif.</p>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner notification if current month is already paid */}
          {isPaidThisMonth && (
            <div style={{
              background: 'linear-gradient(135deg, #e6f4ea 0%, #d4edda 100%)',
              border: '1px solid #34a853',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: '0 4px 14px rgba(52, 168, 83, 0.12)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#11722d', flexShrink: 0 }}>check_circle</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#11722d', marginBottom: 3 }}>
                  Tagihan Bulan Ini Sudah Lunas!
                </div>
                <div style={{ fontSize: '0.84rem', color: '#165e27', lineHeight: 1.4 }}>
                  Terima kasih atas pembayaran Anda. Layanan internet Anda aktif. Anda dapat langsung membayar tagihan untuk bulan berikutnya di bawah ini.
                </div>
              </div>
            </div>
          )}

          {/* Billing Card */}
          <div className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tagihan Periode {billing.periode} {isPaidThisMonth ? '(Bulan Berikutnya)' : ''}
              </span>
              <span className={`status-badge ${billing.status === 'menunggu_verifikasi' ? 'abu' : (billing.status_tagihan === 'kuning' ? 'kuning' : (billing.status_tagihan === 'merah' ? 'merah' : (isPaidThisMonth ? 'kuning' : 'hijau')))}`}>
                {billing.status === 'menunggu_verifikasi' ? 'Verifikasi Pending' : (billing.status_tagihan === 'kuning' ? 'Jatuh Tempo' : (billing.status_tagihan === 'merah' ? 'Menunggak' : (isPaidThisMonth ? 'Belum Bayar (Berikutnya)' : 'Belum Bayar')))}
              </span>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '8px 0', color: 'var(--md-primary)', letterSpacing: '-1px' }}>
              Rp {Number(billing.nominal).toLocaleString('id-ID')}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--md-on-surface-variant)' }}>
                Batas Jatuh Tempo: <strong style={{ color: 'var(--md-on-surface)' }}>{new Date(billing.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>

              {billing.status !== 'menunggu_verifikasi' && (singleGatewayPayment || paymentMethod === 'midtrans' || paymentMethod === 'duitku') && (
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={isPayLoading}
                  style={{
                    background: 'var(--md-primary-container, #006876)',
                    color: 'var(--md-on-primary-container, #ffffff)',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '10px 22px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: isPayLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Open Sans', sans-serif",
                    boxShadow: '0 2px 8px rgba(0, 104, 118, 0.25)',
                    transition: 'all 0.2s ease',
                    opacity: isPayLoading ? 0.7 : 1
                  }}
                  onMouseEnter={function (e) {
                    if (!isPayLoading) e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={function (e) {
                    if (!isPayLoading) e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {isPayLoading ? (
                    <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Menghubungkan...</>
                  ) : (
                    <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>{payIcon}</span> Bayar Sekarang</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Payment Method */}
          {billing.status !== 'menunggu_verifikasi' && !singleGatewayPayment && (
            <div className="portal-card">
              <div className="portal-card-header">
                <span className="portal-card-title">
                  <span className="material-symbols-outlined">payments</span> Metode Pembayaran
                </span>
              </div>

              {paymentOptions.length > 1 ? (
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
              ) : selectedOpt ? (
                <div style={{ ...dropdownStyles.container, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--md-surface-container-low)', borderRadius: 'var(--radius-md)' }}>
                  {renderOptionIcon(selectedOpt)}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>{selectedOpt.label}</div>
                    {selectedOpt.sublabel && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--md-on-surface-variant)' }}>{selectedOpt.sublabel}</div>
                    )}
                  </div>
                </div>
              ) : null}

              {renderPaymentDetail(true)}
            </div>
          )}


          {/* Upload Proof */}
          {paymentMethod !== 'midtrans' && paymentMethod !== 'duitku' && (
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
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            padding: '4px 2px'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--md-on-surface-variant)', fontWeight: 600 }}>
              Menampilkan {paymentHistory.length} catatan riwayat pembayaran
            </span>
            <button
              type="button"
              onClick={handleClearAllPayments}
              disabled={clearingHistory}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#dc2626',
                background: '#fff1f2',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                cursor: clearingHistory ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.08)'
              }}
              onMouseEnter={function (e) { e.currentTarget.style.background = '#ffe4e6'; }}
              onMouseLeave={function (e) { e.currentTarget.style.background = '#fff1f2'; }}
              title="Hapus semua riwayat pembayaran dari portal Anda"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
              {clearingHistory ? 'Membersihkan...' : 'Hapus Semua Riwayat'}
            </button>
          </div>

          {paymentHistory.map(function (pay) {
            var isOnline = pay.bukti_file.startsWith('Midtrans') || pay.bukti_file.startsWith('Duitku');
            var paymentUrl = isOnline ? '#' : `${API_BASE_URL}${pay.bukti_file}`;
            var badgeClass = pay.status === 'diterima' ? 'hijau' : (pay.status === 'ditolak' ? 'merah' : 'kuning');
            var statusText = pay.status === 'diterima' ? 'Lunas / Disetujui' : (pay.status === 'ditolak' ? 'Ditolak' : 'Menunggu Verifikasi');
            var getOnlineDesc = function (fileStr) {
              if (!fileStr) return 'Pembayaran Online Instan';
              var parts = fileStr.split(' / ');
              var gateway = parts[0] || 'Online';
              var code = (parts[1] || '').trim();
              var map = {
                'BC': 'Bank BCA VA',
                'M2': 'Bank Mandiri VA',
                'BR': 'Bank BRI VA',
                'I1': 'Bank BNI VA',
                'BV': 'Bank BSI (Syariah) VA',
                'NC': 'Bank Neo Commerce VA',
                'AG': 'Bank Artha Graha VA',
                'SP': 'Bank Sahabat Sampoerna VA / ShopeePay',
                'LQ': 'QRIS Real-Time',
                'OV': 'OVO',
                'DA': 'DANA',
                'LA': 'LinkAja',
                'IR': 'Indomaret',
                'FT': 'Retail / Alfamart',
                'VC': 'Kartu Kredit / Debit',
                'bank_transfer': 'Virtual Account (VA)',
                'echannel': 'Bank Mandiri VA',
                'bca': 'Bank BCA VA',
                'bni': 'Bank BNI VA',
                'bri': 'Bank BRI VA',
                'permata': 'Bank Permata VA',
                'cimb': 'Bank CIMB Niaga VA',
                'qris': 'QRIS Real-Time',
                'gopay': 'GoPay',
                'shopeepay': 'ShopeePay',
                'cstore': 'Minimarket (Indomaret/Alfamart)',
                'credit_card': 'Kartu Kredit'
              };
              var channel = map[code] || map[code.toLowerCase()] || code;
              return 'Pembyaran Lunas';
            };
            var onlineLabel = getOnlineDesc(pay.bukti_file);

            return (
              <div key={pay.id_pembayaran} className="portal-card" style={{ padding: 24, marginBottom: 0 }}>
                <div style={{ display: 'flex', borderBottom: 'none', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
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

                <div style={{
                  marginTop: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--md-outline-variant)',
                  paddingTop: 16,
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div>
                    {isOnline ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--status-hijau)', fontWeight: 700 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span> {onlineLabel}
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

                  <button
                    type="button"
                    onClick={function () { handleDeletePayment(pay.id_pembayaran); }}
                    disabled={deletingPaymentId === pay.id_pembayaran}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#dc2626',
                      background: 'rgba(220, 38, 38, 0.05)',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: deletingPaymentId === pay.id_pembayaran ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={function (e) { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.12)'; }}
                    onMouseLeave={function (e) { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)'; }}
                    title="Hapus riwayat pembayaran ini"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    {deletingPaymentId === pay.id_pembayaran ? 'Menghapus...' : 'Hapus'}
                  </button>
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
        .portal-hero-atlantis { background: var(--primary-dark, #004e5a); padding: 40px 48px 70px 48px; color: white; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; box-shadow: 0px 4px 20px rgba(0,75,122,0.08); border-radius: 0; }
        .portal-hero-atlantis h2 { font-size: 2.1rem; font-weight: 800; color: #ffffff; margin-bottom: 6px; letter-spacing: -0.02em; }
        .portal-hero-atlantis p { color: rgba(255, 255, 255, 0.82); max-width: 600px; line-height: 1.5; font-size: 0.95rem; }
        .portal-content-area { padding: 32px 48px; max-width: 1100px; width: 100%; margin: -25px auto 0; flex: 1; position: relative; z-index: 10; }
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
          .portal-hero-atlantis { padding: 30px 20px 65px 20px; }
          .portal-content-area { padding: 20px 16px; margin-top: -20px; }
        }
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ============================== */}
      {/* Duitku Payment Modal (Midtrans Snap Replica UI) */}
      {/* ============================== */}
      {duitkuModalOpen && (
        <div
          onClick={function (e) { if (e.target === e.currentTarget && !duitkuLoading) setDuitkuModalOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', animation: 'snapFadeIn 0.2s ease-out',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          }}
        >
          <style>{`
            @keyframes snapFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes snapSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .snap-modal-card, .snap-modal-card * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol" !important; box-sizing: border-box; }
            .snap-modal-card { background: #ffffff; border-radius: 8px; width: 100%; max-width: 390px; box-shadow: 0 16px 48px rgba(0,0,0,0.3); animation: snapSlideUp 0.22s cubic-bezier(0.16,1,0.3,1); overflow: hidden; max-height: 92vh; display: flex; flex-direction: column; position: relative; }
            .snap-test-ribbon { position: absolute; top: 16px; right: -32px; transform: rotate(45deg); background: #ffe600; color: #000000; font-weight: 800; font-size: 11px; padding: 2px 36px; letter-spacing: 0.8px; box-shadow: 0 1px 4px rgba(0,0,0,0.25); z-index: 30; pointer-events: none; }
            .snap-item-row { padding: 13px 20px; border-bottom: 1px solid #f2f2f2; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.12s ease; background: #ffffff; text-decoration: none; color: inherit; }
            .snap-item-row:hover { background: #f9fafb; }
            .snap-item-row:active { background: #f3f4f6; }
            .snap-sub-item { padding: 11px 20px 11px 32px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: #f8fafc; transition: background 0.12s ease; }
            .snap-sub-item:hover { background: #f1f5f9; }
            .snap-sub-item:active { background: #e2e8f0; }
            .snap-badge-gopay { display: inline-flex; align-items: center; background: #00aed6; color: #fff; font-weight: 800; font-size: 10px; padding: 1px 6px; border-radius: 3px; line-height: 1.3; }
            .snap-badge-gopay-later { display: inline-flex; align-items: center; gap: 2px; background: #00aed6; color: #fff; font-weight: 800; font-size: 9px; padding: 1px 5px; border-radius: 3px; line-height: 1.3; }
            .snap-badge-qris { display: inline-flex; align-items: center; border: 1px solid #2e384d; color: #2e384d; font-weight: 900; font-size: 9px; padding: 0 4px; border-radius: 2px; letter-spacing: -0.3px; line-height: 1.3; }
            .snap-badge-bank { font-weight: 800; font-size: 10.5px; line-height: 1.3; }
            .snap-copy-btn { border: none; background: none; cursor: pointer; color: #0070ba; display: inline-flex; align-items: center; padding: 0 4px; font-size: 13px; }
            .snap-copy-btn:hover { color: #005a9c; }
            .snap-spin { animation: spin 0.8s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>

          <div className="snap-modal-card">
            {/* Top TEST Ribbon */}
            <div className="snap-test-ribbon">TEST</div>

            {/* Header: Merchant Title + Close */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#2e384d', letterSpacing: '-0.2px' }}>
                KP Lintas Data Multimedia
              </div>
              {!duitkuLoading && (
                <button
                  onClick={function () { setDuitkuModalOpen(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7f8fa4', display: 'flex', alignItems: 'center', padding: 2, lineHeight: 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e384d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>

            {/* Order Summary Box (Light Blue/Grey background) */}
            <div style={{ background: '#f7f9fa', padding: '14px 20px', borderBottom: '1px solid #eef2f5', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '21px', fontWeight: 700, color: '#2e384d', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                      Rp{billing ? Number(billing.nominal).toLocaleString('id-ID') : '0'}
                    </span>
                    <button
                      type="button"
                      className="snap-copy-btn"
                      title="Salin nominal"
                      onClick={function () { handleCopyText(String(billing ? billing.nominal : '0'), 'nominal'); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '11px', color: '#7f8fa4', fontWeight: 400 }}>
                      Order ID #{duitkuOrderId || ('TRX-' + (billing ? billing.id_tagihan : '0') + '-' + Date.now().toString().slice(-6))}
                    </span>
                    <button
                      type="button"
                      className="snap-copy-btn"
                      title="Salin Order ID"
                      onClick={function () { handleCopyText(duitkuOrderId, 'orderId'); }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Details Accordion Trigger */}
                <button
                  type="button"
                  onClick={function () { setDuitkuDetailsOpen(!duitkuDetailsOpen); }}
                  style={{ background: 'none', border: 'none', color: '#0070ba', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 0' }}
                >
                  Details
                  <span style={{ fontSize: '10px' }}>{duitkuDetailsOpen ? '▲' : '▼'}</span>
                </button>
              </div>

              {/* Copied Feedback Tip */}
              {copiedTip && (
                <div style={{ fontSize: '10px', color: '#059669', fontWeight: 700, marginTop: 4 }}>
                  ✓ {copiedTip === 'nominal' ? 'Nominal' : 'Order ID'} disalin ke clipboard!
                </div>
              )}

              {/* Details Drawer */}
              {duitkuDetailsOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1', fontSize: '11.5px', color: '#2e384d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#7f8fa4' }}>Periode Tagihan:</span>
                    <span style={{ fontWeight: 600 }}>{billing && billing.periode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#7f8fa4' }}>Nama Pelanggan:</span>
                    <span style={{ fontWeight: 600 }}>{profileData ? profileData.nama : (customer ? customer.nama : 'Pelanggan')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#7f8fa4' }}>Paket WiFi:</span>
                    <span style={{ fontWeight: 600 }}>{billing && billing.paket ? billing.paket : 'Internet Unlimited'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0', fontWeight: 700 }}>
                    <span>Total Pembayaran:</span>
                    <span style={{ color: '#2e384d' }}>Rp{billing ? Number(billing.nominal).toLocaleString('id-ID') : '0'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Countdown Notice Bar */}
            <div style={{ background: '#eaedf2', padding: '6px 16px', textAlign: 'center', fontSize: '11px', color: '#556271', fontWeight: 500, flexShrink: 0 }}>
              Choose within {formatCountdown(countdown)}
            </div>

            {/* Methods Body List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {duitkuChannelsLoading && (
                <div style={{ padding: '18px', textAlign: 'center', color: '#7f8fa4', fontSize: '12px' }}>
                  <span className="material-symbols-outlined snap-spin" style={{ fontSize: 18, color: '#0070ba', display: 'block', margin: '0 auto 6px' }}>progress_activity</span>
                  Memuat saluran pembayaran...
                </div>
              )}

              {/* 1. Recommended payment method */}
              <div style={{ fontSize: '12px', color: '#7f8fa4', padding: '12px 20px 4px 20px', fontWeight: 400 }}>
                Recommended payment method
              </div>
              <div
                className="snap-item-row"
                onClick={function () { if (!duitkuLoading) handleDuitkuPay('LQ'); }}
                style={{ opacity: duitkuLoading && duitkuSelectedChannel !== 'LQ' ? 0.6 : 1 }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>GoPay QRIS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className="snap-badge-gopay">● gopay</span>
                    <span className="snap-badge-gopay-later">gopay <span style={{ color: '#fedd00', fontSize: 8 }}>later</span></span>
                    <span className="snap-badge-qris">QRIS</span>
                  </div>
                </div>
                {duitkuLoading && duitkuSelectedChannel === 'LQ' ? (
                  <span className="material-symbols-outlined snap-spin" style={{ fontSize: 18, color: '#0070ba' }}>progress_activity</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </div>

              {/* 2. All payment methods */}
              <div style={{ fontSize: '12px', color: '#7f8fa4', padding: '14px 20px 4px 20px', borderTop: '1px solid #f0f0f0', fontWeight: 400 }}>
                All payment methods
              </div>

              {/* Item: GoPay QRIS */}
              <div
                className="snap-item-row"
                onClick={function () { if (!duitkuLoading) handleDuitkuPay('LQ'); }}
                style={{ opacity: duitkuLoading && duitkuSelectedChannel !== 'LQ' ? 0.6 : 1 }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>GoPay QRIS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className="snap-badge-gopay">● gopay</span>
                    <span className="snap-badge-gopay-later">gopay <span style={{ color: '#fedd00', fontSize: 8 }}>later</span></span>
                    <span className="snap-badge-qris">QRIS</span>
                  </div>
                </div>
                {duitkuLoading && duitkuSelectedChannel === 'LQ' ? (
                  <span className="material-symbols-outlined snap-spin" style={{ fontSize: 18, color: '#0070ba' }}>progress_activity</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </div>

              {/* Item: Virtual account (Expandable Accordion) */}
              <div>
                <div
                  className="snap-item-row"
                  onClick={function () { setDuitkuExpandedCategory(duitkuExpandedCategory === 'va' ? null : 'va'); }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>Virtual account</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span className="snap-badge-bank" style={{ color: '#005baa' }}>BCA</span>
                      <span className="snap-badge-bank" style={{ color: '#003d79' }}>mandiri</span>
                      <span className="snap-badge-bank" style={{ color: '#e0592a' }}>BNI</span>
                      <span className="snap-badge-bank" style={{ color: '#00529c' }}>BANK BRI</span>
                      <span className="snap-badge-bank" style={{ color: '#00a39d' }}>PermataBank</span>
                      <span style={{ fontSize: '11px', color: '#7f8fa4', fontWeight: 600 }}>+6</span>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: duitkuExpandedCategory === 'va' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                {/* Sub-list of Virtual Accounts */}
                {duitkuExpandedCategory === 'va' && (
                  <div>
                    {[
                      { code: 'BC', name: 'BCA Virtual Account', logoColor: '#005baa', logoText: 'BCA', img: 'https://images.duitku.com/hotlink-ok/BCA.SVG' },
                      { code: 'M2', name: 'Mandiri Bill / VA', logoColor: '#003d79', logoText: 'mandiri', img: 'https://images.duitku.com/hotlink-ok/MV.PNG' },
                      { code: 'BR', name: 'BRI Virtual Account', logoColor: '#00529c', logoText: 'BANK BRI', img: 'https://images.duitku.com/hotlink-ok/BR.PNG' },
                      { code: 'I1', name: 'BNI Virtual Account', logoColor: '#e0592a', logoText: 'BNI', img: 'https://images.duitku.com/hotlink-ok/I1.PNG' },
                      { code: 'BV', name: 'BSI (Bank Syariah) VA', logoColor: '#00a39d', logoText: 'BSI', img: 'https://images.duitku.com/hotlink-ok/BSI.PNG' },
                      { code: 'NC', name: 'BNC (Neo Commerce) VA', logoColor: '#ffba00', logoText: 'BNC', img: 'https://images.duitku.com/hotlink-ok/NC.PNG' },
                      { code: 'AG', name: 'Bank Artha Graha VA', logoColor: '#1e3a8a', logoText: 'AG', img: 'https://images.duitku.com/hotlink-ok/AG.PNG' },
                      { code: 'SP', name: 'Bank Sahabat Sampoerna VA', logoColor: '#b91c1c', logoText: 'Sampoerna', img: 'https://images.duitku.com/hotlink-ok/SP.PNG' }
                    ].map(function (bank) {
                      var isProcessing = duitkuLoading && duitkuSelectedChannel === bank.code;
                      return (
                        <div
                          key={bank.code}
                          className="snap-sub-item"
                          onClick={function () { if (!duitkuLoading) handleDuitkuPay(bank.code); }}
                          style={{ opacity: duitkuLoading && !isProcessing ? 0.6 : 1 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 44, height: 26, background: '#ffffff', borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px' }}>
                              {bank.img ? (
                                <img src={bank.img} alt={bank.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={function (e) { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <span style={{ fontWeight: 800, fontSize: 10, color: bank.logoColor }}>{bank.logoText}</span>
                              )}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#2e384d' }}>{bank.name}</span>
                          </div>
                          {isProcessing ? (
                            <span className="material-symbols-outlined snap-spin" style={{ fontSize: 16, color: '#0070ba' }}>progress_activity</span>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Item: Card Payment */}
              <div
                className="snap-item-row"
                onClick={function () { if (!duitkuLoading) handleDuitkuPay('VC'); }}
                style={{ opacity: duitkuLoading && duitkuSelectedChannel !== 'VC' ? 0.6 : 1 }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>Card Payment</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ color: '#1a1f71', fontWeight: 900, fontStyle: 'italic', fontSize: 11 }}>VISA</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#eb001b', display: 'inline-block' }}></span>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f79e1b', display: 'inline-block', marginLeft: -4 }}></span>
                    </span>
                    <span style={{ color: '#007940', fontWeight: 800, fontSize: 10 }}>JCB</span>
                    <span style={{ background: '#006fcf', color: 'white', fontWeight: 800, fontSize: 8, padding: '1px 3px', borderRadius: 2 }}>AMEX</span>
                  </div>
                </div>
                {duitkuLoading && duitkuSelectedChannel === 'VC' ? (
                  <span className="material-symbols-outlined snap-spin" style={{ fontSize: 18, color: '#0070ba' }}>progress_activity</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </div>

              {/* Item: ShopeePay QRIS */}
              <div
                className="snap-item-row"
                onClick={function () { if (!duitkuLoading) handleDuitkuPay('SP'); }}
                style={{ opacity: duitkuLoading && duitkuSelectedChannel !== 'SP' ? 0.6 : 1 }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>ShopeePay QRIS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ color: '#ee4d2d', fontWeight: 800, fontSize: 10 }}>ShopeePay</span>
                    <span style={{ color: '#ee4d2d', fontWeight: 700, fontSize: 9 }}>SPayLater</span>
                    <span className="snap-badge-qris">QRIS</span>
                  </div>
                </div>
                {duitkuLoading && duitkuSelectedChannel === 'SP' ? (
                  <span className="material-symbols-outlined snap-spin" style={{ fontSize: 18, color: '#0070ba' }}>progress_activity</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </div>

              {/* Item: Convenience Store (Minimarket) */}
              <div>
                <div
                  className="snap-item-row"
                  onClick={function () { setDuitkuExpandedCategory(duitkuExpandedCategory === 'cstore' ? null : 'cstore'); }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>Convenience Store</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ color: '#00479b', fontWeight: 800, fontSize: 10 }}>Indomaret</span>
                      <span style={{ color: '#e11e26', fontWeight: 800, fontSize: 10 }}>Alfamart / Retail</span>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: duitkuExpandedCategory === 'cstore' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                {duitkuExpandedCategory === 'cstore' && (
                  <div>
                    {[
                      { code: 'IR', name: 'Indomaret', img: 'https://images.duitku.com/hotlink-ok/IR.PNG' },
                      { code: 'FT', name: 'Retail / Alfamart / Pos', img: 'https://images.duitku.com/hotlink-ok/RETAIL.PNG' }
                    ].map(function (store) {
                      var isProcessing = duitkuLoading && duitkuSelectedChannel === store.code;
                      return (
                        <div
                          key={store.code}
                          className="snap-sub-item"
                          onClick={function () { if (!duitkuLoading) handleDuitkuPay(store.code); }}
                          style={{ opacity: duitkuLoading && !isProcessing ? 0.6 : 1 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 44, height: 26, background: '#ffffff', borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px' }}>
                              <img src={store.img} alt={store.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={function (e) { e.currentTarget.style.display = 'none'; }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#2e384d' }}>{store.name}</span>
                          </div>
                          {isProcessing ? (
                            <span className="material-symbols-outlined snap-spin" style={{ fontSize: 16, color: '#0070ba' }}>progress_activity</span>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Item: Other E-Wallets */}
              <div>
                <div
                  className="snap-item-row"
                  onClick={function () { setDuitkuExpandedCategory(duitkuExpandedCategory === 'ewallet' ? null : 'ewallet'); }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#2e384d' }}>Other E-Wallets</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ color: '#4c2a86', fontWeight: 800, fontSize: 10 }}>OVO</span>
                      <span style={{ color: '#118eea', fontWeight: 800, fontSize: 10 }}>DANA</span>
                      <span style={{ color: '#e31b23', fontWeight: 800, fontSize: 10 }}>LinkAja</span>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: duitkuExpandedCategory === 'ewallet' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                {duitkuExpandedCategory === 'ewallet' && (
                  <div>
                    {[
                      { code: 'OV', name: 'OVO E-Wallet', img: 'https://images.duitku.com/hotlink-ok/OV.PNG' },
                      { code: 'DA', name: 'DANA E-Wallet', img: 'https://images.duitku.com/hotlink-ok/DA.PNG' },
                      { code: 'LA', name: 'LinkAja E-Wallet', img: 'https://images.duitku.com/hotlink-ok/LINKAJA.PNG' }
                    ].map(function (ew) {
                      var isProcessing = duitkuLoading && duitkuSelectedChannel === ew.code;
                      return (
                        <div
                          key={ew.code}
                          className="snap-sub-item"
                          onClick={function () { if (!duitkuLoading) handleDuitkuPay(ew.code); }}
                          style={{ opacity: duitkuLoading && !isProcessing ? 0.6 : 1 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 44, height: 26, background: '#ffffff', borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px' }}>
                              <img src={ew.img} alt={ew.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={function (e) { e.currentTarget.style.display = 'none'; }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#2e384d' }}>{ew.name}</span>
                          </div>
                          {isProcessing ? (
                            <span className="material-symbols-outlined snap-spin" style={{ fontSize: 16, color: '#0070ba' }}>progress_activity</span>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7f8fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
            <img src={logoUrl} alt="Logo LDM" className="portal-sidebar-logo" />
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
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? 'var(--status-hijau)' : 'var(--status-merah)',
              border: message.type === 'success' ? '1px solid rgba(15, 157, 91, 0.2)' : '1px solid rgba(186, 26, 26, 0.2)',
              padding: '14px 16px', borderRadius: 'var(--radius-md)', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{message.type === 'success' ? 'check_circle' : 'error'}</span>
              {message.text}
            </div>
          )}

          {/* Rejected Payment Alert */}
          {lastPayment && lastPayment.status === 'ditolak' && activeTab === 'billing' && (
            <div style={{
              background: '#fef2f2',
              color: 'var(--status-merah)',
              border: '1px solid rgba(186, 26, 26, 0.2)',
              padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', lineHeight: 1.5,
              boxShadow: '0 4px 12px rgba(186, 26, 26, 0.05)'
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

      {/* Manual Payment Pop-up Modal (QRIS & Bank Transfer) */}
      {manualModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--md-surface-container-lowest, #ffffff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            border: '1px solid var(--md-outline-variant)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--md-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--md-surface-container-low)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {paymentMethod === 'qris' ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--md-primary)' }}>qr_code_2</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--md-primary)' }}>account_balance</span>
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--md-on-surface)' }}>
                    {paymentMethod === 'qris' ? 'Pembayaran via QRIS' : 'Transfer Bank Pembayaran'}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--md-on-surface-variant)' }}>
                    {paymentMethod === 'qris' ? 'Scan dengan m-Banking / E-Wallet' : 'Nomor rekening resmi ISP Lintas Data'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={function () { setManualModalOpen(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.4rem',
                  color: 'var(--md-on-surface-variant)',
                  lineHeight: 1,
                  padding: 4
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Total Tagihan Card */}
              <div style={{
                background: 'rgba(0, 104, 118, 0.06)',
                border: '1px solid rgba(0, 104, 118, 0.15)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--md-outline)', textTransform: 'uppercase', fontWeight: 700 }}>Total Tagihan ({billing ? billing.periode : ''})</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--md-primary)' }}>
                    Rp {billing ? Number(billing.nominal).toLocaleString('id-ID') : '0'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={function () {
                    navigator.clipboard.writeText(String(billing ? billing.nominal : '0'));
                    setCopiedTip('nominal');
                    setTimeout(function () { setCopiedTip(''); }, 2000);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--md-primary)',
                    background: 'transparent',
                    color: 'var(--md-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {copiedTip === 'nominal' ? 'check' : 'content_copy'}
                  </span>
                  {copiedTip === 'nominal' ? 'Tersalin' : 'Salin'}
                </button>
              </div>

              {/* QRIS Content */}
              {paymentMethod === 'qris' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: 14,
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    border: '1px solid var(--md-outline-variant)',
                    marginBottom: 14
                  }}>
                    <img
                      src={qrisUrl}
                      alt="QRIS Code"
                      style={{ width: 230, height: 230, display: 'block', objectFit: 'contain', margin: '0 auto' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: 4 }}>
                    Scan QRIS di atas untuk membayar
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.4, marginBottom: 16 }}>
                    Mendukung BCA Mobile, Mandiri Livin, BRImo, BNI Mobile, GoPay, OVO, Dana, LinkAja, ShopeePay, dan semua aplikasi perbankan berstandar QRIS.
                  </div>

                  <div style={{
                    background: 'var(--md-surface-container-low)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    color: 'var(--md-on-surface-variant)',
                    lineHeight: 1.5,
                    border: '1px solid var(--md-outline-variant)'
                  }}>
                    <strong style={{ color: 'var(--md-on-surface)', display: 'block', marginBottom: 4 }}>Petunjuk Pembayaran:</strong>
                    1. Buka aplikasi m-Banking atau E-Wallet pilihan Anda.<br />
                    2. Pilih menu <strong>Scan / Bayar QRIS</strong> dan arahkan kamera ke kode di atas.<br />
                    3. Periksa nama penerima (<strong>PT Lintas Data Multimedia</strong>) dan pastikan nominal sesuai.<br />
                    4. Konfirmasi pembayaran dan simpan bukti transfer untuk diunggah di portal ini.
                  </div>
                </div>
              )}

              {/* Bank Transfer Content */}
              {paymentMethod && paymentMethod.startsWith('bank_') && (function () {
                var accId = parseInt(paymentMethod.replace('bank_', ''), 10);
                var acc = bankAccounts.find(function (a) { return a.id === accId; });
                if (!acc) return null;
                var bankLogo = getBankLogo(acc.nama_bank);

                return (
                  <div>
                    <div style={{
                      background: 'var(--md-surface-container-low)',
                      border: '1px solid var(--md-outline-variant)',
                      borderRadius: '12px',
                      padding: '18px',
                      textAlign: 'center',
                      marginBottom: 16
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                        {bankLogo ? (
                          <img src={bankLogo} alt={acc.nama_bank} style={{ height: 32, objectFit: 'contain' }} />
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-primary)' }}>account_balance</span>
                        )}
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--md-on-surface)' }}>
                          {acc.nama_bank}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--md-outline)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
                        Nomor Rekening Tujuan
                      </div>
                      <div style={{
                        fontSize: '1.45rem',
                        fontWeight: 800,
                        letterSpacing: '1px',
                        color: 'var(--md-primary)',
                        marginBottom: 6,
                        userSelect: 'all'
                      }}>
                        {acc.nomor_rekening}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--md-on-surface)', fontWeight: 600, marginBottom: 14 }}>
                        a/n {acc.atas_nama}
                      </div>

                      <button
                        type="button"
                        onClick={function () {
                          navigator.clipboard.writeText(acc.nomor_rekening);
                          setCopiedRekening(acc.id);
                          setTimeout(function () { setCopiedRekening(false); }, 2000);
                        }}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          background: copiedRekening === acc.id ? 'var(--status-hijau)' : 'var(--md-primary)',
                          color: 'white',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {copiedRekening === acc.id ? 'check' : 'content_copy'}
                        </span>
                        {copiedRekening === acc.id ? 'Nomor Rekening Tersalin!' : 'Salin Nomor Rekening'}
                      </button>
                    </div>

                    <div style={{
                      background: 'var(--md-surface-container-low)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '0.75rem',
                      color: 'var(--md-on-surface-variant)',
                      lineHeight: 1.5,
                      border: '1px solid var(--md-outline-variant)'
                    }}>
                      <strong style={{ color: 'var(--md-on-surface)', display: 'block', marginBottom: 4 }}>Petunjuk Transfer:</strong>
                      1. Buka aplikasi m-Banking, i-Banking, atau kunjungi ATM {acc.nama_bank}.<br />
                      2. Masukkan nomor rekening di atas dan nominal sesuai total tagihan.<br />
                      3. Pastikan nama penerima <strong>{acc.atas_nama}</strong>.<br />
                      4. Simpan bukti transfer (struk/screenshot), lalu unggah pada form di bawah.
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--md-outline-variant)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--md-surface-container-low)'
            }}>
              <button
                type="button"
                onClick={function () { setManualModalOpen(false); }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--md-primary)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                Mengerti & Upload Bukti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerPortalPage;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSplineScene from '../components/landing/HeroSplineScene';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';

function LandingPage({ customer, onLogout }) {
  var navigate = useNavigate();
  var { logoUrl } = useLogo();
  var isLoggedIn = !!customer;
  var [openFaq, setOpenFaq] = useState(0);
  var [showLoginPopup, setShowLoginPopup] = useState(false);
  var [isAtTop, setIsAtTop] = useState(true);

  var [windowWidth, setWindowWidth] = useState(window.innerWidth);

  var [searchQuery, setSearchQuery] = useState('');
  var [searchLoading, setSearchLoading] = useState(false);
  var [searchResult, setSearchResult] = useState(null);
  var [searchError, setSearchError] = useState('');

  var handleCheckBilling = async function (e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchError('Silakan masukkan nomor HP atau username PPPoE.');
      setSearchResult(null);
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);

    try {
      var response = await axios.get(`${API_BASE_URL}/api/customer/portal/check-billing?query=${encodeURIComponent(searchQuery.trim())}`);
      if (response.data.success) {
        setSearchResult(response.data.data);
      }
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Gagal memeriksa tagihan. Silakan coba beberapa saat lagi.');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(function () {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return function () {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  var showSpline = windowWidth > 1024;
  var isMobile = windowWidth <= 768;

  useEffect(function () {
    // Scroll-reveal observer
    var sections = document.querySelectorAll('.reveal-on-scroll');
    if (!sections.length || typeof IntersectionObserver === 'undefined') {
      sections.forEach(function (section) { section.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    sections.forEach(function (section) { observer.observe(section); });

    // Navbar scroll shadow + track position
    function handleScroll() {
      var nav = document.querySelector('.landing-nav');
      if (nav) {
        if (window.scrollY > 50) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
      }
      setIsAtTop(window.scrollY < 100);
    }
    window.addEventListener('scroll', handleScroll);

    return function () {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  function handlePaymentClick() {
    if (isLoggedIn) {
      navigate('/portal');
    } else {
      setShowLoginPopup(true);
    }
  }

  function handleLoginClick() {
    if (isLoggedIn) {
      navigate('/portal');
    } else {
      navigate('/login');
    }
  }

  function toggleFaq(index) {
    setOpenFaq(openFaq === index ? -1 : index);
  }

  var faqs = [
    { q: 'Apa saja paket internet yang tersedia di Lintas Data Multimedia?', a: 'Kami menyediakan berbagai paket mulai dari 10 Mbps hingga 100 Mbps, termasuk paket khusus gamer. Semua paket dilengkapi dengan Unlimited tanpa FUP, dukungan 24/7, dan instalasi gratis.' },
    { q: 'Bagaimana cara pemesanan layanan internet?', a: 'Anda dapat memesan melalui website kami, telepon, atau kunjungi kantor kami. Tim kami akan melakukan survei lokasi dan instalasi dalam waktu 1-3 hari kerja setelah konfirmasi pembayaran.' },
    { q: 'Apakah ada biaya instalasi?', a: 'Biaya instalasi sebesar Rp 350.000, namun saat ini kami memberikan promo instalasi gratis untuk semua paket baru. Pastikan untuk konfirmasi saat pemesanan.' },
    { q: 'Bagaimana dukungan teknis yang diberikan?', a: 'Dukungan teknis tersedia 24/7 melalui telepon, email, dan chat online. Tim ahli kami siap membantu troubleshooting, pemeliharaan, dan upgrade layanan kapan saja Anda butuhkan.' },
    { q: 'Wilayah layanan di mana saja?', a: 'Kami melayani wilayah Kota Surabaya (Surabaya Pusat, Surabaya Timur, Surabaya Selatan, Surabaya Barat, dan Surabaya Utara). Jika lokasi Anda belum tercakup, hubungi kami untuk informasi ketersediaan ekspansi layanan.' }
  ];

  var [packages, setPackages] = useState([
    { name: 'Paket 10 Mbps', speed: '10', price: '150.000', features: ['Kecepatan 10 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket 20 Mbps', speed: '20', price: '175.000', features: ['Kecepatan 20 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket 30 Mbps', speed: '30', price: '200.000', features: ['Kecepatan 30 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'], popular: true },
    { name: 'Paket 50 Mbps', speed: '50', price: '250.000', features: ['Kecepatan 50 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket 75 Mbps', speed: '75', price: '330.000', features: ['Kecepatan 75 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket Gamer 100 Mbps', speed: '100', price: '385.000', features: ['Kecepatan 100 Mbps', 'Unlimited tanpa FUP', 'Dukungan Prioritas 24/7', 'Instalasi Gratis'] }
  ]);

  useEffect(function () {
    async function fetchPackages() {
      try {
        var response = await axios.get(`${API_BASE_URL}/api/paket`);
        if (response.data.success) {
          var mapped = response.data.data.map(function (pkg, idx) {
            var featuresList = [];
            if (pkg.deskripsi) {
              featuresList = pkg.deskripsi.split(',').map(function (f) { return f.trim(); }).filter(Boolean);
            }

            if (featuresList.length === 0) {
              featuresList = [
                'Kecepatan ' + (pkg.kecepatan || '-'),
                'Unlimited tanpa FUP',
                'Dukungan 24/7',
                'Instalasi Gratis'
              ];
            }

            var formattedPrice = Number(pkg.harga || 0).toLocaleString('id-ID');

            return {
              id: pkg.id,
              name: pkg.nama_paket,
              speed: pkg.kecepatan || '',
              price: formattedPrice,
              features: featuresList,
              description: pkg.deskripsi || featuresList.join(', '),
              // popular: idx === 1 || pkg.nama_paket.toLowerCase().includes('30 mbps')
              popular: idx ===2
            };
          });
          setPackages(mapped);
        }
      } catch (err) {
        console.error('Gagal mengambil data paket real-time:', err);
      }
    }
    fetchPackages();
  }, []);

  function handleScrollToggle() {
    if (isAtTop) {
      // Gulir ke bawah — ke section pertama setelah hero
      var target = document.getElementById('layanan');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
      }
    } else {
      // Gulir ke atas
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="landing-page">
      {/* Navbar — fixed, blur, shadow on scroll */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <img src={logoUrl || '/logo_ldm.png'} alt="Logo LDM" className="landing-nav-logo" />
            <span className="landing-nav-title">PT. Lintas Data Multimedia</span>
          </div>
          <div className="landing-nav-menu">
            <a href="#layanan" className="landing-nav-link">Layanan</a>
            <a href="#harga" className="landing-nav-link">Harga</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
            <a href="#kontak" className="landing-nav-link">Hubungi Kami</a>
          </div>
          <div className="landing-nav-actions">
            {isLoggedIn ? (
              <>
                <span 
                  className="landing-nav-user" 
                  style={{ cursor: 'pointer' }}
                  onClick={function () { navigate('/portal', { state: { activeTab: 'profile' } }); }}
                  title="Lihat Profil Saya"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span> {isMobile ? 'Profil' : customer.nama}
                </span>
                <button className="landing-btn-outline landing-btn-outline--muted" onClick={onLogout}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span> {isMobile ? 'Keluar' : 'Keluar'}
                </button>
              </>
            ) : (
              <>
                <button className="landing-btn-primary" onClick={function () { navigate('/bayar'); }}>
                  <span className="material-symbols-outlined">login</span> {isMobile ? 'Login' : 'Login Pelanggan'}
                </button>
                <button className="landing-btn-outline landing-btn-register" onClick={function () { navigate('/registrasi'); }}>
                  {isMobile ? 'Daftar' : 'Registrasi'}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero" style={{
        padding: showSpline ? '160px 48px 100px' : '120px 24px 80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="landing-hero-bg-orb landing-hero-bg-orb--1"></div>
        <div className="landing-hero-bg-orb landing-hero-bg-orb--2"></div>
        <div className="landing-hero-bg-orb landing-hero-bg-orb--3"></div>

        <div className="landing-hero-inner" style={{
          display: 'flex',
          flexDirection: showSpline ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          gap: '40px',
          position: 'relative',
          zIndex: 5
        }}>
          <div className="landing-hero-content" style={{
            textAlign: showSpline ? 'left' : 'center',
            maxWidth: showSpline ? '620px' : '720px',
            margin: showSpline ? '0' : '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: showSpline ? 'flex-start' : 'center',
            flex: 1.2
          }}>
            <div className="landing-hero-badge">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span>
              Koneksi Tanpa Batas
            </div>
            <h1 className="landing-hero-title" style={{
              textAlign: showSpline ? 'left' : 'center'
            }}>
              Penyedia Layanan <span className="landing-hero-title--accent">Internet Terbaik</span> Untuk Anda
            </h1>
            <p className="landing-hero-subtitle" style={{
              margin: showSpline ? '0 0 36px 0' : '0 auto 36px',
              textAlign: showSpline ? 'left' : 'center'
            }}>
              Nikmati pengalaman browsing ultra-lancar dengan bandwidth yang disesuaikan khusus untuk kebutuhan rumah tangga dan bisnis profesional Anda.
            </p>
            <div className="landing-hero-actions" style={{
              justifyContent: showSpline ? 'flex-start' : 'center',
              width: '100%'
            }}>
              <a href="#harga" className="landing-btn-primary landing-btn-lg">
                <span className="material-symbols-outlined">arrow_forward</span> Mulai Sekarang
              </a>
              <button className="landing-btn-ghost landing-btn-lg" onClick={handlePaymentClick}>
                <span className="material-symbols-outlined">payments</span> Bayar Tagihan
              </button>
            </div>
            <div className="landing-hero-stats" style={{
              width: '100%',
              justifyContent: showSpline ? 'space-between' : 'center'
            }}>
              <div className="landing-stat">
                <div className="landing-stat-value">500+</div>
                <div className="landing-stat-label">Pelanggan Aktif</div>
              </div>
              <div className="landing-stat-divider"></div>
              <div className="landing-stat">
                <div className="landing-stat-value">99.9%</div>
                <div className="landing-stat-label">Uptime Jaringan</div>
              </div>
              <div className="landing-stat-divider"></div>
              <div className="landing-stat">
                <div className="landing-stat-value">24/7</div>
                <div className="landing-stat-label">Dukungan Teknis</div>
              </div>
            </div>
          </div>

          {/* Right side: 3D Spline Scene */}
          <div className="landing-hero-visual" style={{
            flex: showSpline ? 1 : 'none',
            width: showSpline ? 'auto' : '100%',
            maxWidth: showSpline ? 'none' : '450px',
            height: showSpline ? '520px' : '350px',
            position: 'relative',
            margin: showSpline ? '0' : '20px auto 0',
            display: 'block',
            pointerEvents: 'none'
          }}>
            <HeroSplineScene logoCoverColor="linear-gradient(to bottom, #fafbfc, #fbfcfd)" />
          </div>
        </div>
      </section>

      {/* Search Payment Section */}
      <section className="landing-check-billing reveal-on-scroll" style={{
        padding: isMobile ? '40px 16px' : '60px 24px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: 800, color: 'var(--md-on-surface)', marginBottom: '8px' }}>
              Cek Status Tagihan & Pembayaran
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
              Masukkan Nomor HP terdaftar atau Username PPPoE Anda untuk mengecek tagihan dan status pembayaran secara instan tanpa perlu masuk.
            </p>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: isMobile ? '16px' : '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            border: '1px solid var(--border-color)'
          }}>
            <form onSubmit={handleCheckBilling} style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              gap: '12px' 
            }}>
              <input
                type="text"
                placeholder="Masukkan Nomor HP (e.g. 08123...) atau Username PPPoE"
                value={searchQuery}
                onChange={function (e) { setSearchQuery(e.target.value); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  width: '100%'
                }}
                onFocus={function(e) { e.target.style.borderColor = 'var(--md-primary)'; }}
                onBlur={function(e) { e.target.style.borderColor = 'var(--border-color)'; }}
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="landing-btn-primary"
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: 'none',
                  width: isMobile ? '100%' : 'auto',
                  minWidth: '150px'
                }}
              >
                {searchLoading ? 'Memeriksa...' : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>
                    Cek Tagihan
                  </>
                )}
              </button>
            </form>

            {searchError && (
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#dc2626',
                fontSize: '0.88rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.3s ease'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
                {searchError}
              </div>
            )}

            {searchResult && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between', 
                  alignItems: isMobile ? 'flex-start' : 'center', 
                  marginBottom: '16px', 
                  gap: '8px' 
                }}>
                  <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                    Pelanggan: <strong style={{ color: 'var(--text-primary)' }}>{searchResult.nama}</strong>
                  </div>
                  <span className="status-badge" style={{
                    background: 'rgba(0, 104, 118, 0.08)',
                    color: 'var(--md-primary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    borderRadius: '20px'
                  }}>
                    Terdaftar
                  </span>
                </div>

                {searchResult.hasActiveBill ? (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: isMobile ? '16px' : '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '10px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Periode Tagihan</span>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{searchResult.tagihan.periode}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '10px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Jumlah Tagihan</span>
                      <span style={{ fontWeight: 700, color: 'var(--md-primary)', fontSize: '0.92rem' }}>
                        Rp {Number(searchResult.tagihan.nominal).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '10px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Batas Jatuh Tempo</span>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {new Date(searchResult.tagihan.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: isMobile ? 'flex-start' : 'center', 
                      flexDirection: isMobile ? 'column' : 'row', 
                      gap: '8px' 
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Status Pembayaran</span>
                      <span className={'status-badge ' + (searchResult.tagihan.status === 'proses' ? 'kuning' : 'merah')} style={{ fontSize: '0.78rem' }}>
                        {searchResult.tagihan.status === 'proses' ? 'Menunggu Verifikasi Admin' : 'Belum Bayar'}
                      </span>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="landing-btn-primary"
                        onClick={function() {
                          navigate('/login', { state: { email: searchResult.email } });
                        }}
                        style={{ 
                          padding: '10px 20px', 
                          borderRadius: '6px', 
                          fontSize: '0.85rem',
                          width: isMobile ? '100%' : 'auto',
                          justifyContent: 'center'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
                        Bayar Sekarang
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '10px',
                    padding: '24px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#22c55e',
                      marginBottom: '12px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 24, fontWeight: 'bold' }}>check</span>
                    </div>
                    <h4 style={{ color: '#166534', fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>Semua Tagihan Lunas!</h4>
                    <p style={{ color: '#166534', fontSize: '0.85rem', margin: 0 }}>
                      Terima kasih! Tidak ada tagihan pending untuk bulan ini. Koneksi internet Anda aktif.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Layanan Section */}
      <section className="landing-features reveal-on-scroll" id="layanan">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Solusi Konektivitas Digital</h2>
            <p className="landing-section-subtitle">Kami menghadirkan infrastruktur jaringan terkini untuk mendukung segala aktivitas digital Anda dengan performa maksimal.</p>
          </div>
          <div className="landing-features-grid landing-features-grid--4">
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--cyan">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>router</span>
              </div>
              <h3>Internet Broadband</h3>
              <p>Layanan internet cepat dan stabil untuk kebutuhan harian tanpa kuota, menggunakan teknologi fiber optic terdepan.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--green">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>wifi</span>
              </div>
              <h3>Solusi WiFi</h3>
              <p>Cakupan sinyal WiFi yang luas dan merata di setiap sudut ruangan Anda dengan keamanan tinggi.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--purple">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>security</span>
              </div>
              <h3>Keamanan Jaringan</h3>
              <p>Proteksi data tingkat tinggi untuk menjaga privasi digital Anda tetap aman dari ancaman cyber.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--orange">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>support_agent</span>
              </div>
              <h3>Dukungan Teknis</h3>
              <p>Tim ahli yang siap membantu Anda kapan saja untuk kendala teknis apapun, 24/7.</p>
            </div>
          </div>
        </div>
      </section>


      {/* Daftar Harga */}
      <section className="landing-pricing reveal-on-scroll" id="harga">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Pilih Paket Internet Anda</h2>
            <p className="landing-section-subtitle">Harga fleksibel dan kompetitif yang dirancang untuk mendukung gaya hidup digital Anda.</p>
          </div>
          <div className="landing-pricing-grid">
            {packages.map(function (pkg, idx) {
              var whatsappMessage = 'Halo, saya ingin mendaftar dan memesan paket internet berikut dari Lintas Data Multimedia:\n\n' +
                'Nama Paket: ' + pkg.name + '\n' +
                'Harga: Rp ' + pkg.price + '/bulan\n' +
                'Kecepatan: ' + (pkg.speed || '-') + '\n' +
                'Deskripsi: ' + (pkg.description || pkg.features.join(', '));
              return (
                <div className={'landing-pricing-card' + (pkg.popular ? ' landing-pricing-card--popular' : '')} key={idx}>
                  {pkg.popular && <div className="landing-pricing-badge">Terpopuler</div>}
                  <h3 className="landing-pricing-name">{pkg.name}</h3>
                  <div className="landing-pricing-price">
                    <span className="landing-pricing-currency">Rp</span>
                    <span className="landing-pricing-amount">{pkg.price}</span>
                    <span className="landing-pricing-period">/bulan</span>
                  </div>
                  <ul className="landing-pricing-features">
                    {pkg.features.map(function (f, i) {
                      return <li key={i}><span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--md-primary)' }}>check_circle</span> {f}</li>;
                    })}
                  </ul>
                  <a href={'https://wa.me/6285722422448?text=' + encodeURIComponent(whatsappMessage)} target="_blank" rel="noopener noreferrer" className={pkg.popular ? 'landing-btn-primary' : 'landing-btn-ghost'} style={{ width: '100%', justifyContent: 'center' }}>
                    Daftar dan Pesan Via WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
          <div className="landing-pricing-info">
            <p><strong>Wilayah Layanan:</strong> Kec. Genteng, Kec. Tegalsari, Kec. Gubeng, Kec. Sawahan, Kec. Wonokromo, Kec. Sukolilo, dan seluruh wilayah Kota Surabaya</p>
            <p><strong>Biaya Instalasi:</strong> <del>Rp 350.000</del> <span style={{ color: 'var(--md-primary)', fontWeight: 700 }}>(Gratis untuk semua paket)</span></p>
          </div>
        </div>
      </section>

      {/* CTA Daftar Sekarang */}
      {/* <section className="landing-cta reveal-on-scroll" id="daftar">
        <div className="landing-cta-inner">
          <div className="landing-cta-content">
            <h2>Daftar Sekarang</h2>
            <p>Bergabunglah dengan ratusan pelanggan puas Lintas Data Multimedia. Nikmati internet cepat tanpa batas dengan harga terjangkau dan instalasi gratis. Hubungi kami via WhatsApp untuk proses pendaftaran yang mudah dan cepat.</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a
                href="https://wa.me/6285722422448?text=Halo%2C%20saya%20ingin%20mendaftar%20layanan%20internet%20dari%20Lintas%20Data%20Multimedia."
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-primary landing-btn-lg"
              >
                <span className="material-symbols-outlined">chat</span> Daftar via WhatsApp
              </a>
              <a href="#kontak" className="landing-btn-ghost landing-btn-lg">
                <span className="material-symbols-outlined">info</span> Pelajari Lebih Lanjut
              </a>
            </div>
          </div>
          <div className="landing-cta-visual">
            <div className="landing-cta-card">
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Instalasi</span>
                <span className="landing-cta-card-badge--green">Gratis</span>
              </div>
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Kecepatan</span>
                <span className="landing-cta-card-value">Hingga 100 Mbps</span>
              </div>
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Mulai Dari</span>
                <span className="landing-cta-card-value landing-cta-card-value--bold">Rp 150.000/bln</span>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* FAQ */}
      <section className="landing-faq reveal-on-scroll" id="faq">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Pertanyaan Umum</h2>
            <p className="landing-section-subtitle">Temukan jawaban atas pertanyaan yang sering diajukan tentang layanan internet kami.</p>
          </div>
          <div className="landing-faq-list">
            {faqs.map(function (faq, idx) {
              return (
                <div className={'landing-faq-item' + (openFaq === idx ? ' landing-faq-item--open' : '')} key={idx} onClick={function () { toggleFaq(idx); }}>
                  <div className="landing-faq-question">
                    <span>{faq.q}</span>
                    <span className="material-symbols-outlined" style={{ transition: 'transform 0.3s', transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
                  </div>
                  {openFaq === idx && <div className="landing-faq-answer">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kontak */}
      <section className="landing-contact reveal-on-scroll" id="kontak">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Hubungi Kami</h2>
            <p className="landing-section-subtitle">Hubungi tim kami untuk informasi lebih lanjut tentang layanan internet atau untuk pemesanan paket.</p>
          </div>
          <div className="landing-contact-grid">
            <div className="landing-contact-item">
              <div className="landing-contact-icon"><span className="material-symbols-outlined">location_on</span></div>
              <h4>Alamat</h4>
              <p>Intiland Tower 11th Floor 3A Jl. Panglima Sudirman 101-103  Surabaya, Jawa Timur, Indonesia 60271</p>
            </div>
            <div className="landing-contact-item">
              <div className="landing-contact-icon"><span className="material-symbols-outlined">call</span></div>
              <h4>Telepon</h4>
              <p>(+6231) 33030088 / +62 857-2242-2448</p>
            </div>
            <div className="landing-contact-item">
              <div className="landing-contact-icon"><span className="material-symbols-outlined">mail</span></div>
              <h4>Email</h4>
              <p>helpdesk@ldm.net.id</p>
            </div>
          </div>
          <div className="landing-map">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3957.653427181313!2d112.74378777488344!3d-7.265215792736207!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd7f95d852a4175%3A0xf639962a98f1a5b8!2sIntiland%20Tower%20Surabaya!5e0!3m2!1sid!2sid!4v1721052800000!5m2!1sid!2sid"
              title="Lokasi PT Lintas Data Multimedia"
              style={{ border: 0, width: '100%', height: '300px', borderRadius: '5px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer reveal-on-scroll">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src={logoUrl || '/logo_ldm.png'} alt="Logo LDM" className="landing-footer-logo" />
            <p className="landing-footer-desc">PT. Lintas Data Multimedia — Membangun konektivitas masa depan untuk Indonesia yang lebih terintegrasi dan produktif.</p>
            <div className="landing-footer-social">
              <a href="https://www.facebook.com/share/172oaMU4xo/" target="_blank" rel="noopener noreferrer" className="landing-social-link"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>group</span></a>
              <a href="https://www.instagram.com/lintasdata_mm" target="_blank" rel="noopener noreferrer" className="landing-social-link"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span></a>
              <a href="https://www.tiktok.com/@lintas.data.multi" target="_blank" rel="noopener noreferrer" className="landing-social-link"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>videocam</span></a>
            </div>
          </div>
          <div className="landing-footer-links">
            <h4>Tautan Cepat</h4>
            <a href="#layanan">Layanan</a>
            <a href="#harga">Harga</a>
            <a href="#faq">FAQ</a>
            <a href="#kontak">Hubungi Kami</a>
          </div>
          <div className="landing-footer-links">
            <h4>Legal</h4>
            <a href="#kontak">Kebijakan Privasi</a>
            <a href="#kontak">Syarat & Ketentuan</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; {new Date().getFullYear()} PT. Lintas Data Multimedia. Seluruh Hak Cipta Dilindungi.</p>
        </div>
      </footer>

      {/* Scroll Toggle Button (atas / bawah) */}
      <button
        onClick={handleScrollToggle}
        title={isAtTop ? 'Gulir ke bawah' : 'Gulir ke atas'}
        style={{
          position: 'fixed', bottom: 32, right: 32, width: 56, height: 56,
          background: 'var(--md-primary)', color: 'white', borderRadius: '50%',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,104,118,0.3)', cursor: 'pointer',
          transition: 'all 0.3s ease', zIndex: 40
        }}
        onMouseEnter={function (e) { e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)'; }}
        onMouseLeave={function (e) { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
      >
        <span
          className="material-symbols-outlined"
          style={{ transition: 'transform 0.3s ease', display: 'block', transform: isAtTop ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          arrow_upward
        </span>
      </button>
      {/* Popup: Login Required */}
      {showLoginPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }} onClick={function () { setShowLoginPopup(false); }}>
          <div style={{
            background: '#fff', borderRadius: '5px',
            padding: '32px 28px', maxWidth: '400px', width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            textAlign: 'center', animation: 'slideUp 0.25s ease-out'
          }} onClick={function (e) { e.stopPropagation(); }}>
            <div style={{
              width: 56, height: 56,
              background: 'rgba(0,104,118,0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-primary)' }}>lock</span>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1a202c', marginBottom: 8 }}>Anda Belum Login</h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
              Silakan login terlebih dahulu untuk mengakses portal pembayaran dan melihat status tagihan Anda.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                style={{
                  padding: '10px 20px', borderRadius: '5px',
                  border: '1.5px solid #cbd5e1', background: 'transparent',
                  color: '#64748b', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif"
                }}
                onClick={function () { setShowLoginPopup(false); }}
              >
                Batal
              </button>
              <button
                style={{
                  padding: '10px 20px', borderRadius: '5px',
                  border: 'none', background: 'var(--md-primary)',
                  color: 'white', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: "'Open Sans', sans-serif"
                }}
                onClick={function () { setShowLoginPopup(false); navigate('/bayar'); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>login</span>
                Login Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;

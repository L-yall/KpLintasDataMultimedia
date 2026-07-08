import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TemplateIcon from '../components/TemplateIcon';

function LandingPage({ customer, onLogout }) {
  var navigate = useNavigate();
  var isLoggedIn = !!customer;
  var [openFaq, setOpenFaq] = useState(0);

  function handlePaymentClick() {
    if (isLoggedIn) {
      navigate('/portal');
    } else {
      navigate('/bayar');
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
    { q: 'Wilayah layanan di mana saja?', a: 'Kami melayani wilayah Pringsewu, Pagelaran, Sukoharjo, Kalirejo, Adiluwih, dan Banyumas. Jika lokasi Anda belum tercakup, hubungi kami untuk informasi ketersediaan ekspansi layanan.' }
  ];

  var packages = [
    { name: 'Paket 10 Mbps', price: '150.000', features: ['Kecepatan 10 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket 20 Mbps', price: '175.000', features: ['Kecepatan 20 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket 30 Mbps', price: '200.000', features: ['Kecepatan 30 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'], popular: true },
    { name: 'Paket 50 Mbps', price: '250.000', features: ['Kecepatan 50 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket 75 Mbps', price: '330.000', features: ['Kecepatan 75 Mbps', 'Unlimited tanpa FUP', 'Dukungan 24/7', 'Instalasi Gratis'] },
    { name: 'Paket Gamer 100 Mbps', price: '385.000', features: ['Kecepatan 100 Mbps', 'Unlimited tanpa FUP', 'Dukungan Prioritas 24/7', 'Instalasi Gratis'] }
  ];

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <img src={process.env.PUBLIC_URL + '/logo ldm.png'} alt="Logo LDM" className="landing-nav-logo" />
            <span className="landing-nav-title">LINTAS DATA MULTIMEDIA</span>
          </div>
          <div className="landing-nav-menu">
            <a href="#tentang" className="landing-nav-link">Tentang</a>
            <a href="#layanan" className="landing-nav-link">Layanan</a>
            <a href="#harga" className="landing-nav-link">Harga</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
            <a href="#kontak" className="landing-nav-link">Kontak</a>
          </div>
          <div className="landing-nav-actions">
            {isLoggedIn ? (
              <>
                <span className="landing-nav-user">
                  <TemplateIcon name="user" size={15} /> {customer.nama}
                </span>
                <button className="landing-btn-outline" onClick={function() { navigate('/portal'); }}>
                  <TemplateIcon name="money" size={15} /> Portal Saya
                </button>
                <button className="landing-btn-outline landing-btn-outline--muted" onClick={onLogout}>
                  <TemplateIcon name="logout" size={15} /> Keluar
                </button>
              </>
            ) : (
              <button className="landing-btn-primary" onClick={function() { navigate('/bayar'); }}>
                Bayar Tagihan
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-bg-orb landing-hero-bg-orb--1"></div>
        <div className="landing-hero-bg-orb landing-hero-bg-orb--2"></div>
        <div className="landing-hero-bg-orb landing-hero-bg-orb--3"></div>
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Penyedia Layanan Internet <br />
            <span className="landing-hero-title--accent">Terbaik &amp; Terpercaya</span>
          </h1>
          <p className="landing-hero-subtitle">
            Dengan bandwidth yang disesuaikan untuk pengalaman Anda. Koneksi fiber optic cepat dan stabil untuk kebutuhan rumah dan bisnis.
          </p>
          <div className="landing-hero-actions">
            <a href="#harga" className="landing-btn-primary landing-btn-lg">
              <TemplateIcon name="signal" size={18} /> Mulai Sekarang
            </a>
            <button className="landing-btn-ghost landing-btn-lg" onClick={handlePaymentClick}>
              <TemplateIcon name="money" size={16} /> Bayar Tagihan
            </button>
          </div>
          <div className="landing-hero-stats">
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
      </section>

      {/* Tentang Kami */}
      <section className="landing-about" id="tentang">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Tentang Kami</h2>
          </div>
          <div className="landing-about-grid">
            <div className="landing-about-text">
              <p>PT. Lintas Data Multimedia adalah penyedia layanan internet (ISP) yang berkomitmen memberikan koneksi internet cepat dan stabil untuk kebutuhan bisnis dan rumah Anda.</p>
              <ul className="landing-checklist">
                <li><TemplateIcon name="check" size={16} color="#5eead4" /> Layanan internet dengan bandwidth yang dapat disesuaikan.</li>
                <li><TemplateIcon name="check" size={16} color="#5eead4" /> Dukungan teknis 24/7 untuk memastikan koneksi Anda selalu optimal.</li>
                <li><TemplateIcon name="check" size={16} color="#5eead4" /> Jaringan yang handal dan aman untuk berbagai kebutuhan digital Anda.</li>
              </ul>
            </div>
            <div className="landing-about-text">
              <p>Dengan pengalaman bertahun-tahun di industri telekomunikasi, kami berkomitmen untuk memberikan layanan terbaik dan solusi internet yang inovatif bagi pelanggan kami.</p>
              <div className="landing-about-highlights">
                <div className="landing-highlight-item">
                  <div className="landing-highlight-num">01</div>
                  <div>
                    <h4>Konsultasi &amp; Analisis</h4>
                    <p>Memahami kebutuhan Anda untuk solusi internet yang tepat.</p>
                  </div>
                </div>
                <div className="landing-highlight-item">
                  <div className="landing-highlight-num">02</div>
                  <div>
                    <h4>Instalasi &amp; Setup</h4>
                    <p>Pemasangan perangkat dan konfigurasi jaringan oleh teknisi profesional.</p>
                  </div>
                </div>
                <div className="landing-highlight-item">
                  <div className="landing-highlight-num">03</div>
                  <div>
                    <h4>Monitoring &amp; Dukungan</h4>
                    <p>Pemantauan kinerja jaringan dan dukungan berkelanjutan.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Layanan */}
      <section className="landing-features" id="layanan">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Layanan Kami</h2>
            <p className="landing-section-subtitle">Kami menyediakan berbagai layanan internet dan solusi jaringan yang dirancang untuk memenuhi kebutuhan bisnis dan rumah tangga Anda.</p>
          </div>
          <div className="landing-features-grid landing-features-grid--4">
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--cyan"><TemplateIcon name="server" size={24} /></div>
              <h3>Internet Broadband</h3>
              <p>Layanan internet cepat dengan bandwidth yang dapat disesuaikan untuk rumah dan bisnis, menggunakan teknologi fiber optic terdepan.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--green"><TemplateIcon name="signal" size={24} /></div>
              <h3>Solusi WiFi</h3>
              <p>Instalasi dan pengelolaan jaringan WiFi yang handal untuk area rumah, kantor, atau publik dengan keamanan tinggi.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--purple"><TemplateIcon name="shield" size={24} /></div>
              <h3>Keamanan Jaringan</h3>
              <p>Perlindungan jaringan dengan firewall, enkripsi data, dan monitoring 24/7 untuk mencegah ancaman cyber.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--orange"><TemplateIcon name="user" size={24} /></div>
              <h3>Dukungan Teknis</h3>
              <p>Tim ahli siap membantu instalasi, troubleshooting, dan pemeliharaan jaringan kapan saja Anda butuhkan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA WhatsApp */}
      <section className="landing-cta-wa">
        <div className="landing-cta-wa-inner">
          <div className="landing-cta-wa-text">
            <h2>Hubungi Kami Sekarang</h2>
            <p>Dapatkan koneksi internet cepat dan stabil untuk rumah atau bisnis Anda. Tim kami siap membantu dengan instalasi dan dukungan penuh.</p>
          </div>
          <a href="https://wa.me/6282299139449?text=Halo%2C%20saya%20ingin%20pesan%20layanan%20internet%20dari%20Lintas%20Data%20Multimedia." target="_blank" rel="noopener noreferrer" className="landing-btn-wa">
            <TemplateIcon name="phone" size={18} /> Pesan via WhatsApp
          </a>
        </div>
      </section>

      {/* Daftar Harga */}
      <section className="landing-pricing" id="harga">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Daftar Harga</h2>
            <p className="landing-section-subtitle">Pilih paket internet yang sesuai dengan kebutuhan Anda dari berbagai pilihan kecepatan dan harga kompetitif.</p>
          </div>
          <div className="landing-pricing-grid">
            {packages.map(function(pkg, idx) {
              return (
                <div className={'landing-pricing-card' + (pkg.popular ? ' landing-pricing-card--popular' : '')} key={idx}>
                  {pkg.popular && <div className="landing-pricing-badge">Popular</div>}
                  <h3 className="landing-pricing-name">{pkg.name}</h3>
                  <div className="landing-pricing-price">
                    <span className="landing-pricing-currency">Rp</span>
                    <span className="landing-pricing-amount">{pkg.price}</span>
                    <span className="landing-pricing-period">/bulan</span>
                  </div>
                  <ul className="landing-pricing-features">
                    {pkg.features.map(function(f, i) {
                      return <li key={i}><TemplateIcon name="check" size={14} color="#5eead4" /> {f}</li>;
                    })}
                  </ul>
                  <a href="https://wa.me/6282299139449?text=Halo%2C%20saya%20ingin%20berlangganan%20" target="_blank" rel="noopener noreferrer" className="landing-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Pesan Sekarang
                  </a>
                </div>
              );
            })}
          </div>
          <div className="landing-pricing-info">
            <p><strong>Wilayah Layanan:</strong> Kec. Pringsewu, Kec. Pagelaran, Kec. Sukoharjo, Kec. Kalirejo, Kec. Adiluwih, Kec. Banyumas</p>
            <p><strong>Biaya Instalasi:</strong> <del>Rp 350.000</del> <span style={{ color: '#5eead4', fontWeight: 700 }}>(Gratis untuk semua paket)</span></p>
          </div>
        </div>
      </section>

      {/* CTA Bayar Tagihan */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <div className="landing-cta-content">
            <h2>Bayar Tagihan Anda Sekarang</h2>
            <p>Login ke portal pelanggan untuk melihat status tagihan dan melakukan pembayaran secara instan. Pembayaran otomatis diverifikasi dan internet langsung aktif kembali.</p>
            <button className="landing-btn-primary landing-btn-lg landing-btn-glow" onClick={handlePaymentClick}>
              <TemplateIcon name="money" size={18} /> {isLoggedIn ? 'Buka Portal Pembayaran' : 'Login & Bayar Sekarang'}
            </button>
          </div>
          <div className="landing-cta-visual">
            <div className="landing-cta-card">
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Status</span>
                <span className="landing-cta-card-badge landing-cta-card-badge--green">Lunas</span>
              </div>
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Periode</span>
                <span className="landing-cta-card-value">Juli 2026</span>
              </div>
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Nominal</span>
                <span className="landing-cta-card-value landing-cta-card-value--bold">Rp 200.000</span>
              </div>
              <div className="landing-cta-card-row">
                <span className="landing-cta-card-label">Metode</span>
                <span className="landing-cta-card-value">Midtrans (QRIS)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-faq" id="faq">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Pertanyaan Umum</h2>
            <p className="landing-section-subtitle">Temukan jawaban atas pertanyaan yang sering diajukan tentang layanan internet kami.</p>
          </div>
          <div className="landing-faq-list">
            {faqs.map(function(faq, idx) {
              return (
                <div className={'landing-faq-item' + (openFaq === idx ? ' landing-faq-item--open' : '')} key={idx} onClick={function() { toggleFaq(idx); }}>
                  <div className="landing-faq-question">
                    <span>{faq.q}</span>
                    <TemplateIcon name={openFaq === idx ? 'chevron-down' : 'chevron-right'} size={18} />
                  </div>
                  {openFaq === idx && <div className="landing-faq-answer">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kontak */}
      <section className="landing-contact" id="kontak">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Hubungi Kami</h2>
            <p className="landing-section-subtitle">Hubungi tim kami untuk informasi lebih lanjut tentang layanan internet atau untuk pemesanan paket.</p>
          </div>
          <div className="landing-contact-grid">
            <div className="landing-contact-item">
              <div className="landing-contact-icon"><TemplateIcon name="location" size={22} /></div>
              <h4>Alamat</h4>
              <p>Jl. KH. Gholib Raya Gg. Panda, Pringsewu Utara, Kec. Pringsewu, Kabupaten Pringsewu, Lampung 35373</p>
            </div>
            <div className="landing-contact-item">
              <div className="landing-contact-icon"><TemplateIcon name="phone" size={22} /></div>
              <h4>Telepon</h4>
              <p>+62 822-9913-9449</p>
            </div>
            <div className="landing-contact-item">
              <div className="landing-contact-icon"><TemplateIcon name="mail" size={22} /></div>
              <h4>Email</h4>
              <p>cs@lintasdata.net.id</p>
            </div>
          </div>
          <div className="landing-map">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d297!2d104.9778103!3d-5.3431389!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e47332d89a55f43:0x6d7f59cfb822556e!2sPT+Lintas+Data+Multimedia!5e0!3m2!1sen!2sid!4v1695897600000!5m2!1sen!2sid"
              title="Lokasi PT Lintas Data Multimedia"
              style={{ border: 0, width: '100%', height: '300px', borderRadius: '14px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src={process.env.PUBLIC_URL + '/logo ldm.png'} alt="Logo LDM" className="landing-footer-logo" />
            <p className="landing-footer-desc">PT. Lintas Data Multimedia — Penyedia layanan internet fiber optic cepat dan stabil di Pringsewu, Lampung.</p>
          </div>
          <div className="landing-footer-links">
            <h4>Navigasi</h4>
            <a href="#tentang">Tentang Kami</a>
            <a href="#layanan">Layanan</a>
            <a href="#harga">Harga</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="landing-footer-links">
            <h4>Layanan</h4>
            <a href="#layanan">Internet Broadband</a>
            <a href="#layanan">Solusi WiFi</a>
            <a href="#layanan">Keamanan Jaringan</a>
            <a href="#layanan">Dukungan Teknis</a>
          </div>
          <div className="landing-footer-links">
            <h4>Kontak &amp; Sosial</h4>
            <a href="mailto:cs@lintasdata.net.id"><TemplateIcon name="mail" size={14} /> cs@lintasdata.net.id</a>
            <a href="https://wa.me/6282299139449" target="_blank" rel="noopener noreferrer"><TemplateIcon name="phone" size={14} /> +62 822-9913-9449</a>
            <div className="landing-footer-social">
              <a href="https://www.facebook.com/share/172oaMU4xo/" target="_blank" rel="noopener noreferrer" className="landing-social-link">FB</a>
              <a href="https://www.instagram.com/lintasdata_mm" target="_blank" rel="noopener noreferrer" className="landing-social-link">IG</a>
              <a href="https://www.tiktok.com/@lintas.data.multi" target="_blank" rel="noopener noreferrer" className="landing-social-link">TT</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; {new Date().getFullYear()} Hak Cipta <strong>LINTAS DATA MULTIMEDIA</strong> Semua Hak Dilindungi</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';
import './CustomerRegistrationPage.css';

function CustomerRegistrationPage() {
  var { logoUrl } = useLogo();
  var [packages, setPackages] = useState([]);
  var [form, setForm] = useState({ nama: '', no_hp: '', email: '', password: '', alamat: '', nik: '', paket: '' });
  var [foto, setFoto] = useState(null);
  var [loadingPackages, setLoadingPackages] = useState(true);
  var [submitting, setSubmitting] = useState(false);
  var [error, setError] = useState('');
  var [success, setSuccess] = useState('');

  useEffect(function () {
    axios.get(`${API_BASE_URL}/api/paket`)
      .then(function (response) {
        var availablePackages = response.data.success ? response.data.data : [];
        setPackages(availablePackages);
        if (availablePackages.length) {
          setForm(function (current) {
            return Object.assign({}, current, { paket: current.paket || availablePackages[0].nama_paket });
          });
        }
      })
      .catch(function () {
        setError('Paket layanan gagal dimuat. Silakan muat ulang halaman.');
      })
      .finally(function () {
        setLoadingPackages(false);
      });
  }, []);

  function handleChange(event) {
    var field = event.target.name;
    var value = event.target.value;
    setForm(function (current) { return Object.assign({}, current, { [field]: value }); });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    var formData = new FormData();
    Object.keys(form).forEach(function (key) { formData.append(key, form[key]); });
    formData.append('foto', foto);

    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/auth/register`, formData);
      setSuccess(response.data.message || 'Registrasi berhasil.');
      setForm({ nama: '', no_hp: '', email: '', password: '', alamat: '', nik: '', paket: packages[0]?.nama_paket || '' });
      setFoto(null);
      event.target.reset();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Registrasi gagal. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="customer-registration-page">
      <header className="registration-header">
        <Link to="/" className="registration-brand">
          <img src={logoUrl || '/logo_ldm.png'} alt="Logo LDM" className="registration-logo" />
          <span>PT. Lintas Data Multimedia</span>
        </Link>
        <Link to="/login" className="registration-login-link">Sudah punya akun? Masuk</Link>
      </header>

      <section className="registration-content">
        <div className="registration-heading">
          <span className="registration-kicker">PELANGGAN BARU</span>
          <h1>Registrasi layanan</h1>
          <p>Lengkapi data berikut untuk mengajukan pemasangan layanan internet.</p>
        </div>

        <form className="registration-form" onSubmit={handleSubmit}>
          {error && <div className="registration-notice registration-notice--error" role="alert">{error}</div>}
          {success && <div className="registration-notice registration-notice--success" role="status">{success} <Link to="/login">Lanjut ke login</Link></div>}

          <div className="registration-fields">
            <label className="registration-field">
              <span>Nama lengkap</span>
              <input name="nama" value={form.nama} onChange={handleChange} autoComplete="name" required maxLength="150" />
            </label>
            <label className="registration-field">
              <span>Nomor HP</span>
              <input name="no_hp" type="tel" value={form.no_hp} onChange={handleChange} autoComplete="tel" required maxLength="20" />
            </label>
            <label className="registration-field">
              <span>Email</span>
              <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" required maxLength="255" />
            </label>
            <label className="registration-field">
              <span>Password</span>
              <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="new-password" minLength="6" required />
            </label>
            <label className="registration-field registration-field--wide">
              <span>Alamat pemasangan</span>
              <textarea name="alamat" value={form.alamat} onChange={handleChange} autoComplete="street-address" rows="3" required maxLength="255" />
            </label>
            <label className="registration-field">
              <span>NIK</span>
              <input name="nik" inputMode="numeric" value={form.nik} onChange={handleChange} pattern="[0-9]{16}" minLength="16" maxLength="16" required />
              <small>Masukkan 16 digit angka.</small>
            </label>
            <label className="registration-field">
              <span>Paket layanan</span>
              <select name="paket" value={form.paket} onChange={handleChange} disabled={loadingPackages || packages.length === 0} required>
                {loadingPackages && <option value="">Memuat paket...</option>}
                {!loadingPackages && packages.length === 0 && <option value="">Paket tidak tersedia</option>}
                {packages.map(function (item) {
                  return <option key={item.id} value={item.nama_paket}>{item.nama_paket} - Rp {Number(item.harga).toLocaleString('id-ID')}/bulan</option>;
                })}
              </select>
            </label>
            <label className="registration-field registration-field--wide">
              <span>Upload foto KTP</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={function (event) { setFoto(event.target.files[0] || null); }} required />
              <small>Format JPG, PNG, atau WEBP. Maksimal 5 MB.</small>
            </label>
          </div>

          <button className="registration-submit" type="submit" disabled={submitting || loadingPackages || packages.length === 0}>
            {submitting ? 'Mengirim registrasi...' : 'Kirim registrasi'}
          </button>
          <p className="registration-footnote">Data Anda akan digunakan untuk memproses permintaan pemasangan.</p>
        </form>
      </section>
    </main>
  );
}

export default CustomerRegistrationPage;
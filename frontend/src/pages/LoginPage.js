import React, { useState } from 'react';
import axios from 'axios';
import TemplateIcon from '../components/TemplateIcon';

import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';

function LoginPage({ onLogin }) {
  var { logoUrl } = useLogo();
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [showPassword, setShowPassword] = useState(false);
  var [showNewPassword, setShowNewPassword] = useState(false);
  var [showConfirmPassword, setShowConfirmPassword] = useState(false);
  var [forgotMode, setForgotMode] = useState(false);
  var [forgotStep, setForgotStep] = useState(1);
  var [forgotOtp, setForgotOtp] = useState('');
  var [newPassword, setNewPassword] = useState('');
  var [confirmPassword, setConfirmPassword] = useState('');
  var [error, setError] = useState('');
  var [successMsg, setSuccessMsg] = useState('');
  var [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      var response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: email,
        password: password
      });

      if (response.data.success) {
        var { token, admin } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('admin', JSON.stringify(admin));
        onLogin(admin, token);
      }
    } catch (err) {
      var message = err.response?.data?.message || 'Gagal terhubung ke server.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function requestResetOtp(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      var response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password/request-otp`, { email: email });
      setSuccessMsg((response.data.message || 'OTP reset password telah dikirim ke email.') + ' Jika tidak ditemukan di Kotak Masuk, silakan cek folder Spam.');
      setForgotStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password/reset`, {
        email: email,
        otp: forgotOtp,
        newPassword: newPassword,
        confirmPassword: confirmPassword
      });
      setForgotMode(false);
      setForgotStep(1);
      setForgotOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah password.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyResetOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password/verify-otp`, { email: email, otp: forgotOtp });
      setForgotStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP tidak valid atau sudah kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  }

  function switchToLogin() {
    setForgotMode(false);
    setForgotStep(1);
    setError('');
    setSuccessMsg('');
  }

  return (
    <div className={forgotMode ? 'login-page login-page-forgot' : 'login-page'}>
      <div className={forgotMode ? 'login-container login-container-forgot' : 'login-container'}>
        <div className={forgotMode ? 'login-card login-card-forgot' : 'login-card'}>
          <div className="login-logo">
            <img
              src={logoUrl}
              alt="Logo Lintas Data Multimedia"
              className="login-logo-img"
            />
            {forgotMode && (
              <>
                <h1>Portal Pembayaran</h1>
                <p>ESP Lintas Data Multimedia</p>
              </>
            )}
          </div>

          {error && (
            <div className="login-error">
              <TemplateIcon name="alert" size={16} style={{ marginRight: '6px' }} /> {error}
            </div>
          )}

          {successMsg && !error && (
            <div className="login-success">{successMsg}</div>
          )}

          {forgotMode ? (
            forgotStep === 1 ? (
              <form className="forgot-password-form" onSubmit={requestResetOtp}>
                <div className="form-group">
                  <label>Email Admin</label>
                  <input type="email" placeholder="Contoh: user@email.com" value={email} onChange={function (e) { setEmail(e.target.value); }} required autoFocus />
                </div>
                <button type="submit" className="forgot-password-submit" disabled={loading}>
                  {loading ? 'Mengirim OTP...' : 'Kirim OTP'}
                </button>
                <button type="button" className="forgot-password-back" onClick={switchToLogin}>Kembali ke Login</button>
              </form>
            ) : forgotStep === 2 ? (
              <form className="forgot-password-form" onSubmit={verifyResetOtp}>
                <div className="form-group">
                  <label>Kode OTP</label>
                  <input type="text" inputMode="numeric" maxLength="6" value={forgotOtp} onChange={function (e) { setForgotOtp(e.target.value); }} required autoFocus />
                </div>
                <button type="submit" className="forgot-password-submit" disabled={loading}>{loading ? 'Memverifikasi OTP...' : 'Verifikasi OTP'}</button>
                <button type="button" className="forgot-password-back" onClick={switchToLogin}>Kembali ke Login</button>
              </form>
            ) : (
              <form className="forgot-password-form" onSubmit={resetPassword}>
                <div className="form-group">
                  <label>Password Baru</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      minLength="6"
                      value={newPassword}
                      onChange={function (e) { setNewPassword(e.target.value); }}
                      required
                      style={{ width: '100%', paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={function () { setShowNewPassword(!showNewPassword); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showNewPassword ? 'var(--primary, #006876)' : 'var(--text-muted, #94a3b8)',
                        transition: 'color 0.2s ease'
                      }}
                      title={showNewPassword ? "Sembunyikan password" : "Lihat password"}
                      aria-label={showNewPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      <TemplateIcon name={showNewPassword ? "eye-off" : "eye"} size={18} />
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Verifikasi Password Baru</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      minLength="6"
                      value={confirmPassword}
                      onChange={function (e) { setConfirmPassword(e.target.value); }}
                      required
                      style={{ width: '100%', paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={function () { setShowConfirmPassword(!showConfirmPassword); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showConfirmPassword ? 'var(--primary, #006876)' : 'var(--text-muted, #94a3b8)',
                        transition: 'color 0.2s ease'
                      }}
                      title={showConfirmPassword ? "Sembunyikan password" : "Lihat password"}
                      aria-label={showConfirmPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      <TemplateIcon name={showConfirmPassword ? "eye-off" : "eye"} size={18} />
                    </button>
                  </div>
                </div>
                <button type="submit" className="forgot-password-submit" disabled={loading}>
                  {loading ? 'Mengubah Password...' : 'Ubah Password'}
                </button>
                <button type="button" className="forgot-password-back" onClick={switchToLogin}>Kembali ke Login</button>
              </form>
            )
          ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label><TemplateIcon name="mail" size={14} style={{ marginRight: '6px' }} /> Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="Masukkan email"
                value={email}
                onChange={function (e) { setEmail(e.target.value); }}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label><TemplateIcon name="lock" size={14} style={{ marginRight: '6px' }} /> Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={function (e) { setPassword(e.target.value); }}
                  required
                  style={{ width: '100%', paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={function () { setShowPassword(!showPassword); }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: showPassword ? 'var(--primary, #006876)' : 'var(--text-muted, #94a3b8)',
                    transition: 'color 0.2s ease'
                  }}
                  title={showPassword ? "Sembunyikan password" : "Lihat password"}
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  <TemplateIcon name={showPassword ? "eye-off" : "eye"} size={18} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={function () { setForgotMode(true); setError(''); }}
              className="forgot-password-link"
            >
              Lupa Password?
            </button>
            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Memproses...</> : <><TemplateIcon name="shield" size={16} style={{ marginRight: '6px' }} /> Masuk ke Dashboard</>}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import TemplateIcon from '../components/TemplateIcon';
import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';

function CustomerLoginPage({ onLogin, title = "Portal Pembayaran" }) {
  var { userEmail } = useParams();
  var { logoUrl } = useLogo();
  var [email, setEmail] = useState(userEmail ? decodeURIComponent(userEmail) : '');
  var [password, setPassword] = useState('');
  var [showPassword, setShowPassword] = useState(false);
  var [showNewPassword, setShowNewPassword] = useState(false);
  var [showConfirmPassword, setShowConfirmPassword] = useState(false);
  var [otp, setOtp] = useState('');
  var [step, setStep] = useState(1); // 1: input phone, 2: input OTP
  var [forgotMode, setForgotMode] = useState(false);
  var [forgotStep, setForgotStep] = useState(1);
  var [forgotOtp, setForgotOtp] = useState('');
  var [newPassword, setNewPassword] = useState('');
  var [confirmPassword, setConfirmPassword] = useState('');
  var [error, setError] = useState('');
  var [successMsg, setSuccessMsg] = useState('');
  var [loading, setLoading] = useState(false);

  var [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(function () {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return function () {
      window.removeEventListener('resize', handleResize);
    };
  }, []);



  async function handleRequestOtp(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/auth/request-otp`, {
        email: email,
        password: password
      });

      if (response.data.success) {
        setSuccessMsg(response.data.message + ' Jika tidak ditemukan di Kotak Masuk, silakan cek folder Spam.');
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim OTP. Pastikan email Anda terdaftar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/auth/verify-otp`, {
        email: email,
        otp: otp
      });

      if (response.data.success) {
        var { token, customer } = response.data.data;
        localStorage.setItem('customer_token', token);
        localStorage.setItem('customer_info', JSON.stringify(customer));
        onLogin(customer, token);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Kode OTP salah atau sudah expired.');
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
      var response = await axios.post(`${API_BASE_URL}/api/customer/auth/forgot-password/request-otp`, { email: email });
      setSuccessMsg((response.data.message || 'OTP reset password telah dikirim ke email Anda.') + ' Jika tidak ditemukan di Kotak Masuk, silakan cek folder Spam.');
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
      await axios.post(`${API_BASE_URL}/api/customer/auth/forgot-password/reset`, {
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
      setSuccessMsg('Password berhasil diubah. Silakan login.');
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
      await axios.post(`${API_BASE_URL}/api/customer/auth/forgot-password/verify-otp`, { email: email, otp: forgotOtp });
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--md-surface-container-low)',
      fontFamily: "'Open Sans', sans-serif"
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: windowWidth <= 768 ? '16px' : '24px',
        zIndex: 2
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          animation: 'slideUp 0.5s ease-out'
        }}>
        {/* Login Card — white rounded-2xl + ambient-shadow */}
        <div style={{
          background: 'var(--md-surface-container-lowest)',
          borderRadius: 'var(--radius-2xl)',
          padding: windowWidth <= 768 ? '32px 20px' : '48px 40px',
          boxShadow: '0px 4px 20px rgba(0, 75, 122, 0.08)'
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img
              src={logoUrl}
              alt="Logo Lintas Data Multimedia"
              style={{
                height: 75,
                maxWidth: '100%',
                objectFit: 'contain',
                marginBottom: 16,
                filter: 'drop-shadow(0 4px 8px rgba(0, 104, 118, 0.15))'
              }}
            />
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--md-on-surface)',
              marginBottom: 4
            }}>{title}</h1>
            <p style={{
              color: 'var(--md-on-surface-variant)',
              fontSize: '0.85rem'
            }}>ESP Lintas Data Multimedia</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'var(--status-merah-bg)',
              color: 'var(--status-merah)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
              {error}
            </div>
          )}

          {/* Success */}
          {successMsg && !error && (
            <div style={{
              background: 'var(--status-hijau-bg)',
              color: 'var(--status-hijau)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 600
            }}>
              {successMsg}
            </div>
          )}

          {forgotMode ? (
            forgotStep === 1 ? (
              <form onSubmit={requestResetOtp}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 6 }}>Email Pelanggan</label>
                  <input type="email" placeholder="Contoh: user@email.com" value={email} onChange={function (e) { setEmail(e.target.value); }} required autoFocus style={{ width: '100%', padding: '14px 16px', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', background: 'var(--md-surface-container-low)' }} />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)', fontWeight: 700 }}>{loading ? 'Mengirim OTP...' : 'Kirim OTP'}</button>
                <button type="button" onClick={switchToLogin} style={{ width: '100%', marginTop: 10, padding: 12, border: '1px solid var(--md-outline-variant)', borderRadius: 'var(--radius-md)', background: 'var(--md-surface-container)', fontWeight: 600 }}>Kembali ke Login</button>
              </form>
            ) : forgotStep === 2 ? (
              <form onSubmit={verifyResetOtp}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 6 }}>Kode OTP</label>
                  <input type="text" inputMode="numeric" maxLength="6" value={forgotOtp} onChange={function (e) { setForgotOtp(e.target.value); }} required autoFocus style={{ width: '100%', padding: '14px 16px', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '1.2rem', textAlign: 'center', letterSpacing: 6, background: 'var(--md-surface-container-low)' }} />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)', fontWeight: 700 }}>{loading ? 'Memverifikasi OTP...' : 'Verifikasi OTP'}</button>
                <button type="button" onClick={switchToLogin} style={{ width: '100%', marginTop: 10, padding: 12, border: '1px solid var(--md-outline-variant)', borderRadius: 'var(--radius-md)', background: 'var(--md-surface-container)', fontWeight: 600 }}>Kembali ke Login</button>
              </form>
            ) : (
              <form onSubmit={resetPassword}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 6 }}>Password Baru</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      minLength="6"
                      value={newPassword}
                      onChange={function (e) { setNewPassword(e.target.value); }}
                      required
                      style={{ width: '100%', padding: '14px 44px 14px 16px', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', background: 'var(--md-surface-container-low)' }}
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
                        color: showNewPassword ? 'var(--md-primary)' : 'var(--md-outline)'
                      }}
                      title={showNewPassword ? "Sembunyikan password" : "Lihat password"}
                      aria-label={showNewPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      <TemplateIcon name={showNewPassword ? "eye-off" : "eye"} size={18} />
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 6 }}>Verifikasi Password Baru</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      minLength="6"
                      value={confirmPassword}
                      onChange={function (e) { setConfirmPassword(e.target.value); }}
                      required
                      style={{ width: '100%', padding: '14px 44px 14px 16px', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', background: 'var(--md-surface-container-low)' }}
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
                        color: showConfirmPassword ? 'var(--md-primary)' : 'var(--md-outline)'
                      }}
                      title={showConfirmPassword ? "Sembunyikan password" : "Lihat password"}
                      aria-label={showConfirmPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      <TemplateIcon name={showConfirmPassword ? "eye-off" : "eye"} size={18} />
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)', fontWeight: 700 }}>{loading ? 'Mengubah Password...' : 'Ubah Password'}</button>
                <button type="button" onClick={switchToLogin} style={{ width: '100%', marginTop: 10, padding: 12, border: '1px solid var(--md-outline-variant)', borderRadius: 'var(--radius-md)', background: 'var(--md-surface-container)', fontWeight: 600 }}>Kembali ke Login</button>
              </form>
            )
          ) : step === 1 ? (
            <form onSubmit={handleRequestOtp}>
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--md-on-surface-variant)',
                  marginBottom: 6,
                  marginLeft: 4,
                  display: 'block'
                }}>Email Pelanggan</label>
                <input
                  type="email"
                  placeholder="Contoh: user@email.com"
                  value={email}
                  onChange={function (e) { setEmail(e.target.value); }}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--md-surface-container-low)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--md-on-surface-variant)',
                  marginBottom: 6,
                  marginLeft: 4,
                  display: 'block'
                }}>Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={function (e) { setPassword(e.target.value); }}
                    required
                    style={{
                      width: '100%',
                      background: 'var(--md-surface-container-low)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 44px 14px 16px',
                      fontSize: '0.95rem',
                      outline: 'none'
                    }}
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
                      color: showPassword ? 'var(--md-primary)' : 'var(--md-outline)'
                    }}
                    title={showPassword ? "Sembunyikan password" : "Lihat password"}
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    <TemplateIcon name={showPassword ? "eye-off" : "eye"} size={18} />
                  </button>
                </div>
              </div>
              <button type="button" className="forgot-password-link" onClick={function () { setForgotMode(true); setError(''); setSuccessMsg(''); }}>Lupa Password?</button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'var(--md-primary-container)',
                  color: 'var(--md-on-primary-container)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "'Open Sans', sans-serif"
                }}
              >
                {loading ? (
                  <><span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'pulse 1s infinite' }}>hourglass_top</span> Memproses...</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span> Kirim OTP via Email</>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--md-on-surface-variant)',
                  marginBottom: 6,
                  marginLeft: 4,
                  display: 'block'
                }}>Masukkan 6-Digit Kode OTP</label>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="••••••"
                  value={otp}
                  onChange={function (e) { setOtp(e.target.value); }}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--md-surface-container-low)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    fontSize: '1.4rem',
                    letterSpacing: '6px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'var(--md-primary-container)',
                  color: 'var(--md-on-primary-container)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 10,
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "'Open Sans', sans-serif"
                }}
              >
                {loading ? (
                  <><span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'pulse 1s infinite' }}>hourglass_top</span> Memverifikasi...</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>verified_user</span> Masuk</>
                )}
              </button>
              <button
                type="button"
                onClick={function () { setStep(1); setError(''); setSuccessMsg(''); }}
                style={{
                  width: '100%',
                  background: 'var(--md-surface-container)',
                  color: 'var(--md-on-surface)',
                  border: '1px solid var(--md-outline-variant)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Open Sans', sans-serif"
                }}
              >
                Kembali
              </button>
            </form>
          )}
        </div>
      </div>
    </div>

    </div>
  );
}

export default CustomerLoginPage;

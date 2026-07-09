import React, { useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function CustomerLoginPage({ onLogin }) {
  var { userEmail } = useParams();
  var [email, setEmail] = useState(userEmail ? decodeURIComponent(userEmail) : '');
  var [otp, setOtp] = useState('');
  var [step, setStep] = useState(1); // 1: input phone, 2: input OTP
  var [error, setError] = useState('');
  var [successMsg, setSuccessMsg] = useState('');
  var [loading, setLoading] = useState(false);

  async function handleRequestOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      var response = await axios.post(`${API_BASE_URL}/api/customer/auth/request-otp`, {
        email: email
      });

      if (response.data.success) {
        setSuccessMsg(response.data.message);
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--md-surface-container-low)',
      fontFamily: "'Hanken Grotesk', sans-serif",
      padding: '24px'
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
          padding: '48px 40px',
          boxShadow: '0px 4px 20px rgba(0, 75, 122, 0.08)'
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img
              src={process.env.PUBLIC_URL + '/logo ldm.png'}
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
            }}>Portal Pembayaran</h1>
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

          {step === 1 ? (
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
                  fontFamily: "'Hanken Grotesk', sans-serif"
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
                  fontFamily: "'Hanken Grotesk', sans-serif"
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
                  fontFamily: "'Hanken Grotesk', sans-serif"
                }}
              >
                Kembali
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerLoginPage;

import React, { useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

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
      var response = await axios.post('http://localhost:3000/api/customer/auth/request-otp', {
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
      var response = await axios.post('http://localhost:3000/api/customer/auth/verify-otp', {
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
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">🔑</div>
            <h1>Portal Pembayaran</h1>
            <p>ESP Lintas Data Multimedia</p>
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}
          {successMsg && !error && (
            <div className="status-badge hijau" style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
              {successMsg}
            </div>
          )}

          {step === 1 ? (
            <form className="login-form" onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label>Email Pelanggan</label>
                <input
                  type="email"
                  placeholder="Contoh: user@email.com"
                  value={email}
                  onChange={function(e) { setEmail(e.target.value); }}
                  required
                  autoFocus
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
              >
                {loading ? '⏳ Memproses...' : '📧 Kirim OTP via Email'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label>Masukkan 6-Digit Kode OTP</label>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="******"
                  value={otp}
                  onChange={function(e) { setOtp(e.target.value); }}
                  required
                  autoFocus
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '4px', fontWeight: 'bold' }}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
                style={{ marginBottom: '10px' }}
              >
                {loading ? '⏳ Memverifikasi...' : '🔐 Masuk'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={function() { setStep(1); setError(''); setSuccessMsg(''); }}
                style={{ width: '100%' }}
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

import React, { useState } from 'react';
import axios from 'axios';
import TemplateIcon from '../components/TemplateIcon';

function LoginPage({ onLogin }) {
  var [username, setUsername] = useState('');
  var [password, setPassword] = useState('');
  var [error, setError] = useState('');
  var [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      var response = await axios.post('http://localhost:3000/api/auth/login', {
        username: username,
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

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon"><TemplateIcon name="globe" size={28} /></div>
            <h1>ESP Lintas Data</h1>
            <p>Dashboard Monitoring ISP</p>
          </div>

          {error && (
            <div className="login-error">
              <TemplateIcon name="alert" size={16} style={{ marginRight: '6px' }} /> {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label><TemplateIcon name="users" size={14} style={{ marginRight: '6px' }} /> Username</label>
              <input
                id="login-username"
                type="text"
                placeholder="Masukkan username"
                value={username}
                onChange={function(e) { setUsername(e.target.value); }}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label><TemplateIcon name="lock" size={14} style={{ marginRight: '6px' }} /> Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={function(e) { setPassword(e.target.value); }}
                required
              />
            </div>
            <button 
              id="login-submit"
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
            >
              {loading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Memproses...</> : <><TemplateIcon name="shield" size={16} style={{ marginRight: '6px' }} /> Masuk ke Dashboard</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

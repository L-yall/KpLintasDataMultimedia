import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import './App.css';

import Sidebar from './components/Sidebar';
import Navbar from './components/Nav';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PelangganPage from './pages/PelangganPage';
import PaketPage from './pages/PaketPage';
import MikrotikPage from './pages/MikrotikPage';
import ReminderLogPage from './pages/ReminderLogPage';

function App() {
  var [admin, setAdmin] = useState(null);
  var [token, setToken] = useState(null);
  var [loading, setLoading] = useState(true);
  var [socket, setSocket] = useState(null);

  useEffect(function() {
    // Cek apakah sudah ada token di localStorage
    var savedToken = localStorage.getItem('token');
    var savedAdmin = localStorage.getItem('admin');

    if (savedToken && savedAdmin) {
      setToken(savedToken);
      setAdmin(JSON.parse(savedAdmin));
    }
    setLoading(false);
  }, []);

  // Socket connection manager
  useEffect(function() {
    if (token) {
      // Connect to Socket.IO backend
      var newSocket = io('http://localhost:3000', {
        transports: ['websocket'],
        auth: {
          token: token
        }
      });

      newSocket.on('connect', function() {
        console.log('Connected to WebSocket server');
      });

      setSocket(newSocket);

      return function() {
        newSocket.close();
      };
    } else {
      setSocket(null);
    }
  }, [token]);

  function handleLogin(adminData, tokenData) {
    setAdmin(adminData);
    setToken(tokenData);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    setAdmin(null);
    setToken(null);
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '1.2rem'
      }}>
        ⏳ Memuat...
      </div>
    );
  }

  // Jika belum login, tampilkan halaman login
  if (!admin || !token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Jika sudah login, tampilkan dashboard
  return (
    <div className="app-layout">
      <Sidebar admin={admin} onLogout={handleLogout} />
      <Navbar />
      <main className="app-main">
        <div className="app-content">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage socket={socket} />} />
            <Route path="/dashboard/pelanggan" element={<PelangganPage socket={socket} />} />
            <Route path="/dashboard/paket" element={<PaketPage />} />
            <Route path="/dashboard/mikrotik" element={<MikrotikPage socket={socket} />} />
            <Route path="/dashboard/reminder-logs" element={<ReminderLogPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;

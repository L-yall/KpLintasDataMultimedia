import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

import Sidebar from './components/Sidebar';
import Navbar from './components/Nav';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PelangganPage from './pages/PelangganPage';
import PaketPage from './pages/PaketPage';
import MikrotikPage from './pages/MikrotikPage';
import ReminderLogPage from './pages/ReminderLogPage';
import PembayaranPage from './pages/PembayaranPage';
import LaporanPage from './pages/LaporanPage';
import CustomerLoginPage from './pages/CustomerLoginPage';
import CustomerPortalPage from './pages/CustomerPortalPage';

function App() {
  // Admin authentication state
  var [admin, setAdmin] = useState(null);
  var [token, setToken] = useState(null);
  
  // Customer authentication state
  var [customer, setCustomer] = useState(null);
  var [customerToken, setCustomerToken] = useState(null);

  var [loading, setLoading] = useState(true);
  var [socket, setSocket] = useState(null);

  // Check URL pathname to determine if it is customer flow
  var isCustomerRoute = window.location.pathname.startsWith('/portal') || window.location.pathname.startsWith('/bayar');

  // Load saved sessions
  useEffect(function() {
    var savedToken = localStorage.getItem('token');
    var savedAdmin = localStorage.getItem('admin');
    if (savedToken && savedAdmin) {
      setToken(savedToken);
      setAdmin(JSON.parse(savedAdmin));
    }

    var savedCustToken = localStorage.getItem('customer_token');
    var savedCustInfo = localStorage.getItem('customer_info');
    if (savedCustToken && savedCustInfo) {
      setCustomerToken(savedCustToken);
      setCustomer(JSON.parse(savedCustInfo));
    }

    setLoading(false);
  }, []);

  // Axios interceptor to catch expired tokens (401 or 403) and log out automatically
  useEffect(function() {
    var interceptor = axios.interceptors.response.use(
      function(response) {
        return response;
      },
      function(error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.warn('Session expired or invalid. Logging out.');
          if (isCustomerRoute) {
            handleCustomerLogout();
          } else {
            handleLogout();
          }
        }
        return Promise.reject(error);
      }
    );

    return function() {
      axios.interceptors.response.eject(interceptor);
    };
  }, [isCustomerRoute]);

  // Admin socket manager
  useEffect(function() {
    if (token && !isCustomerRoute) {
      var newSocket = io('http://localhost:3000', {
        transports: ['websocket'],
        auth: { token: token }
      });
      newSocket.on('connect', function() {
        console.log('Connected to WebSocket server as Admin');
      });
      setSocket(newSocket);
      return function() {
        newSocket.close();
      };
    } else {
      setSocket(null);
    }
  }, [token, isCustomerRoute]);

  // Admin login / logout
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

  // Customer login / logout
  function handleCustomerLogin(customerData, tokenData) {
    setCustomer(customerData);
    setCustomerToken(tokenData);
  }

  function handleCustomerLogout() {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_info');
    setCustomer(null);
    setCustomerToken(null);
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

  // ==========================================
  // 1. CUSTOMER PORTAL FLOW
  // ==========================================
  if (isCustomerRoute) {
    if (!customer || !customerToken) {
      return (
        <Routes>
          <Route path="/bayar/:phone" element={<CustomerLoginPage onLogin={handleCustomerLogin} />} />
          <Route path="/bayar" element={<CustomerLoginPage onLogin={handleCustomerLogin} />} />
          <Route path="*" element={<Navigate to="/bayar" replace />} />
        </Routes>
      );
    }

    return (
      <Routes>
        <Route path="/portal" element={<CustomerPortalPage onLogout={handleCustomerLogout} />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  // ==========================================
  // 2. ADMIN DASHBOARD FLOW
  // ==========================================
  if (!admin || !token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

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
            <Route path="/dashboard/pembayaran" element={<PembayaranPage socket={socket} />} />
            <Route path="/dashboard/laporan" element={<LaporanPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;

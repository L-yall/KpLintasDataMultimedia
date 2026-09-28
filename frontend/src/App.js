import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { SOCKET_URL } from './config';
import './App.css';
import './LandingTheme.css';

import Sidebar from './components/Sidebar';
import Navbar from './components/Nav';
import TemplateIcon from './components/TemplateIcon';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PelangganPage from './pages/PelangganPage';
import PaketPage from './pages/PaketPage';
import MikrotikPage from './pages/MikrotikPage';
import ReminderLogPage from './pages/ReminderLogPage';
import PembayaranPage from './pages/PembayaranPage';
import LaporanPage from './pages/LaporanPage';
import CustomerLoginPage from './pages/CustomerLoginPage';
import CustomerRegistrationPage from './pages/CustomerRegistrationPage';
import CustomerPortalPage from './pages/CustomerPortalPage';
import LandingPage from './pages/LandingPage';
import NotifikasiPage from './pages/NotifikasiPage';
import PengaturanPage from './pages/PengaturanPage';
import TagihanPage from './pages/TagihanPage';
import ProfilPage from './pages/ProfilPage';
import KelolaAdminPage from './pages/KelolaAdminPage';
import RegistrasiPelangganPage from './pages/RegistrasiPelangganPage';

function App() {
  var location = useLocation();

  // Admin authentication state
  var [admin, setAdmin] = useState(null);
  var [token, setToken] = useState(null);

  // Customer authentication state
  var [customer, setCustomer] = useState(null);
  var [customerToken, setCustomerToken] = useState(null);

  var [loading, setLoading] = useState(true);
  var [socket, setSocket] = useState(null);
  var [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check URL pathname to determine if it is admin flow
  var isAdminRoute = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');

  // Load saved sessions
  useEffect(function () {
    var savedToken = localStorage.getItem('token');
    var savedAdmin = localStorage.getItem('admin');
    if (savedToken && savedAdmin) {
      try {
        setToken(savedToken);
        setAdmin(JSON.parse(savedAdmin));
      } catch (e) { }
    }

    var savedCustToken = localStorage.getItem('customer_token');
    var savedCustInfo = localStorage.getItem('customer_info');
    if (savedCustToken && savedCustInfo) {
      try {
        var custInfo = JSON.parse(savedCustInfo);
        var pathParts = window.location.pathname.split('/');
        var emailInUrl = '';
        if (pathParts[1] === 'bayar' && pathParts[2]) {
          emailInUrl = decodeURIComponent(pathParts[2]).trim().toLowerCase();
        }

        if (emailInUrl && custInfo.email && custInfo.email.trim().toLowerCase() !== emailInUrl) {
          localStorage.removeItem('customer_token');
          localStorage.removeItem('customer_info');
        } else {
          setCustomerToken(savedCustToken);
          setCustomer(custInfo);
        }
      } catch (e) { }
    }

    setLoading(false);
  }, []);

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

  // Axios interceptor to catch expired tokens (401 or 403) and log out automatically
  useEffect(function () {
    var interceptor = axios.interceptors.response.use(
      function (response) {
        return response;
      },
      function (error) {
        if (error.response) {
          var isAuthExpired = error.response.status === 401 ||
            (error.response.status === 403 && error.response.data?.message && (
              error.response.data.message.includes('expired') ||
              error.response.data.message.includes('Token tidak valid') ||
              error.response.data.message.includes('dinonaktifkan')
            ));

          if (isAuthExpired) {
            console.warn('Session expired or account disabled. Logging out.');
            if (isAdminRoute) {
              handleLogout();
            } else {
              handleCustomerLogout();
            }
          }
        }
        return Promise.reject(error);
      }
    );

    return function () {
      axios.interceptors.response.eject(interceptor);
    };
  }, [isAdminRoute]);

  // Admin socket manager
  useEffect(function () {
    if (token && isAdminRoute) {
      var newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { token: token }
      });
      newSocket.on('connect', function () {
        console.log('Connected to WebSocket server as Admin');
      });
      setSocket(newSocket);
      return function () {
        newSocket.close();
      };
    } else {
      setSocket(null);
    }
  }, [token, isAdminRoute]);

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
        <TemplateIcon name="loading" size={20} style={{ marginRight: '8px' }} /> Memuat...
      </div>
    );
  }

  // ==========================================
  // 1. ADMIN DASHBOARD FLOW
  // ==========================================
  if (isAdminRoute) {
    if (!admin || !token) {
      return (
        <Routes>
          <Route path="/admin/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      );
    }

    var isSuperAdmin = admin && admin.role === 'superadmin';

    return (
      <div className={'app-layout' + (sidebarCollapsed ? ' sidebar-collapsed' : '')}>
        <Sidebar admin={admin} onLogout={handleLogout} socket={socket} collapsed={sidebarCollapsed} />
        <Navbar admin={admin} onLogout={handleLogout} socket={socket} onToggleSidebar={function () { setSidebarCollapsed(!sidebarCollapsed); }} collapsed={sidebarCollapsed} />
        <main className="app-main">
          <div className="app-content">
            <Routes>
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage socket={socket} admin={admin} />} />
              <Route path="/dashboard/registrasi" element={<RegistrasiPelangganPage socket={socket} />} />
              <Route path="/dashboard/pelanggan" element={<PelangganPage socket={socket} />} />
              <Route path="/dashboard/tagihan" element={<TagihanPage socket={socket} admin={admin} />} />
              <Route path="/dashboard/paket" element={<PaketPage />} />
              <Route path="/dashboard/mikrotik" element={<MikrotikPage socket={socket} />} />
              <Route path="/dashboard/reminder-logs" element={<ReminderLogPage />} />
              <Route path="/dashboard/notifikasi" element={<NotifikasiPage socket={socket} admin={admin} />} />
              <Route path="/dashboard/profil" element={<ProfilPage />} />

              {/* Modul Finansial & Kasir dikelola khusus Admin operasional (Bukan Super Admin) */}
              <Route path="/dashboard/laporan" element={<LaporanPage />} />
              <Route path="/dashboard/pembayaran" element={<PembayaranPage socket={socket} />} />
              <Route path="/dashboard/pengaturan" element={<PengaturanPage />} />
              {/* <Route path="/dashboard/pengaturan" element={!isSuperAdmin ? <PengaturanPage /> : <Navigate to="/dashboard" replace />} /> */}
              <Route path="/dashboard/kelola-admin" element={isSuperAdmin ? <KelolaAdminPage admin={admin} /> : <Navigate to="/dashboard" replace />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // 2. PUBLIC & CUSTOMER PORTAL FLOW
  // ==========================================
  return (
    <Routes>
      {/* Landing Page — accessible to everyone */}
      <Route path="/" element={<LandingPage customer={customer} onLogout={handleCustomerLogout} />} />

      {/* Customer Login (Payment Portal Login) */}
      <Route path="/bayar/:userEmail" element={
        customer && customerToken
          ? <Navigate to="/portal" replace />
          : <CustomerLoginPage onLogin={handleCustomerLogin} title="Portal Pembayaran" />
      } />
      <Route path="/bayar" element={
        customer && customerToken
          ? <Navigate to="/portal" replace />
          : <CustomerLoginPage onLogin={handleCustomerLogin} title="Portal Pembayaran" />
      } />

      {/* Customer Login via /login */}
      <Route path="/login" element={
        customer && customerToken
          ? <Navigate to="/portal" replace />
          : <CustomerLoginPage onLogin={handleCustomerLogin} title="Portal Pelanggan" />
      } />

      <Route path="/registrasi" element={
        customer && customerToken
          ? <Navigate to="/portal" replace />
          : <CustomerRegistrationPage />
      } />

      {/* Admin Login Route from Public Area */}
      <Route path="/admin/login" element={
        admin && token
          ? <Navigate to="/dashboard" replace />
          : <LoginPage onLogin={handleLogin} />
      } />
      <Route path="/admin" element={<Navigate to={admin && token ? "/dashboard" : "/admin/login"} replace />} />

      {/* Customer Portal — requires customer login */}
      <Route path="/portal" element={
        customer && customerToken
          ? <CustomerPortalPage onLogout={handleCustomerLogout} />
          : <Navigate to="/login" replace />
      } />

      {/* Fallback: redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;


import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function Navbar({ admin, onLogout, socket, onToggleSidebar, collapsed }) {
  var navigate = useNavigate();
  var [notifs, setNotifs] = useState([]);
  var [unreadCount, setUnreadCount] = useState(0);
  var [notifOpen, setNotifOpen] = useState(false);
  var [profileOpen, setProfileOpen] = useState(false);

  var notifRef = useRef(null);
  var profileRef = useRef(null);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  var fetchNotifications = function () {
    if (!token) return;
    axios.get(API_BASE_URL + '/api/notifikasi', { headers: headers })
      .then(function (res) {
        if (res.data.success) {
          var unreadNotifications = res.data.data.filter(function (n) { return n.status_baca === 0; });
          setNotifs(unreadNotifications);
          setUnreadCount(unreadNotifications.length);
        }
      })
      .catch(function (err) { console.error('Error fetching notifications in Nav:', err); });
  };

  useEffect(function () {
    fetchNotifications();

    // Close dropdowns if clicked outside
    var handleClickOutside = function (e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return function () {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to WebSocket triggers for notifications
  useEffect(function () {
    if (socket) {
      socket.on('pembayaran_masuk', function () {
        fetchNotifications();
      });
      socket.on('pelanggan_updated', function () {
        fetchNotifications();
      });
      socket.on('registrasi_masuk', fetchNotifications);
      socket.on('registrasi_updated', fetchNotifications);
      return function () {
        socket.off('pembayaran_masuk');
        socket.off('pelanggan_updated');
        socket.off('registrasi_masuk', fetchNotifications);
        socket.off('registrasi_updated', fetchNotifications);
      };
    }
  }, [socket]);

  var handleMarkRead = function (notif) {
    if (notif.status_baca === 1) return;
    axios.put(API_BASE_URL + '/api/notifikasi/' + notif.id_notifikasi + '/read', {}, { headers: headers })
      .then(function (res) {
        if (res.data.success) {
          fetchNotifications();
        }
      })
      .catch(function (err) { console.error(err); });
  };

  var handleMarkAllRead = function () {
    if (unreadCount === 0) return;
    axios.put(API_BASE_URL + '/api/notifikasi/read-all', {}, { headers: headers })
      .then(function (res) {
        if (res.data.success) {
          fetchNotifications();
        }
      })
      .catch(function (err) { console.error(err); });
  };

  function getInitials(nama) {
    if (!nama) return 'A';
    return nama.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  function formatTanggal(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <header className="topbar" style={{
      position: 'fixed',
      top: 0,
      left: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
      right: 0,
      height: 'var(--topbar-height)',
      background: '#004e5a',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      zIndex: 90,
      transition: 'left var(--transition-normal)',
      fontFamily: "'Hanken Grotesk', -apple-system, sans-serif",
      color: '#ffffff',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
    }}>
      {/* Left side: Hamburger and brand/info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#ffffff',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={function (e) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={function (e) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#ffffff';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
            {collapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.98rem', fontWeight: '800', letterSpacing: '-0.01em', color: '#ffffff' }}>
            Lintas Data Multimedia
          </span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
            Enhanced Service Platform
          </span>
        </div>
      </div>

      {/* Middle: Search bar */}
      {/* <div style={{ display: 'flex', flex: 1, maxWidth: '420px', margin: '0 24px', position: 'relative' }}>
        <span className="material-symbols-outlined" style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '1.15rem',
          pointerEvents: 'none'
        }}>
          search
        </span>
        <input
          type="text"
          placeholder="Cari pelanggan, tagihan, atau IP Mikrotik..."
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '24px',
            padding: '8px 16px 8px 40px',
            fontSize: '0.85rem',
            color: '#ffffff',
            width: '100%',
            outline: 'none',
            transition: 'all 0.2s ease'
          }}
          onFocus={function (e) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.1)';
          }}
          onBlur={function (e) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div> */}

      {/* Right side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <>
          {/* Mail Icon */}
          <Link
            to="/dashboard/reminder-logs"
            style={{
              color: '#ffffff',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={function (e) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#ffffff';
            }}
            title="Reminder Log"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
              mail
            </span>
          </Link>

          {/* Notifications Dropdown */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <div
              onClick={function () { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              style={{
                color: '#ffffff',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={function (e) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={function (e) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--status-merah)',
                  color: 'white',
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                }}>
                  {unreadCount}
                </span>
              )}
            </div>

            {/* Notifications Dropdown Panel */}
            {notifOpen && (
              <div className="animate-fadeIn" style={{
                position: 'absolute',
                top: '38px',
                right: '-10px',
                background: '#ffffff',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-color)',
                width: '320px',
                maxHeight: '400px',
                overflowY: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 110,
                color: 'var(--text-primary)'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Notifikasi ({unreadCount} baru)</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Tandai semua dibaca
                    </button>
                  )}
                </div>

                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Tidak ada notifikasi baru.
                    </div>
                  ) : (
                    notifs.map(function (n) {
                      var isUnread = n.status_baca === 0;
                      var isRegistration = n.tipe === 'registrasi_masuk';
                      var isMidtrans = n.bukti_file && n.bukti_file.includes('Midtrans');
                      var title = isRegistration ? 'Pendaftaran Pelanggan' : isMidtrans ? 'Pembayaran Midtrans' : 'Verifikasi Pembayaran';
                      var icon = isRegistration ? 'person_add' : 'payments';
                      var iconBg = isRegistration ? 'var(--status-biru-bg, #e0f2fe)' : isMidtrans ? 'var(--status-hijau-bg)' : 'var(--status-kuning-bg)';
                      var iconColor = isRegistration ? 'var(--primary)' : isMidtrans ? 'var(--status-hijau)' : 'var(--status-kuning)';

                      var desc = isRegistration
                        ? `${n.nama_pelanggan} mendaftar paket ${n.paket || '-'}`
                        : isMidtrans
                        ? `Pembayaran otomatis via Midtrans dari ${n.nama_pelanggan} (Periode ${n.periode})`
                        : `Pembayaran baru dari ${n.nama_pelanggan} (Periode ${n.periode})`;

                      var targetLink = isRegistration ? '/dashboard/registrasi' : `/dashboard/notifikasi?notifId=${n.id_notifikasi}`;

                      return (
                        <div
                          key={n.id_notifikasi}
                          onClick={function () {
                            if (isRegistration) navigate(targetLink);
                            else handleMarkRead(n);
                            setNotifOpen(false);
                          }}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border-color)',
                            background: isUnread ? 'rgba(0, 104, 118, 0.03)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '12px',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={function (e) { e.currentTarget.style.background = isUnread ? 'rgba(0, 104, 118, 0.03)' : 'transparent'; }}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: iconBg,
                            color: iconColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{icon}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Link to={targetLink} style={{ textDecoration: 'none', color: 'inherit' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{title}</div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', lineBreak: 'anywhere' }}>{desc}</div>
                            </Link>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formatTanggal(n.tanggal)}</div>
                          </div>
                          {isUnread && (
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--primary)',
                              display: 'inline-block',
                              marginTop: '4px',
                              flexShrink: 0
                            }} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* View All Footer */}
                <div style={{
                  padding: '10px 16px',
                  borderTop: '1px solid var(--border-color)',
                  textAlign: 'center',
                  background: 'var(--bg-primary)',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px'
                }}>
                  <Link
                    to="/dashboard/notifikasi"
                    onClick={function () { setNotifOpen(false); }}
                    style={{
                      color: 'var(--primary)',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      textDecoration: 'none',
                      display: 'block'
                    }}
                  >
                    {/* Lihat Semua Notifikasi */}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>

        {/* Grid / Menu Icon */}
        <Link
          to={admin && admin.role === 'admin' ? "/dashboard/laporan" : "/dashboard/kelola-admin"}
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={function (e) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={function (e) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#ffffff';
          }}
          title={admin && admin.role === 'admin' ? "Laporan Keuangan" : "Kelola Admin"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
            apps
          </span>
        </Link>

        {/* Vertical Separator */}
        <span style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />

        {/* Admin profile user dropdown */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div
            onClick={function () { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              padding: '4px 10px 4px 4px',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={function (e) { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={function (e) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0, 104, 118, 0.2)'
            }}>
              {getInitials(admin ? admin.nama : 'Admin')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }} className="desktop-only-flex">
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#ffffff' }}>{admin ? admin.nama : 'Admin LDM'}</span>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize', fontWeight: '600' }}>{admin ? admin.role : 'Administrator'}</span>
            </div>
          </div>

          {/* Profile Dropdown Panel */}
          {profileOpen && (
            <div className="animate-fadeIn" style={{
              position: 'absolute',
              top: '46px',
              right: 0,
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              width: '200px',
              zIndex: 110,
              color: 'var(--text-primary)',
              padding: '6px'
            }}>
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '4px'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700' }}>{admin ? admin.nama : 'Admin LDM'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>{admin ? admin.role : 'Administrator'}</div>
              </div>
              <Link
                to="/dashboard/profil"
                onClick={function () { setProfileOpen(false); }}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '6px',
                  textDecoration: 'none'
                }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person</span>
                Profil Admin
              </Link>
              <div
                onClick={onLogout}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: 'var(--status-merah)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--status-merah-bg)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>logout</span>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useLogo } from '../context/LogoContext';

function Sidebar({ admin, onLogout, socket, collapsed }) {
  var location = useLocation();
  var { logoUrl } = useLogo();
  var [profileOpen, setProfileOpen] = useState(false);
  var [notifCount, setNotifCount] = useState(0);
  var [pendingExpenseCount, setPendingExpenseCount] = useState(0);
  var [pendingRegistrationCount, setPendingRegistrationCount] = useState(0);
  var [unconfiguredPppoeCount, setUnconfiguredPppoeCount] = useState(0);
  var [pelangganOpen, setPelangganOpen] = useState(false);
  var [pembayaranOpen, setPembayaranOpen] = useState(false);

  function getInitials(nama) {
    if (!nama) return 'A';
    return nama.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  var fetchBadges = function () {
    if (!token) return;

    // Fetch unread notifications and pending payment verifications count for Log Notifikasi
    axios.get(API_BASE_URL + '/api/notifikasi', { headers: headers })
      .then(function (res) {
        if (res.data.success) {
          var unread = res.data.data.filter(function (n) {
            if (n.tipe === 'registrasi_masuk' || n.tipe === 'pengeluaran_masuk') return false;
            return n.status_baca === 0 || n.status_pembayaran === 'pending';
          });
          setNotifCount(unread.length);

          var pendingExpenses = res.data.data.filter(function (n) {
            return n.tipe === 'pengeluaran_masuk';
          });
          setPendingExpenseCount(pendingExpenses.length);
        }
      })
      .catch(function (err) { console.error('Sidebar error notifikasi:', err); });

    axios.get(API_BASE_URL + '/api/pelanggan/registrasi/pending', { headers: headers })
      .then(function (res) {
        if (res.data.success) setPendingRegistrationCount(res.data.data.length);
      })
      .catch(function (err) { console.error('Sidebar error pending registration:', err); });

    // Fetch customers without PPPoE count
    axios.get(API_BASE_URL + '/api/pelanggan/tanpa-pppoe', { headers: headers })
      .then(function (res) {
        if (res.data.success) setUnconfiguredPppoeCount(res.data.data.length);
      })
      .catch(function (err) { console.error('Sidebar error tanpa pppoe:', err); });
  };

  useEffect(function () {
    fetchBadges();
  }, [location.pathname]);

  // WebSocket real-time updates for counts
  useEffect(function () {
    if (socket) {
      socket.on('pembayaran_masuk', fetchBadges);
      socket.on('pelanggan_updated', fetchBadges);
      socket.on('registrasi_masuk', fetchBadges);
      socket.on('registrasi_updated', fetchBadges);
      socket.on('pengeluaran_masuk', fetchBadges);
      socket.on('pengeluaran_updated', fetchBadges);
      socket.on('notifikasi_updated', fetchBadges);
      return function () {
        socket.off('pembayaran_masuk');
        socket.off('pelanggan_updated');
        socket.off('registrasi_masuk', fetchBadges);
        socket.off('registrasi_updated', fetchBadges);
        socket.off('pengeluaran_masuk', fetchBadges);
        socket.off('pengeluaran_updated', fetchBadges);
        socket.off('notifikasi_updated', fetchBadges);
      };
    }
  }, [socket]);

  var userRole = (admin && admin.role) || 'admin';
  var isSuperAdmin = userRole === 'superadmin';

  var menuSections = [
    {
      section: 'Utama',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/dashboard/registrasi', label: 'Pendaftaran', icon: 'person_add', badge: pendingRegistrationCount },
        {
          path: '/dashboard/pelanggan',
          label: 'Pelanggan',
          icon: 'group',
          badge: unconfiguredPppoeCount,
          subItems: [
            { path: '/dashboard/pelanggan', label: 'Data Pelanggan' },
            { path: '/dashboard/pelanggan-tanpa-pppoe', label: 'Belum Ada PPPoE', badge: unconfiguredPppoeCount }
          ]
        },
        { path: '/dashboard/tagihan', label: 'Tagihan', icon: 'receipt_long' },
        {
          path: '/dashboard/pembayaran', label: 'Pembayaran', icon: 'payments',
          subItems: [
            { path: '/dashboard/pembayaran?type=manual', label: 'Transfer Manual' },
            { path: '/dashboard/pembayaran?type=duitku', label: 'Duitku Gateway' },
            { path: '/dashboard/pembayaran?type=midtrans', label: 'Midtrans' }
          ]
        },
        //  { path: '/dashboard/pelanggan', label: 'Pelanggan', icon: 'group' },
        // ...(!isSuperAdmin ? [
        // ] : [])
      ]
    },
    {
      section: 'Monitoring',
      items: [
        { path: '/dashboard/mikrotik', label: 'Status Jaringan', icon: 'router' },
        { path: '/dashboard/invoice-tagihan', label: 'Invoice Tagihan', icon: 'mail' },
        { path: '/dashboard/notifikasi', label: 'Log Notifikasi', icon: 'notifications', badge: notifCount },
        // { path: '/dashboard/invoice-tagihan', label: 'Reminder Log', icon: 'mail' },
        // ...(!isSuperAdmin ? [
        //    { path: '/dashboard/mikrotik', label: 'Status Jaringan', icon: 'router' },
        // ] : [])
      ]
    },
    {
      section: 'Laporan',
      items: [
        { path: '/dashboard/laporan', label: 'Laporan Keuangan', icon: 'bar_chart', badge: pendingExpenseCount }
      ]
    },
    {
      section: 'Lainnya',
      items: [
        ...(isSuperAdmin ? [
          { path: '/dashboard/kelola-admin', label: 'Kelola Admin', icon: 'manage_accounts' },
        ] : []),
        { path: '/dashboard/pengaturan', label: 'Pengaturan', icon: 'settings' },
        // ...(!isSuperAdmin ? [
        // ] : [])
      ]
    }
  ].filter(function (sec) { return sec.items && sec.items.length > 0; });

  return (
    <aside className={'sidebar ' + (collapsed ? 'collapsed' : '')} style={{
      background: '#ffffff',
      borderRight: '1px solid var(--border-color)',
      fontFamily: "'Hanken Grotesk', sans-serif"
    }}>
      {/* Brand Header */}
      <div className="sidebar-brand" style={{
        minHeight: 'var(--topbar-height)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: '0 24px',
        background: '#ffffff'
      }}>
        {collapsed ? (
          <img
            src={process.env.PUBLIC_URL + '/favicon.ico'}
            alt="Favicon"
            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
          />
        ) : (
          <img
            src={logoUrl}
            alt="Logo ESP"
            style={{ width: '135px', height: 'auto', maxHeight: '42px', objectFit: 'contain' }}
          />
        )}
      </div>

      {/* Admin Profile Card */}
      {!collapsed && (
        <div style={{
          padding: '20px 24px 10px 24px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div
            onClick={function () { setProfileOpen(!profileOpen); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: '8px',
              transition: 'background 0.2s ease',
              background: profileOpen ? 'var(--bg-secondary)' : 'transparent'
            }}
            onMouseEnter={function (e) {
              if (!profileOpen) e.currentTarget.style.background = 'var(--bg-primary)';
            }}
            onMouseLeave={function (e) {
              if (!profileOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div className="sidebar-avatar" style={{
              width: '42px',
              height: '42px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: '700',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {getInitials(admin ? admin.nama : 'Admin')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {admin ? admin.nama : 'Admin LDM'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                {admin && admin.role === 'superadmin' ? 'Superadmin' : 'Administrator'}
              </div>
            </div>
            <span className="material-symbols-outlined" style={{
              fontSize: '1.1rem',
              color: 'var(--text-muted)',
              transform: profileOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}>
              keyboard_arrow_down
            </span>
          </div>

          {/* Collapsible Dropdown content */}
          {profileOpen && (
            <div className="animate-fadeIn" style={{
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'var(--bg-primary)',
              borderRadius: '8px',
              padding: '6px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                borderRadius: '6px',
                textDecoration: 'none'
              }}
                onClick={function () { window.location.href = '/dashboard/profil'; }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person</span>
                Profil Saya
              </div>
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
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--status-merah-bg)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>logout</span>
                Keluar (Logout)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Links */}
      <nav className="sidebar-nav" style={{ padding: '20px 14px' }}>
        {menuSections.map(function (section, sIdx) {
          return (
            <div className="sidebar-section" key={sIdx} style={{ marginBottom: '22px' }}>
              {!collapsed && (
                <div className="sidebar-section-title" style={{
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  padding: '0 12px',
                  marginBottom: '10px'
                }}>
                  {section.section}
                </div>
              )}
              {section.items.map(function (item, iIdx) {
                var hasSubItems = item.subItems && item.subItems.length > 0;
                var isCleanActive = location.pathname === item.path.split('?')[0];
                var isParentActive = isCleanActive || (hasSubItems && item.subItems.some(function (sub) {
                  return location.pathname === sub.path.split('?')[0];
                }));
                var isActive = isParentActive || (item.path.includes('action') && location.pathname + location.search === item.path);

                var isExpanded = false;
                if (hasSubItems) {
                  if (item.label === 'Pelanggan') {
                    isExpanded = pelangganOpen || location.pathname.startsWith('/dashboard/pelanggan');
                  } else if (item.label === 'Pembayaran') {
                    isExpanded = pembayaranOpen || location.pathname.startsWith('/dashboard/pembayaran');
                  } else {
                    isExpanded = location.pathname.startsWith(item.path.split('?')[0]);
                  }
                }

                // Render collapsible menu if subItems exist
                if (hasSubItems) {
                  return (
                    <div key={iIdx} style={{ display: 'flex', flexDirection: 'column' }}>
                      <Link
                        to={item.path}
                        onClick={function (e) {
                          if (!collapsed) {
                            e.preventDefault();
                            if (item.label === 'Pelanggan') {
                              setPelangganOpen(!pelangganOpen);
                            } else if (item.label === 'Pembayaran') {
                              setPembayaranOpen(!pembayaranOpen);
                            }
                          }
                        }}
                        className={'sidebar-link' + (isParentActive ? ' active' : '')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: collapsed ? '0' : '12px',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          color: isParentActive ? 'var(--primary)' : 'var(--text-secondary)',
                          background: isParentActive ? 'var(--primary-glow)' : 'transparent',
                          fontWeight: isParentActive ? '700' : '600',
                          textDecoration: 'none',
                          marginBottom: '4px',
                          fontSize: '0.88rem',
                          transition: 'all 0.25s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={function (e) {
                          if (!isParentActive) {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={function (e) {
                          if (!isParentActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: '1.3rem',
                            color: isCleanActive ? 'var(--primary)' : 'var(--text-muted)'
                          }}
                        >
                          {item.icon}
                        </span>
                        {!collapsed && <span>{item.label}</span>}

                        {!collapsed && item.badge > 0 && (
                          <span style={{
                            marginLeft: 'auto',
                            background: 'var(--status-merah)',
                            color: '#ffffff',
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: item.badge > 9 ? '2px 6px' : '2px 5px',
                            borderRadius: '10px',
                            lineHeight: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                          }}>
                            {item.badge}
                          </span>
                        )}

                        {!collapsed && (
                          <span className="material-symbols-outlined" style={{
                            fontSize: '1.1rem',
                            color: 'var(--text-muted)',
                            marginLeft: item.badge > 0 ? '6px' : 'auto',
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease'
                          }}>
                            keyboard_arrow_down
                          </span>
                        )}
                      </Link>

                      {/* Sub Items List */}
                      {isExpanded && !collapsed && (
                        <div style={{
                          paddingLeft: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          marginTop: '2px',
                          marginBottom: '8px',
                          borderLeft: '1px solid var(--border-color)',
                          marginLeft: '20px'
                        }}>
                          {item.subItems.map(function (subItem, sIdx) {
                            var isSubActive = (location.pathname + location.search === subItem.path) ||
                              (location.pathname === subItem.path.split('?')[0] && !subItem.path.includes('?')) ||
                              (subItem.path === '/dashboard/pembayaran?type=manual' && (location.pathname + location.search === '/dashboard/pembayaran' || location.pathname + location.search === '/dashboard/pembayaran?type=manual'));

                            return (
                              <Link
                                key={sIdx}
                                to={subItem.path}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  color: isSubActive ? 'var(--primary)' : 'var(--text-secondary)',
                                  background: isSubActive ? 'var(--primary-glow)' : 'transparent',
                                  fontWeight: isSubActive ? '700' : '600',
                                  textDecoration: 'none',
                                  fontSize: '0.82rem',
                                  transition: 'all 0.2s ease',
                                  position: 'relative'
                                }}
                                onMouseEnter={function (e) {
                                  if (!isSubActive) {
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                  }
                                }}
                                onMouseLeave={function (e) {
                                  if (!isSubActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                  }
                                }}
                              >
                                <span>{subItem.label}</span>
                                {subItem.badge > 0 && (
                                  <span style={{
                                    marginLeft: 'auto',
                                    background: 'var(--status-merah)',
                                    color: '#ffffff',
                                    fontSize: '0.62rem',
                                    fontWeight: '700',
                                    padding: '1px 4px',
                                    borderRadius: '8px',
                                    lineHeight: 1
                                  }}>
                                    {subItem.badge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Standard link rendering
                return (
                  <Link
                    key={iIdx}
                    to={item.path}
                    className={'sidebar-link' + (isActive ? ' active' : '')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: collapsed ? '0' : '12px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--primary-glow)' : 'transparent',
                      fontWeight: isActive ? '700' : '600',
                      textDecoration: 'none',
                      marginBottom: '4px',
                      fontSize: '0.88rem',
                      transition: 'all 0.25s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={function (e) {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={function (e) {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: '1.3rem',
                        color: isActive ? 'var(--primary)' : 'var(--text-muted)'
                      }}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && <span>{item.label}</span>}

                    {/* Badge */}
                    {item.badge > 0 && (
                      <span style={{
                        position: collapsed ? 'absolute' : 'static',
                        top: collapsed ? '4px' : 'auto',
                        right: collapsed ? '4px' : 'auto',
                        marginLeft: collapsed ? '0' : 'auto',
                        background: 'var(--status-merah)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        padding: item.badge > 9 ? '2px 6px' : '2px 5px',
                        borderRadius: '10px',
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;

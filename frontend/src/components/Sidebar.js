import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function Sidebar({ admin, onLogout, socket, collapsed }) {
  var location = useLocation();
  var [profileOpen, setProfileOpen] = useState(false);
  var [pendingCount, setPendingCount] = useState(0);
  var [unreadNotifCount, setUnreadNotifCount] = useState(0);

  function getInitials(nama) {
    if (!nama) return 'A';
    return nama.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  var fetchBadges = function() {
    if (!token) return;
    
    // Fetch pending payment verifications count
    axios.get(API_BASE_URL + '/api/pembayaran/pending', { headers: headers })
      .then(function(res) {
        if (res.data.success) {
          setPendingCount(res.data.data.length);
        }
      })
      .catch(function(err) { console.error('Sidebar error pending payment:', err); });

    // Fetch unread notifications count
    axios.get(API_BASE_URL + '/api/notifikasi', { headers: headers })
      .then(function(res) {
        if (res.data.success) {
          var unread = res.data.data.filter(function(n) { return n.status_baca === 0; }).length;
          setUnreadNotifCount(unread);
        }
      })
      .catch(function(err) { console.error('Sidebar error notifications:', err); });
  };

  useEffect(function() {
    fetchBadges();
  }, [location.pathname]);

  // WebSocket real-time updates for counts
  useEffect(function() {
    if (socket) {
      socket.on('pembayaran_masuk', function() {
        fetchBadges();
      });
      socket.on('pelanggan_updated', function() {
        fetchBadges();
      });
      return function() {
        socket.off('pembayaran_masuk');
        socket.off('pelanggan_updated');
      };
    }
  }, [socket]);

  var menuSections = [
    {
      section: 'Utama',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/dashboard/pelanggan', label: 'Pelanggan', icon: 'group' },
        { path: '/dashboard/pelanggan?action=tagihan', label: 'Tagihan', icon: 'receipt_long' },
        { path: '/dashboard/pembayaran', label: 'Pembayaran', icon: 'payments', badge: pendingCount }
      ]
    },
    {
      section: 'Monitoring',
      items: [
        { path: '/dashboard/mikrotik', label: 'Status Jaringan', icon: 'router' },
        { path: '/dashboard/reminder-logs', label: 'Reminder Log', icon: 'mail' },
        { path: '/dashboard/laporan', label: 'Laporan Keuangan', icon: 'bar_chart' }
      ]
    },
    {
      section: 'Lainnya',
      items: [
        { path: '/dashboard/laporan?action=pengeluaran', label: 'Pengeluaran', icon: 'account_balance_wallet' },
      //  { path: '/dashboard?action=notifikasi', label: 'Notifikasi', icon: 'notifications', badge: unreadNotifCount },
        { path: '/dashboard/pembayaran', label: 'Notifikasi', icon: 'notifications', badge: unreadNotifCount },
        { path: '/dashboard?action=pengaturan', label: 'Pengaturan', icon: 'settings' }
      ]
    }
  ];

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
            src={process.env.PUBLIC_URL + '/logo_ldm.png'}
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
            onClick={function() { setProfileOpen(!profileOpen); }}
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
            onMouseEnter={function(e) {
              if(!profileOpen) e.currentTarget.style.background = 'var(--bg-primary)';
            }}
            onMouseLeave={function(e) {
              if(!profileOpen) e.currentTarget.style.background = 'transparent';
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
                borderRadius: '6px'
              }}
              onMouseEnter={function(e) { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
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
                onMouseEnter={function(e) { e.currentTarget.style.background = 'var(--status-merah-bg)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
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
                var isCleanActive = location.pathname === item.path.split('?')[0];
                var isActive = isCleanActive || (item.path.includes('action') && location.pathname + location.search === item.path);
                
                // Special highlight if active
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
                    onMouseEnter={function(e) {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={function(e) {
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
                        background: item.icon === 'notifications' ? 'var(--primary)' : 'var(--status-merah)',
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

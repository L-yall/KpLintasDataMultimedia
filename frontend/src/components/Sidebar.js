import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Sidebar({ admin, onLogout }) {
  var location = useLocation();

  var menuItems = [
    {
      section: 'Menu Utama',
      items: [
        {
          path: '/dashboard',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
          ),
          label: 'Dashboard'
        },
        {
          path: '/dashboard/pelanggan',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" />
              <circle cx="10" cy="7" r="3" />
              <path d="M19 8a2.5 2.5 0 1 0 0 5" />
              <path d="M19 13v1" />
            </svg>
          ),
          label: 'Pelanggan'
        },
        {
          path: '/dashboard/paket',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          ),
          label: 'Paket Layanan'
        },
        {
          path: '/dashboard/mikrotik',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2v20" />
              <path d="M2 12h20" />
              <path d="M12 6 8 2" />
              <path d="M12 18 16 22" />
            </svg>
          ),
          label: 'Mikrotik'
        },
        {
          path: '/dashboard/reminder-logs',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          ),
          label: 'Log Reminder Email'
        },
        {
          path: '/dashboard/pembayaran',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M7 15h.01" />
            </svg>
          ),
          label: 'Persetujuan Bayar'
        },
        {
          path: '/dashboard/laporan',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h9l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              <path d="M14 3v4h4" />
              <path d="M8 13h8" />
              <path d="M8 17h5" />
            </svg>
          ),
          label: 'Laporan Keuangan'
        },
      ]
    }
  ];

  function getInitials(nama) {
    if (!nama) return 'A';
    return nama.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <img
            src={process.env.PUBLIC_URL + '/logo ldm.png'}
            alt="Logo LDM"
            className="sidebar-logo"
            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
          />
        </div>
        <div className="sidebar-brand-text">
          <h2>ESP Lintas Data</h2>
          <span>ISP Dashboard</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(function (section, sIdx) {
          return (
            <div className="sidebar-section" key={sIdx}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map(function (item, iIdx) {
                var isActive = location.pathname === item.path;
                if (item.disabled) {
                  return (
                    <div
                      key={iIdx}
                      className="sidebar-link"
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}
                    >
                      <span className="sidebar-link-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={iIdx}
                    to={item.path}
                    className={'sidebar-link' + (isActive ? ' active' : '')}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {getInitials(admin ? admin.nama : 'Admin')}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{admin ? admin.nama : 'Admin'}</div>
            <div className="sidebar-user-role">Administrator</div>
          </div>
          <button className="sidebar-logout" onClick={onLogout} title="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

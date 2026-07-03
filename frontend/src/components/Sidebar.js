import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Sidebar({ admin, onLogout }) {
  var location = useLocation();

  var menuItems = [
    {
      section: 'Menu Utama',
      items: [
        { path: '/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/dashboard/pelanggan', icon: '👥', label: 'Pelanggan' },
        { path: '/dashboard/paket', icon: '📦', label: 'Paket Layanan' },
        { path: '/dashboard/mikrotik', icon: '🌐', label: 'Mikrotik' },
        { path: '/dashboard/reminder-logs', icon: '🔔', label: 'Log Reminder Email' },
        { path: '/dashboard/pembayaran', icon: '💰', label: 'Persetujuan Bayar' },
        { path: '/dashboard/laporan', icon: '📄', label: 'Laporan Keuangan' },
      ]
    }
  ];

  function getInitials(nama) {
    if (!nama) return 'A';
    return nama.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🌐</div>
        <div className="sidebar-brand-text">
          <h2>ESP Lintas Data</h2>
          <span>ISP Dashboard</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(function(section, sIdx) {
          return (
            <div className="sidebar-section" key={sIdx}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map(function(item, iIdx) {
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
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

import React from 'react';
import TemplateIcon from './TemplateIcon';

function MikrotikStatus({ status }) {
  var isOnline = status && status.online;

  return (
    <div className="card animate-fadeIn" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
      <div style={{
        position: 'relative',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: isOnline ? 'var(--status-hijau)' : 'var(--status-merah)',
        boxShadow: isOnline ? '0 0 10px var(--status-hijau)' : '0 0 10px var(--status-merah)'
      }}>
        {isOnline && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid var(--status-hijau)',
            animation: 'pulse 1.8s infinite'
          }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Koneksi Router Mikrotik
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {isOnline ? (
            <span><TemplateIcon name="router" size={14} style={{ marginRight: '6px' }} /> Online ({status.board} - v{status.version})</span>
          ) : (
            <span><TemplateIcon name="alert" size={14} style={{ marginRight: '6px' }} /> Offline ({status.error || 'Router tidak terjangkau'})</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MikrotikStatus;

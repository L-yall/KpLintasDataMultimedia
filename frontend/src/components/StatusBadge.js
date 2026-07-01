import React from 'react';

function StatusBadge({ status }) {
  var labels = {
    hijau: 'Lunas',
    kuning: 'Mendekati Jatuh Tempo',
    merah: 'Menunggak',
    abu_abu: 'Tidak Aktif',
    abu: 'Tidak Aktif'
  };

  // Map abu_abu ke abu untuk CSS class
  var cssClass = status === 'abu_abu' ? 'abu' : (status || 'abu');
  var label = labels[status] || status;

  return (
    <span className={'status-badge ' + cssClass}>
      {label}
    </span>
  );
}

export default StatusBadge;

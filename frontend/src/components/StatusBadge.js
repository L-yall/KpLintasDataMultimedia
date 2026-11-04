import React from 'react';

function StatusBadge({ status }) {
  var labels = {
    hijau: 'Lunas',
    kuning: 'Mendekati Jatuh Tempo',
    merah: 'Menunggak',
    abu_abu: 'Belum Ditentukan',
    abu: 'Belum Ditentukan'
  };

  // Map abu_abu ke abu untuk CSS class
  var cssClass = status === 'abu_abu' ? 'abu' : (status || 'abu');
  var label = labels[status] || 'Belum Ditentukan';

  return (
    <span className={'status-badge ' + cssClass}>
      {label}
    </span>
  );
}

export default StatusBadge;

import React from 'react';

function TemplateIcon({ name, size = 18, color = 'currentColor', strokeWidth = 1.8, className }) {
  var commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: className
  };

  switch (name) {
    case 'globe':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10" />
        </svg>
      );
    case 'key':
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="15" r="4" />
          <path d="M10.5 12.5 19 4" />
          <path d="m15 8 2 2" />
          <path d="m17 6 2 2" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...commonProps}>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...commonProps}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'check':
      return (
        <svg {...commonProps}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
    case 'loading':
      return (
        <svg {...commonProps}>
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="m4.93 4.93 2.83 2.83" />
          <path d="m16.24 16.24 2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="m4.93 19.07 2.83-2.83" />
          <path d="m16.24 7.76 2.83-2.83" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...commonProps}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...commonProps}>
          <path d="M12 3v12" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...commonProps}>
          <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'chart-up':
      return (
        <svg {...commonProps}>
          <path d="M3 18h18" />
          <path d="m5 14 4-4 3 3 5-6" />
          <path d="m14 7h4v4" />
        </svg>
      );
    case 'chart-down':
      return (
        <svg {...commonProps}>
          <path d="M3 18h18" />
          <path d="m5 10 4 4 3-3 5 6" />
          <path d="m14 17h4v-4" />
        </svg>
      );
    case 'money':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
          <path d="M7 8v8" />
          <path d="M17 8v8" />
        </svg>
      );
    case 'package':
      return (
        <svg {...commonProps}>
          <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
          <path d="m4 7 8 4 8-4" />
          <path d="m12 11 8-4" />
          <path d="M12 11v10" />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M15 17H3a1 1 0 0 1-.8-1.6l1.6-2.13A5 5 0 0 0 5 10V8a7 7 0 0 1 14 0v2a5 5 0 0 0 1.2 3.27l1.6 2.13A1 1 0 0 1 21 17h-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...commonProps}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 16l-4 1 1-4 12.5-12.5Z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...commonProps}>
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...commonProps}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      );
    case 'router':
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M10 16h4" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...commonProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'close':
      return (
        <svg {...commonProps}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case 'document':
      return (
        <svg {...commonProps}>
          <path d="M7 3h7l4 4v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v4h4" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3 5 6v6c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" />
        </svg>
      );
    default:
      return null;
  }
}

export default TemplateIcon;

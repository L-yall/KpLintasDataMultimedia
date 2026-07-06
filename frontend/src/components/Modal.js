import React from 'react';
import TemplateIcon from './TemplateIcon';

function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}><TemplateIcon name="close" size={16} /></button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;

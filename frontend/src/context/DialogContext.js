import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './DialogContext.css';

const DialogContext = createContext(null);

const toneLabels = {
  info: 'Informasi',
  success: 'Berhasil',
  error: 'Terjadi kesalahan',
  warning: 'Periksa kembali',
  danger: 'Konfirmasi tindakan'
};

function DialogIcon({ tone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tone === 'success' ? (
        <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>
      ) : tone === 'danger' ? (
        <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>
      ) : tone === 'error' ? (
        <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>
      ) : tone === 'warning' ? (
        <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 4h.01" /></>
      ) : (
        <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>
      )}
    </svg>
  );
}

function DialogView({ request, onClose }) {
  const { kind, message, options } = request;
  const tone = options.tone || 'info';
  const autoDismiss = kind === 'alert';
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const cancelRef = useRef(null);
  const closeRef = useRef(null);
  const acceptRef = useRef(null);
  const [value, setValue] = useState(options.defaultValue || '');
  const [error, setError] = useState('');
  const canCancel = kind !== 'alert';
  const cancelValue = kind === 'prompt' ? null : false;

  useEffect(() => {
    const initialFocus = kind === 'prompt' ? inputRef.current : (canCancel ? cancelRef.current : (autoDismiss ? closeRef.current : acceptRef.current));
    initialFocus?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose(cancelValue);
      } else if (event.key === 'Tab') {
        const controls = Array.from(panelRef.current.querySelectorAll('button, textarea, input, [tabindex="0"]'))
          .filter(element => !element.disabled);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [kind, canCancel, cancelValue, autoDismiss, onClose]);

  useEffect(() => {
    if (!autoDismiss) return undefined;
    const timer = setTimeout(() => onClose(true), 1500);
    return () => clearTimeout(timer);
  }, [autoDismiss, onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    if (kind === 'prompt' && options.required && !value.trim()) {
      setError('Bagian ini wajib diisi.');
      inputRef.current?.focus();
      return;
    }
    onClose(kind === 'prompt' ? value : true);
  }

  return (
    <div className="app-dialog-backdrop" data-testid="app-dialog-backdrop">
      <section
        ref={panelRef}
        className={'app-dialog app-dialog--' + tone}
        role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <button ref={closeRef} className="app-dialog-close" type="button" aria-label="Tutup dialog" onClick={() => onClose(cancelValue)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <form onSubmit={handleSubmit} noValidate>
          <div className="app-dialog-content">
            <div className="app-dialog-icon"><DialogIcon tone={tone} /></div>
            <p className="app-dialog-eyebrow">Lintas Data Multimedia</p>
            <h2 id={titleId}>{options.title || (kind === 'prompt' ? 'Tambahkan keterangan' : kind === 'confirm' ? 'Konfirmasi tindakan' : toneLabels[tone])}</h2>
            <p className="app-dialog-message" id={descriptionId}>{message}</p>
            {kind === 'prompt' && (
              <div className="app-dialog-field">
                <label htmlFor={titleId + '-input'}>{options.inputLabel || 'Keterangan'}{!options.required && <span> (opsional)</span>}</label>
                <textarea
                  ref={inputRef}
                  id={titleId + '-input'}
                  value={value}
                  onChange={event => { setValue(event.target.value); setError(''); }}
                  placeholder={options.placeholder || 'Tulis keterangan Anda di sini...'}
                  rows={3}
                  required={options.required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
                {error && <p className="app-dialog-field-error" id={errorId} role="alert">{error}</p>}
              </div>
            )}
          </div>
          {!autoDismiss && (
            <div className="app-dialog-actions">
              {canCancel && <button ref={cancelRef} type="button" className="app-dialog-button app-dialog-button--cancel" onClick={() => onClose(cancelValue)}>{options.cancelLabel || 'Batal'}</button>}
              <button ref={acceptRef} type="submit" className="app-dialog-button app-dialog-button--accept">{options.confirmLabel || (kind === 'alert' ? 'Mengerti' : kind === 'prompt' ? 'Simpan keterangan' : 'Ya, lanjutkan')}</button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

export function DialogProvider({ children }) {
  const queueRef = useRef([]);
  const activeRef = useRef(null);
  const nextIdRef = useRef(0);
  const returnFocusRef = useRef(null);
  const [active, setActive] = useState(null);
  const [portalHost] = useState(() => document.createElement('div'));

  useEffect(() => {
    portalHost.className = 'app-dialog-portal';
    document.body.appendChild(portalHost);
    return () => {
      portalHost.remove();
      const pending = [activeRef.current, ...queueRef.current].filter(Boolean);
      activeRef.current = null;
      queueRef.current = [];
      pending.forEach(request => request.resolve(request.kind === 'prompt' ? null : false));
    };
  }, [portalHost]);

  const openDialog = useCallback((kind, message, options = {}) => new Promise(resolve => {
    const request = { id: ++nextIdRef.current, kind, message: String(message ?? ''), options, resolve };
    if (activeRef.current) {
      queueRef.current.push(request);
    } else {
      returnFocusRef.current = document.activeElement;
      activeRef.current = request;
      setActive(request);
    }
  }), []);

  const closeDialog = useCallback(result => {
    const current = activeRef.current;
    if (!current) return;
    const next = queueRef.current.shift() || null;
    activeRef.current = next;
    setActive(next);
    current.resolve(result);
  }, []);

  const isOpen = Boolean(active);
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    // Keep existing page modals behind the dialog inaccessible until it closes.
    const background = Array.from(document.body.children).filter(element => element !== portalHost);
    const previousInert = background.map(element => element.hasAttribute('inert'));
    background.forEach(element => element.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => {
        if (!previousInert[index]) element.removeAttribute('inert');
      });
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [isOpen, portalHost]);

  const showAlert = useCallback((message, options) => openDialog('alert', message, options), [openDialog]);
  const confirmDialog = useCallback((message, options) => openDialog('confirm', message, options), [openDialog]);
  const promptDialog = useCallback((message, options) => openDialog('prompt', message, options), [openDialog]);

  return (
    <DialogContext.Provider value={{ showAlert, confirmDialog, promptDialog }}>
      {children}
      {active && createPortal(<DialogView key={active.id} request={active} onClose={closeDialog} />, portalHost)}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog harus digunakan di dalam DialogProvider.');
  return context;
}

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useDialog } from '../context/DialogContext';
import './RouterManagementPanel.css';

const ROUTERS_URL = API_BASE_URL + '/api/routers';

function isEnabled(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function savedAdmin() {
  try {
    return JSON.parse(localStorage.getItem('admin') || 'null');
  } catch {
    return null;
  }
}

function requestConfig() {
  const token = localStorage.getItem('token');
  return { headers: token ? { Authorization: 'Bearer ' + token } : {} };
}

function responseBody(response, fallback) {
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || fallback);
  }
  return response.data;
}

function errorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

function routerPayload(router) {
  return {
    nama_router: router.nama_router.trim(),
    lokasi: (router.lokasi || '').trim(),
    host: router.host.trim(),
    port: Number(router.port),
    username: router.username.trim(),
    is_active: isEnabled(router.is_active)
  };
}

function RouterManagementPanel({ admin } = {}) {
  const { showAlert, confirmDialog } = useDialog();
  const currentAdmin = admin ?? savedAdmin();
  const isSuperAdmin = currentAdmin?.role === 'superadmin';
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState(null);
  const [validation, setValidation] = useState({});
  const [operation, setOperation] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [page, setPage] = useState(1);
  const operationRef = useRef(false);
  const requestRef = useRef(0);
  const nameRef = useRef(null);
  const returnFocusRef = useRef(null);
  const panelId = useId();
  const editorKey = form ? (form.id ?? 'new') : null;
  const busy = Boolean(operation);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(routers.length / itemsPerPage));
  const paginatedRouters = routers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const loadRouters = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const body = responseBody(await axios.get(ROUTERS_URL, requestConfig()), 'Gagal memuat router.');
      if (!Array.isArray(body.data)) throw new Error('Daftar router tidak valid.');
      if (requestId === requestRef.current) setRouters(body.data);
    } catch (error) {
      if (requestId === requestRef.current) {
        setLoadFailed(true);
        showAlert(errorMessage(error, 'Gagal memuat router.'), { tone: 'error' });
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadRouters();
    return () => { requestRef.current += 1; };
  }, [loadRouters]);

  useEffect(() => {
    if (editorKey !== null) nameRef.current?.focus();
  }, [editorKey]);

  function beginOperation(type, id) {
    // The ref also guards repeated submits before React updates disabled controls.
    if (!isSuperAdmin || operationRef.current || loading || loadFailed) return false;
    operationRef.current = true;
    setOperation({ type, id });
    return true;
  }

  function endOperation() {
    operationRef.current = false;
    setOperation(null);
  }

  function clearTest(id) {
    setTestResults(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function openEditor(router, trigger) {
    if (!isSuperAdmin || operationRef.current) return;
    returnFocusRef.current = trigger;
    setValidation({});
    setForm({
      id: router?.id_router ?? null,
      nama_router: router?.nama_router || '',
      lokasi: router?.lokasi || '',
      host: router?.host || '',
      port: String(router?.port ?? 8728),
      username: router?.username || '',
      password: '',
      is_active: router ? isEnabled(router.is_active) : true,
      originallyActive: router ? isEnabled(router.is_active) : false
    });
  }

  function closeEditor() {
    setForm(null);
    setValidation({});
    returnFocusRef.current?.focus();
  }

  function changeField(event) {
    const { name, type, checked, value } = event.target;
    setForm(previous => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
    setValidation(previous => ({ ...previous, [name]: '' }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!isSuperAdmin || !form || operationRef.current) return;
    const errors = {};
    ['nama_router', 'host', 'username'].forEach(field => {
      if (!form[field].trim()) errors[field] = 'Bagian ini wajib diisi.';
    });
    if (!/^\d+$/.test(form.port) || Number(form.port) < 1 || Number(form.port) > 65535) {
      errors.port = 'Port harus berupa bilangan bulat antara 1 dan 65535.';
    }
    if (form.id === null && !form.password.trim()) errors.password = 'Password wajib diisi untuk router baru.';
    setValidation(errors);
    if (Object.keys(errors).length) {
      event.currentTarget.elements.namedItem(Object.keys(errors)[0])?.focus();
      return;
    }
    if (!beginOperation('save', form.id)) return;
    try {
      if (form.originallyActive && !form.is_active) {
        const confirmed = await confirmDialog(`Nonaktifkan pengelolaan router "${form.nama_router}"? Pelanggan yang memakai router ini dapat terdampak.`, {
          title: 'Nonaktifkan Router', tone: 'warning', confirmLabel: 'Nonaktifkan', cancelLabel: 'Batal'
        });
        if (!confirmed) return;
      }
      const payload = routerPayload(form);
      // Omitting an empty edit password preserves the server-side secret.
      if (form.password.trim()) payload.password = form.password;
      const response = form.id === null
        ? await axios.post(ROUTERS_URL, payload, requestConfig())
        : await axios.put(ROUTERS_URL + '/' + form.id, payload, requestConfig());
      responseBody(response, 'Gagal menyimpan router.');
      if (form.id !== null) clearTest(form.id);
      closeEditor();
      showAlert(form.id === null ? 'Router berhasil ditambahkan.' : 'Router berhasil diperbarui.', { tone: 'success' });
      await loadRouters();
    } catch (error) {
      showAlert(errorMessage(error, 'Gagal menyimpan router.'), { tone: 'error' });
    } finally {
      endOperation();
    }
  }

  async function handleDelete(router) {
    if (!beginOperation('delete', router.id_router)) return;
    try {
      const confirmed = await confirmDialog(`Hapus router "${router.nama_router}"? Tindakan ini tidak dapat dibatalkan. Router yang masih digunakan pelanggan tidak dapat dihapus.`, {
        title: 'Hapus Router', tone: 'danger', confirmLabel: 'Hapus Router', cancelLabel: 'Batal'
      });
      if (!confirmed) return;
      responseBody(await axios.delete(ROUTERS_URL + '/' + router.id_router, requestConfig()), 'Gagal menghapus router.');
      setRouters(previous => previous.filter(item => item.id_router !== router.id_router));
      clearTest(router.id_router);
      showAlert('Router berhasil dihapus.', { tone: 'success' });
      await loadRouters();
    } catch (error) {
      showAlert(errorMessage(error, 'Gagal menghapus router.'), { tone: 'error' });
    } finally {
      endOperation();
    }
  }

  async function handleToggle(router) {
    if (!beginOperation('toggle', router.id_router)) return;
    const active = isEnabled(router.is_active);
    try {
      if (active) {
        const confirmed = await confirmDialog(`Nonaktifkan pengelolaan router "${router.nama_router}"? Pelanggan yang memakai router ini dapat terdampak.`, {
          title: 'Nonaktifkan Router', tone: 'warning', confirmLabel: 'Nonaktifkan', cancelLabel: 'Batal'
        });
        if (!confirmed) return;
      }
      const payload = { is_active: !active };
      responseBody(await axios.put(ROUTERS_URL + '/' + router.id_router, payload, requestConfig()), 'Gagal mengubah status router.');
      clearTest(router.id_router);
      showAlert(active ? 'Pengelolaan router dinonaktifkan.' : 'Pengelolaan router diaktifkan.', { tone: 'success' });
      await loadRouters();
    } catch (error) {
      showAlert(errorMessage(error, 'Gagal mengubah status router.'), { tone: 'error' });
    } finally {
      endOperation();
    }
  }

  async function handleTest(router) {
    if (!beginOperation('test', router.id_router)) return;
    clearTest(router.id_router);
    try {
      const body = responseBody(await axios.post(ROUTERS_URL + '/' + router.id_router + '/test', {}, requestConfig()), 'Gagal menguji koneksi router.');
      if (typeof body.data?.online !== 'boolean') throw new Error('Hasil tes koneksi tidak valid.');
      setTestResults(previous => ({ ...previous, [router.id_router]: { online: body.data.online, testedAt: new Date().toISOString() } }));
      showAlert(body.data.online ? `Router "${router.nama_router}" online saat diuji.` : `Router "${router.nama_router}" offline saat diuji.`, { tone: body.data.online ? 'success' : 'warning' });
    } catch (error) {
      setTestResults(previous => ({ ...previous, [router.id_router]: { error: true } }));
      showAlert(errorMessage(error, 'Gagal menguji koneksi router.'), { tone: 'error' });
    } finally {
      endOperation();
    }
  }

  function renderField(name, label, options = {}) {
    const { help, ...inputProps } = options;
    const id = panelId + '-' + name;
    return (
      <div className="router-panel-field">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          name={name}
          type="text"
          {...inputProps}
          ref={name === 'nama_router' ? nameRef : undefined}
          value={form[name]}
          onChange={changeField}
          aria-invalid={Boolean(validation[name])}
          aria-describedby={[help ? id + '-help' : '', validation[name] ? id + '-error' : ''].filter(Boolean).join(' ') || undefined}
        />
        {help && <small id={id + '-help'}>{help}</small>}
        {validation[name] && <span className="router-panel-field-error" id={id + '-error'} role="alert">{validation[name]}</span>}
      </div>
    );
  }

  const actionsDisabled = busy || loading || loadFailed || Boolean(form);
  const activeCount = routers.filter(router => isEnabled(router.is_active)).length;
  const customerCount = routers.reduce((sum, router) => sum + (Number(router.jumlah_pelanggan) || 0), 0);

  function renderPagination() {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let p = 1; p <= totalPages; p++) pages.push(p);

    return (
      <nav aria-label="Page navigation" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
        <ul className="pagination" style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', margin: 0, padding: 0, listStyle: 'none' }}>
          <li className={'page-item' + (page === 1 ? ' disabled' : '')}>
            <a href="#" className="router-page-button page-link" onClick={e => { e.preventDefault(); if (page !== 1) setPage(Math.max(1, page - 1)); }} aria-label="Previous" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}>«</a>
          </li>
          {pages.map(pageNumber => (
            <li key={pageNumber}>
              <a href="#" className={'router-page-button page-link' + (page === pageNumber ? ' active' : '')} onClick={e => { e.preventDefault(); setPage(pageNumber); }} aria-label={'Halaman ' + pageNumber} aria-current={page === pageNumber ? 'page' : undefined}>{pageNumber}</a>
            </li>
          ))}
          <li className={'page-item' + (page === totalPages ? ' disabled' : '')}>
            <a href="#" className="router-page-button page-link" onClick={e => { e.preventDefault(); if (page !== totalPages) setPage(Math.min(totalPages, page + 1)); }} aria-label="Next" aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : undefined}>»</a>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <section className="router-management-panel animate-fadeIn" aria-labelledby={panelId + '-title'}>
      <header className="router-panel-header">
        <div>
          <h2 id={panelId + '-title'}>Router Mikrotik</h2>
          <p>Kelola beberapa router beserta kredensial API masing-masing. Router awal disediakan oleh server, bukan dibuat otomatis di browser.</p>
        </div>
        {isSuperAdmin && <button className="router-panel-button router-panel-button--primary" type="button" disabled={actionsDisabled} onClick={event => openEditor(null, event.currentTarget)}>Tambah Router</button>}
      </header>

      <dl className="router-panel-counts" aria-label="Ringkasan router">
        <div><dt>Total router</dt><dd>{loading || loadFailed ? '—' : routers.length}</dd></div>
        <div><dt>Aktif dikelola</dt><dd>{loading || loadFailed ? '—' : activeCount}</dd></div>
        <div><dt>Total pelanggan</dt><dd>{loading || loadFailed ? '—' : customerCount}</dd></div>
      </dl>
      <p className="router-panel-explanation">Status aktif mengatur pengelolaan, bukan status online. Koneksi hanya menampilkan hasil tes manual terakhir, bukan pemantauan langsung.</p>
      {!isSuperAdmin && <p className="router-panel-readonly">Akses hanya lihat. Hanya superadmin yang dapat menambah, mengubah, menghapus, atau menguji router.</p>}

      {form && isSuperAdmin && (
        <form className="router-panel-editor" aria-labelledby={panelId + '-editor-title'} onSubmit={handleSave} noValidate>
          <h3 id={panelId + '-editor-title'}>{form.id === null ? 'Tambah Router' : 'Edit Router'}</h3>
          <fieldset disabled={busy || loading || loadFailed}>
            <legend className="router-panel-sr-only">Kredensial dan pengelolaan router</legend>
            <div className="router-panel-fields">
              {renderField('nama_router', 'Nama router *', { required: true, autoComplete: 'off' })}
              {renderField('lokasi', 'Lokasi', { autoComplete: 'off' })}
              {renderField('host', 'Host / IP address *', { required: true, autoComplete: 'off' })}
              {renderField('port', 'Port API *', { type: 'number', required: true, min: 1, max: 65535, step: 1 })}
              {renderField('username', 'Username API *', { required: true, autoComplete: 'off' })}
              {renderField('password', form.id === null ? 'Password API *' : 'Password API', {
                type: 'password', required: form.id === null, autoComplete: 'new-password',
                help: form.id === null ? 'Password hanya dikirim saat disimpan.' : 'Kosongkan untuk mempertahankan password tersimpan. Password lama tidak pernah ditampilkan.'
              })}
            </div>
            <label className="router-panel-checkbox" htmlFor={panelId + '-active'}>
              <input id={panelId + '-active'} name="is_active" type="checkbox" checked={form.is_active} onChange={changeField} />
              Aktifkan pengelolaan router
            </label>
            <div className="router-panel-editor-actions">
              <button className="router-panel-button" type="button" onClick={closeEditor}>Batal</button>
              <button className="router-panel-button router-panel-button--primary" type="submit">{operation?.type === 'save' ? 'Menyimpan...' : 'Simpan Router'}</button>
            </div>
          </fieldset>
        </form>
      )}

      {loading && <p role="status">Memuat daftar router...</p>}
      {loadFailed && <div className="router-panel-load-error"><p>Daftar router belum dapat dimuat. Muat ulang sebelum melakukan perubahan.</p><button className="router-panel-button" type="button" disabled={busy || loading} onClick={loadRouters}>Coba Lagi</button></div>}
      {!loading && !loadFailed && routers.length === 0 && <p className="router-panel-empty">Belum ada router. {isSuperAdmin ? 'Tambahkan router untuk mulai mengelola koneksi.' : 'Hubungi superadmin untuk menambahkan router.'}</p>}
      {!loading && !loadFailed && routers.length > 0 && (
        <div className="router-panel-table-wrap" role="region" aria-label="Daftar router Mikrotik" tabIndex={0}>
          <table className="router-panel-table">
            <caption className="router-panel-sr-only">Daftar router, pelanggan, status pengelolaan, dan hasil tes koneksi terakhir</caption>
            <thead><tr><th scope="col">Router / API</th><th scope="col">Pelanggan</th><th scope="col">Pengelolaan</th><th scope="col">Koneksi terakhir</th>{isSuperAdmin && <th scope="col">Tindakan</th>}</tr></thead>
            <tbody>
              {paginatedRouters.map(router => {
                const active = isEnabled(router.is_active);
                const result = testResults[router.id_router];
                const testing = operation?.type === 'test' && operation.id === router.id_router;
                return (
                  <tr key={router.id_router}>
                    <th scope="row">
                      <strong>{router.nama_router}</strong>
                      <span>{router.lokasi || 'Lokasi belum diisi'}</span>
                      <span className="router-panel-endpoint">{router.host}:{router.port} · {router.username}</span>
                      <small>{isEnabled(router.configured) ? 'Konfigurasi lengkap' : 'Konfigurasi belum lengkap'} · {isEnabled(router.has_password) ? 'Password tersimpan' : 'Tanpa password tersimpan'}</small>
                    </th>
                    <td>{Number(router.jumlah_pelanggan) || 0}</td>
                    <td><span className={'router-panel-badge' + (active ? ' router-panel-badge--active' : '')}>{active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td aria-live="polite">
                      <span className={'router-panel-badge' + (result?.online === true ? ' router-panel-badge--active' : result?.online === false || result?.error ? ' router-panel-badge--warning' : '')}>
                        {testing ? 'Menguji...' : result?.error ? 'Uji gagal' : result ? (result.online ? 'Online saat diuji' : 'Offline saat diuji') : 'Belum diuji'}
                      </span>
                      {result?.testedAt && <time dateTime={result.testedAt}>{new Date(result.testedAt).toLocaleString('id-ID')}</time>}
                    </td>
                    {isSuperAdmin && <td><div className="router-panel-row-actions">
                      <button className="router-panel-button" type="button" aria-label={'Edit ' + router.nama_router} disabled={actionsDisabled} onClick={event => openEditor(router, event.currentTarget)}>Edit</button>
                      <button className="router-panel-button" type="button" aria-label={(active ? 'Nonaktifkan ' : 'Aktifkan ') + router.nama_router} disabled={actionsDisabled} onClick={() => handleToggle(router)}>{active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                      <button className="router-panel-button" type="button" aria-label={'Tes koneksi ' + router.nama_router} disabled={actionsDisabled} onClick={() => handleTest(router)}>{testing ? 'Menguji...' : 'Tes Koneksi'}</button>
                      <button className="router-panel-button router-panel-button--danger" type="button" aria-label={'Hapus ' + router.nama_router} disabled={actionsDisabled} onClick={() => handleDelete(router)}>Hapus</button>
                    </div></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {renderPagination()}
        </div>
      )}
    </section>
  );
}

export default RouterManagementPanel;

import React from 'react';
import axios from 'axios';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DialogProvider } from '../context/DialogContext';
import { API_BASE_URL } from '../config';
import PengaturanPage from '../pages/PengaturanPage';
import RouterManagementPanel from './RouterManagementPanel';

jest.mock('axios');
jest.mock('../context/LogoContext', () => ({ useLogo: () => ({ refreshLogo: jest.fn() }) }));
jest.mock('../pages/PaketPage', () => () => <div>Paket layanan</div>);

const URL = API_BASE_URL + '/api/routers';
const auth = { headers: { Authorization: 'Bearer test-token' } };
const superadmin = { role: 'superadmin' };
const utama = {
  id_router: 1, nama_router: 'Router Utama', lokasi: 'Kantor', host: '10.0.0.1', port: 8728,
  username: 'api_utama', is_active: 1, has_password: true, jumlah_pelanggan: 7, configured: true
};
const cabang = {
  id_router: 2, nama_router: 'Router Cabang', lokasi: 'Gudang', host: '10.0.1.1', port: 8729,
  username: 'api_cabang', is_active: 0, has_password: false, jumlah_pelanggan: 3, configured: false
};
const listResponse = (data = [utama, cabang]) => ({ data: { success: true, data } });
const success = { data: { success: true } };

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  axios.get.mockResolvedValue(listResponse());
  axios.post.mockResolvedValue(success);
  axios.put.mockResolvedValue(success);
  axios.delete.mockResolvedValue(success);
});

afterEach(() => {
  jest.useRealTimers();
});

function renderPanel(props = { admin: superadmin }) {
  return render(<DialogProvider><RouterManagementPanel {...props} /></DialogProvider>);
}

async function ready() {
  await screen.findByText('Router Utama');
}

function row(name = 'Router Utama') {
  return screen.getByRole('row', { name: new RegExp(name) });
}

function fillCreate(overrides = {}) {
  const fields = {
    'Nama router *': ' Router Baru ', Lokasi: ' Cabang Timur ', 'Host / IP address *': ' 10.0.2.1 ',
    'Port API *': '8728', 'Username API *': ' api_baru ', 'Password API *': 'new-secret', ...overrides
  };
  Object.entries(fields).forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
}

function dismissNotice() {
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Tutup dialog' }));
}

test('shows loading without fabricating or creating the backend-seeded router', () => {
  axios.get.mockReturnValue(new Promise(() => {}));
  renderPanel();
  expect(screen.getByRole('status')).toHaveTextContent('Memuat daftar router');
  expect(screen.queryByText('Router Utama')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tambah Router' })).toBeDisabled();
  expect(axios.get).toHaveBeenCalledWith(URL, auth);
  expect(axios.post).not.toHaveBeenCalled();
});

test('lists router details and counts, separating management/configuration from untested connections', async () => {
  renderPanel();
  await ready();

  const counts = screen.getByLabelText('Ringkasan router');
  const [total, active, customers] = within(counts).getAllByRole('definition');
  expect(total).toHaveTextContent(/^2$/);
  expect(active).toHaveTextContent(/^1$/);
  expect(customers).toHaveTextContent(/^10$/);
  expect(within(row()).getByText('Aktif')).toBeInTheDocument();
  expect(within(row()).getByText('10.0.0.1:8728 · api_utama')).toBeInTheDocument();
  expect(within(row('Router Cabang')).getByText('Nonaktif')).toBeInTheDocument();
  expect(screen.getAllByText('Belum diuji')).toHaveLength(2);
  expect(screen.queryByText('Online saat diuji')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('empty list stays empty and never seeds a client-side Router Utama', async () => {
  axios.get.mockResolvedValue(listResponse([]));
  renderPanel();
  await screen.findByText(/Belum ada router\./);
  expect(screen.queryByText('Router Utama')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('reports a loading failure via showAlert and supports retry', async () => {
  axios.get.mockRejectedValueOnce({ response: { data: { success: false, message: 'Daftar router tidak tersedia.' } } });
  renderPanel();
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Daftar router tidak tersedia.');
  expect(screen.getByRole('button', { name: 'Tambah Router' })).toBeDisabled();
  dismissNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
  await ready();
  expect(axios.get).toHaveBeenCalledTimes(2);
});

test('creates a router with trimmed fields, its own active flag, and a synchronous duplicate-submit guard', async () => {
  jest.useFakeTimers();
  let finishCreate;
  axios.post.mockImplementation(() => new Promise(resolve => { finishCreate = resolve; }));
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Tambah Router' }));
  expect(screen.getByLabelText('Nama router *')).toHaveFocus();
  fillCreate();
  fireEvent.click(screen.getByLabelText('Aktifkan pengelolaan router'));
  const editor = screen.getByRole('form', { name: 'Tambah Router' });
  fireEvent.submit(editor);
  fireEvent.submit(editor);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(URL, {
    nama_router: 'Router Baru', lokasi: 'Cabang Timur', host: '10.0.2.1', port: 8728,
    username: 'api_baru', password: 'new-secret', is_active: false
  }, auth);
  expect(screen.getByRole('button', { name: 'Menyimpan...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
  axios.get.mockResolvedValue(listResponse([utama, cabang, { ...cabang, id_router: 3, nama_router: 'Router Baru' }]));
  await act(async () => finishCreate(success));
  expect(await screen.findByText('Router Baru')).toBeInTheDocument();
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Router berhasil ditambahkan.');
  await act(async () => jest.advanceTimersByTime(1499));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(1));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('validates required trimmed fields, password, and integer port before saving', async () => {
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Tambah Router' }));
  fillCreate({ 'Nama router *': '   ', 'Host / IP address *': ' ', 'Username API *': '', 'Port API *': '65536', 'Password API *': '' });
  fireEvent.submit(screen.getByRole('form', { name: 'Tambah Router' }));
  expect(screen.getByLabelText('Nama router *')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Nama router *')).toHaveFocus();
  expect(screen.getByLabelText('Host / IP address *')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Username API *')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('Port harus berupa bilangan bulat antara 1 dan 65535.')).toBeInTheDocument();
  expect(screen.getByText('Password wajib diisi untuk router baru.')).toBeInTheDocument();
  fillCreate({ 'Port API *': '1.5' });
  fireEvent.submit(screen.getByRole('form', { name: 'Tambah Router' }));
  expect(screen.getByLabelText('Port API *')).toHaveAttribute('aria-invalid', 'true');
  expect(axios.post).not.toHaveBeenCalled();
});

test('a failed save retains the form and allows retry without discarding credentials', async () => {
  axios.post.mockRejectedValueOnce({ response: { data: { success: false, message: 'Nama router sudah dipakai.' } } });
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Tambah Router' }));
  fillCreate();
  fireEvent.submit(screen.getByRole('form', { name: 'Tambah Router' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Nama router sudah dipakai.');
  expect(screen.getByLabelText('Password API *')).toHaveValue('new-secret');
  expect(screen.getByRole('button', { name: 'Simpan Router' })).toBeEnabled();
  dismissNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});

test.each(['', '   ', ' replacement-secret '])('editing never prefills a password and handles password=%p correctly', async password => {
  axios.get.mockResolvedValue(listResponse([{ ...utama, password: 'must-not-prefill' }, cabang]));
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Router Utama' }));
  expect(screen.getByLabelText('Password API')).toHaveValue('');
  expect(screen.queryByDisplayValue('must-not-prefill')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Lokasi')).toHaveValue('Kantor');
  fireEvent.change(screen.getByLabelText('Nama router *'), { target: { value: 'Router Kantor' } });
  if (password) fireEvent.change(screen.getByLabelText('Password API'), { target: { value: password } });
  axios.get.mockResolvedValue(listResponse([{ ...utama, nama_router: 'Router Kantor' }, cabang]));
  fireEvent.submit(screen.getByRole('form', { name: 'Edit Router' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Router berhasil diperbarui.');
  expect(axios.put).toHaveBeenCalledWith(URL + '/1', {
    nama_router: 'Router Kantor', lokasi: 'Kantor', host: '10.0.0.1', port: 8728,
    username: 'api_utama', is_active: true, ...(password.trim() ? { password } : {})
  }, auth);
  expect(Object.keys(axios.put.mock.calls[0][1]).includes('password')).toBe(Boolean(password.trim()));
  await screen.findByText('Router Kantor');
});

test('delete waits for the promise-based destructive confirmation and cancellation preserves the row', async () => {
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Hapus Router Utama' }));
  const dialog = screen.getByRole('dialog', { name: 'Hapus Router' });
  expect(dialog).toHaveClass('app-dialog--danger');
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hapus Router Utama' })).toBeEnabled());
  expect(screen.getByText('Router Utama')).toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
});

test('confirmed deletion removes only the selected router and reloads counts', async () => {
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Hapus Router Cabang' }));
  axios.get.mockResolvedValue(listResponse([utama]));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hapus Router' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Router berhasil dihapus.');
  expect(axios.delete).toHaveBeenCalledWith(URL + '/2', auth);
  await screen.findByText('Router Utama');
  expect(screen.queryByText('Router Cabang')).not.toBeInTheDocument();
  expect(within(screen.getByLabelText('Ringkasan router')).getAllByRole('definition')[0]).toHaveTextContent(/^1$/);
});

test('backend refusal to delete a used router preserves the row and auto-dismisses the error at 1500ms', async () => {
  jest.useFakeTimers();
  axios.delete.mockRejectedValue({ response: { data: { success: false, message: 'Router masih digunakan oleh 7 pelanggan.' } } });
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Hapus Router Utama' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hapus Router' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Router masih digunakan oleh 7 pelanggan.');
  expect(screen.getByText('Router Utama')).toBeInTheDocument();
  expect(axios.delete).toHaveBeenCalledWith(URL + '/1', auth);
  expect(axios.get).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(1500));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hapus Router Utama' })).toBeEnabled();
});

test.each(['admin', 'staff', 'unknown'])('%s can view routers but has no mutation or connection-test UI', async role => {
  localStorage.setItem('admin', JSON.stringify(superadmin));
  renderPanel({ admin: { role } });
  await ready();
  expect(screen.getByText(/Akses hanya lihat/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Tindakan' })).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled();
  expect(axios.delete).not.toHaveBeenCalled();
});

test('uses the localStorage superadmin only when no admin prop is supplied', async () => {
  localStorage.setItem('admin', JSON.stringify(superadmin));
  renderPanel({});
  await ready();
  expect(screen.getByRole('button', { name: 'Tambah Router' })).toBeEnabled();
});

test.each([null, 'not-json'])('missing or malformed stored admin fails closed (%p)', async stored => {
  if (stored !== null) localStorage.setItem('admin', stored);
  renderPanel({});
  await ready();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test.each([true, false])('tests a saved disabled router and displays only the actual online=%p result', async online => {
  axios.post.mockResolvedValue({ data: { success: true, data: { online } } });
  renderPanel();
  await ready();
  expect(within(row('Router Cabang')).getByText('Belum diuji')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tes koneksi Router Cabang' }));
  expect(await screen.findByText(online ? 'Online saat diuji' : 'Offline saat diuji')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(URL + '/2/test', {}, auth);
  expect(within(row('Router Cabang')).getByText('Nonaktif')).toBeInTheDocument();
  expect(within(row()).getByText('Belum diuji')).toBeInTheDocument();
  expect(within(row('Router Cabang')).getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toHaveAttribute('datetime');
  expect(axios.put).not.toHaveBeenCalled();
});

test.each([
  { response: { data: { success: false, message: 'Router tidak dapat diuji.' } } },
  new Error('Network Error')
])('failed connection requests never fabricate an offline or online result', async error => {
  axios.post.mockRejectedValue(error);
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Tes koneksi Router Utama' }));
  await screen.findByRole('alertdialog');
  expect(within(row()).getByText('Uji gagal')).toBeInTheDocument();
  expect(screen.queryByText('Online saat diuji')).not.toBeInTheDocument();
  expect(screen.queryByText('Offline saat diuji')).not.toBeInTheDocument();
});

test('an invalid connection response is not treated as an online result', async () => {
  axios.post.mockResolvedValue({ data: { success: true, data: {} } });
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Tes koneksi Router Utama' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Hasil tes koneksi tidak valid.');
  expect(within(row()).getByText('Uji gagal')).toBeInTheDocument();
});

test('deactivation requires confirmation, preserves credentials, and invalidates the previous test', async () => {
  axios.post.mockResolvedValue({ data: { success: true, data: { online: true } } });
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Tes koneksi Router Utama' }));
  await screen.findByRole('alertdialog');
  dismissNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan Router Utama' }));
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Nonaktifkan Router Utama' })).toBeEnabled());
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan Router Utama' }));
  axios.get.mockResolvedValue(listResponse([{ ...utama, is_active: 0 }, cabang]));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nonaktifkan' }));
  await screen.findByRole('alertdialog');
  expect(axios.put).toHaveBeenCalledWith(URL + '/1', { is_active: false }, auth);
  await ready();
  expect(within(row()).getByText('Nonaktif')).toBeInTheDocument();
  expect(within(row()).getByText('Belum diuji')).toBeInTheDocument();
});

test('activation saves the management flag without needing a connection test', async () => {
  renderPanel();
  await ready();
  axios.get.mockResolvedValue(listResponse([utama, { ...cabang, is_active: 1 }]));
  fireEvent.click(screen.getByRole('button', { name: 'Aktifkan Router Cabang' }));
  await screen.findByRole('alertdialog');
  expect(axios.put).toHaveBeenCalledWith(URL + '/2', { is_active: true }, auth);
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty('password');
  await ready();
  expect(within(row('Router Cabang')).getByText('Aktif')).toBeInTheDocument();
  expect(within(row('Router Cabang')).getByText('Belum diuji')).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('deactivation through the edit form also requires confirmation', async () => {
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Router Utama' }));
  fireEvent.click(screen.getByLabelText('Aktifkan pengelolaan router'));
  fireEvent.submit(screen.getByRole('form', { name: 'Edit Router' }));
  expect(screen.getByRole('dialog', { name: 'Nonaktifkan Router' })).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Simpan Router' })).toBeEnabled());
  expect(screen.getByRole('form', { name: 'Edit Router' })).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

test('an incomplete backend seed can be deactivated without resubmitting missing credentials', async () => {
  const seed = { ...utama, host: '', username: '', configured: false, has_password: false, is_active: true };
  axios.get.mockResolvedValue(listResponse([seed]));
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan Router Utama' }));
  axios.get.mockResolvedValue(listResponse([{ ...seed, is_active: false }]));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nonaktifkan' }));
  await screen.findByRole('alertdialog');
  expect(axios.put).toHaveBeenCalledWith(URL + '/1', { is_active: false }, auth);
  await ready();
  expect(within(row()).getByText('Nonaktif')).toBeInTheDocument();
  expect(within(row()).getByText('Belum diuji')).toBeInTheDocument();
});

test('a refused status update retains the original management flag and counts', async () => {
  axios.put.mockRejectedValue({ response: { data: { success: false, message: 'Perubahan status ditolak.' } } });
  renderPanel();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Aktifkan Router Cabang' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Perubahan status ditolak.');
  expect(within(row('Router Cabang')).getByText('Nonaktif')).toBeInTheDocument();
  expect(within(screen.getByLabelText('Ringkasan router')).getAllByRole('definition')[1]).toHaveTextContent(/^1$/);
  expect(axios.get).toHaveBeenCalledTimes(1);
});

function mockSettingsRequests() {
  axios.get.mockImplementation(url => {
    if (url === URL) return Promise.resolve(listResponse());
    if (url.endsWith('/config')) return Promise.resolve({ data: { success: true, data: {
      MIKROTIK_HOST: 'old-global-host', MIKROTIK_PORT: '9999', MIKROTIK_USER: 'old-user', MIKROTIK_PASS: 'old-global-secret',
      EMAIL_USER: 'smtp@example.test', EMAIL_PASS: 'smtp-secret', EMAIL_FROM: 'ISP <smtp@example.test>',
      MIDTRANS_MERCHANT_ID: 'merchant', MIDTRANS_CLIENT_KEY: 'client', MIDTRANS_SERVER_KEY: 'server', MIDTRANS_IS_SANDBOX: 'true',
      DUITKU_MERCHANT_CODE: 'duitku', DUITKU_API_KEY: 'duitku-key', DUITKU_IS_SANDBOX: 'true'
    } } });
    if (url.endsWith('/rekening')) return Promise.resolve(listResponse([]));
    return Promise.resolve({ data: { success: true, data: null } });
  });
}

test('settings integrates the panel outside the global form and hides the global save on the Mikrotik tab', async () => {
  mockSettingsRequests();
  render(<DialogProvider><PengaturanPage admin={superadmin} /></DialogProvider>);
  await screen.findByText('Profil Perusahaan & Umum');
  fireEvent.click(screen.getByText('Router Mikrotik'));
  await ready();
  expect(screen.queryByRole('button', { name: 'Simpan Perubahan' })).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('old-global-host')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('old-global-secret')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tambah Router' }));
  const editor = screen.getByRole('form', { name: 'Tambah Router' });
  expect(screen.getAllByRole('form')).toEqual([editor]);
  fillCreate();
  fireEvent.submit(editor);
  await screen.findByRole('alertdialog');
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][0]).toBe(URL);
});

test('global settings saves no legacy MIKROTIK fields and preserves SMTP/gateway payloads', async () => {
  mockSettingsRequests();
  render(<DialogProvider><PengaturanPage /></DialogProvider>);
  await screen.findByText('Profil Perusahaan & Umum');
  fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenCalledWith(API_BASE_URL + '/api/pengaturan/config', expect.objectContaining({
    EMAIL_USER: 'smtp@example.test', EMAIL_PASS: 'smtp-secret', EMAIL_FROM: 'ISP <smtp@example.test>',
    MIDTRANS_MERCHANT_ID: 'merchant', MIDTRANS_CLIENT_KEY: 'client', MIDTRANS_SERVER_KEY: 'server',
    DUITKU_MERCHANT_CODE: 'duitku', DUITKU_API_KEY: 'duitku-key'
  }), auth);
  expect(Object.keys(axios.post.mock.calls[0][1]).some(key => key.startsWith('MIKROTIK_'))).toBe(false);
});

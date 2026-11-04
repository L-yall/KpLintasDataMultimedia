import React from 'react';
import axios from 'axios';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import CustomerPortalPage from './CustomerPortalPage';

jest.mock('axios');

const payments = [
  { id_pembayaran: 1, periode: '2026-11', nominal: 185000, tanggal_upload: '2026-11-03T00:00:00Z', status: 'diterima', bukti_file: '/uploads/bukti/contoh.png' },
  { id_pembayaran: 2, periode: '2026-10', nominal: 185000, tanggal_upload: '2026-10-03T00:00:00Z', status: 'ditolak', alasan_tolak: 'Bukti tidak sesuai.', bukti_file: '/uploads/bukti/ditolak.png' },
  { id_pembayaran: 3, periode: '2026-09', nominal: 185000, tanggal_upload: '2026-09-03T00:00:00Z', status: 'diterima', bukti_file: 'Midtrans / qris / settlement' }
];

let history;

beforeEach(() => {
  jest.resetAllMocks();
  history = payments;
  axios.get.mockImplementation(url => {
    if (url.endsWith('/api/customer/portal/payments')) {
      return Promise.resolve({ data: { success: true, data: history } });
    }
    if (url.endsWith('/api/customer/portal/midtrans-config')) {
      // Avoid loading the external gateway script in this UI-only test.
      return Promise.resolve({ data: { success: false } });
    }
    if (url.includes('/api/pengaturan/rekening')) {
      return Promise.resolve({ data: { success: true, data: [] } });
    }
    return Promise.resolve({ data: { success: true, data: null } });
  });
});

function renderPortal(activeTab = 'history') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/portal', state: { activeTab } }]}>
      <CustomerPortalPage onLogout={jest.fn()} />
    </MemoryRouter>
  );
}

test('payment history retains transactions, statuses, rejection notes and proof links without delete actions', async () => {
  renderPortal();
  expect(await screen.findByText('Menampilkan 3 catatan riwayat pembayaran')).toBeInTheDocument();
  expect(screen.getByText('Periode Tagihan 2026-11')).toBeInTheDocument();
  expect(screen.getByText('Periode Tagihan 2026-10')).toBeInTheDocument();
  expect(screen.getByText('Periode Tagihan 2026-09')).toBeInTheDocument();
  expect(screen.getAllByText('Lunas / Disetujui')).toHaveLength(2);
  expect(screen.getByText('Ditolak')).toBeInTheDocument();
  expect(screen.getByText(/Bukti tidak sesuai/)).toBeInTheDocument();
  const proofLinks = screen.getAllByRole('link', { name: /Lihat Bukti Transfer/ });
  expect(proofLinks).toHaveLength(2);
  expect(proofLinks[0]).toHaveAttribute('href', API_BASE_URL + '/uploads/bukti/contoh.png');
  expect(screen.queryByRole('button', { name: /hapus|bersihkan/i })).not.toBeInTheDocument();
  expect(screen.queryByTitle(/hapus.*riwayat/i)).not.toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
});

test('history opened through navigation is read-only', async () => {
  renderPortal('billing');
  fireEvent.click(await screen.findByRole('button', { name: /Riwayat Pembayaran/ }));
  expect(await screen.findByText('Menampilkan 3 catatan riwayat pembayaran')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /hapus|bersihkan/i })).not.toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
});

test('empty history still displays its empty state without clear-history actions', async () => {
  history = [];
  renderPortal();
  expect(await screen.findByRole('heading', { name: 'Belum Ada Riwayat' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /hapus|bersihkan/i })).not.toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
});

import React from 'react';
import axios from 'axios';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DialogProvider } from '../context/DialogContext';
import { API_BASE_URL } from '../config';
import ReminderLogPage from './ReminderLogPage';

jest.mock('axios');

const log = {
  id_reminder: 7,
  nama: 'Pelanggan Uji',
  email: 'pelanggan@example.test',
  tanggal_kirim: '2026-11-03T00:00:00Z',
  status_kirim: 'terkirim',
  pesan: 'Pengingat tagihan'
};

beforeEach(() => {
  jest.resetAllMocks();
  axios.get.mockResolvedValue({ data: { success: true, data: [log] } });
});

afterEach(() => {
  jest.useRealTimers();
});

async function openDeleteDialog(all) {
  render(<DialogProvider><ReminderLogPage /></DialogProvider>);
  await screen.findByText('Pelanggan Uji');
  fireEvent.click(all ? screen.getByRole('button', { name: /Bersihkan Semua Log/ }) : screen.getByTitle('Hapus Log'));
  return screen.getByRole('dialog');
}

test.each([false, true])('cancelling reminder deletion does not send a DELETE request (all=%s)', async all => {
  const dialog = await openDeleteDialog(all);
  expect(dialog).toHaveClass('app-dialog--danger');
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Pelanggan Uji')).toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
});

test.each([false, true])('deletion runs only after confirmation and success closes automatically (all=%s)', async all => {
  jest.useFakeTimers();
  axios.delete.mockResolvedValue({ data: { success: true, message: 'Log berhasil dihapus.' } });
  const dialog = await openDeleteDialog(all);
  axios.get.mockResolvedValue({ data: { success: true, data: [] } });
  fireEvent.click(within(dialog).getByRole('button', { name: all ? 'Hapus semua log' : 'Ya, hapus' }));
  const feedback = await screen.findByRole('alertdialog', { name: 'Berhasil' });
  expect(feedback).toHaveTextContent('Log berhasil dihapus.');
  expect(axios.delete).toHaveBeenCalledTimes(1);
  expect(axios.delete).toHaveBeenCalledWith(API_BASE_URL + '/api/reminder/logs' + (all ? '' : '/7'), expect.any(Object));
  expect(within(feedback).queryByRole('button', { name: 'Mengerti' })).not.toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(1500));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  await screen.findByText('Belum ada riwayat pengiriman reminder Email.');
});

test('failed deletion displays an error dialog for 1.5 seconds and preserves the log', async () => {
  jest.useFakeTimers();
  axios.delete.mockRejectedValue({ response: { data: { message: 'Server tidak tersedia.' } } });
  const dialog = await openDeleteDialog(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }));
  const feedback = await screen.findByRole('alertdialog', { name: 'Terjadi kesalahan' });
  expect(feedback).toHaveTextContent('Server tidak tersedia.');
  expect(within(feedback).queryByRole('button', { name: 'Mengerti' })).not.toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(1500));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Pelanggan Uji')).toBeInTheDocument();
});

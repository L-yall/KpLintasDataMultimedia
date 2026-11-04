import React from 'react';
import axios from 'axios';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DialogProvider } from '../context/DialogContext';
import { API_BASE_URL } from '../config';
import PelangganPage from './PelangganPage';
import PelangganTanpaPppoePage from './PelangganTanpaPppoePage';

jest.mock('axios');

let customers;

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  customers = [{
    id_pelanggan: 7,
    nama: 'Pelanggan Uji',
    email: 'pelanggan@example.test',
    no_hp: '080000000000',
    alamat: 'Alamat pengujian',
    paket: 'Paket Uji',
    harga: 185000,
    pppoe_username: '',
    pppoe_status: 'inactive',
    due_date: null
  }];
  axios.get.mockImplementation(url => Promise.resolve({
    data: { success: true, data: url.includes('/api/pelanggan') ? customers : [] }
  }));
});

afterEach(() => {
  jest.useRealTimers();
});

async function openConfirmation(Page) {
  render(<MemoryRouter><DialogProvider><Page /></DialogProvider></MemoryRouter>);
  await screen.findByText('Pelanggan Uji');
  fireEvent.click(screen.getByTitle('Hapus'));
  expect(screen.getByText('Konfirmasi Hapus')).toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
}

describe.each([
  ['Data Pelanggan', PelangganPage],
  ['Belum Ada PPPoE', PelangganTanpaPppoePage]
])('%s deletion feedback', (name, Page) => {
  test('confirmation does not expire and cancelling never deletes the customer', async () => {
    await openConfirmation(Page);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText('Konfirmasi Hapus')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByText('Konfirmasi Hapus')).not.toBeInTheDocument();
    expect(screen.getByText('Pelanggan Uji')).toBeInTheDocument();
    expect(axios.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  test('successful deletion closes confirmation and displays success for 1.5 seconds', async () => {
    axios.delete.mockImplementation(() => {
      customers = [];
      return Promise.resolve({ data: { success: true, message: 'Pelanggan berhasil dihapus.' } });
    });
    await openConfirmation(Page);
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));
    const feedback = await screen.findByRole('alertdialog', { name: 'Berhasil' });
    expect(feedback).toHaveTextContent('Pelanggan berhasil dihapus.');
    expect(within(feedback).queryByRole('button', { name: 'Mengerti' })).not.toBeInTheDocument();
    expect(screen.queryByText('Konfirmasi Hapus')).not.toBeInTheDocument();
    expect(screen.queryByText('Pelanggan Uji')).not.toBeInTheDocument();
    expect(axios.delete).toHaveBeenCalledTimes(1);
    expect(axios.delete).toHaveBeenCalledWith(API_BASE_URL + '/api/pelanggan/7', expect.any(Object));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  test('server failure displays an error for 1.5 seconds without removing the customer', async () => {
    axios.delete.mockRejectedValue({ response: { data: { message: 'Server tidak tersedia.' } } });
    await openConfirmation(Page);
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));
    const feedback = await screen.findByRole('alertdialog', { name: 'Gagal menghapus pelanggan' });
    expect(feedback).toHaveTextContent('Server tidak tersedia.');
    expect(feedback).toHaveClass('app-dialog--error');
    expect(screen.queryByText('Konfirmasi Hapus')).not.toBeInTheDocument();
    await act(async () => jest.advanceTimersByTime(1500));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Pelanggan Uji')).toBeInTheDocument();
  });

  test('an unsuccessful API response never displays success or removes the customer', async () => {
    axios.delete.mockResolvedValue({ data: { success: false, message: 'Penghapusan ditolak.' } });
    await openConfirmation(Page);
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));
    const feedback = await screen.findByRole('alertdialog', { name: 'Gagal menghapus pelanggan' });
    expect(feedback).toHaveTextContent('Penghapusan ditolak.');
    expect(screen.queryByRole('alertdialog', { name: 'Berhasil' })).not.toBeInTheDocument();
    await act(async () => jest.advanceTimersByTime(1500));
    expect(screen.getByText('Pelanggan Uji')).toBeInTheDocument();
  });

  test('deletion buttons are disabled while the API request is pending', async () => {
    let rejectRequest;
    axios.delete.mockImplementation(() => new Promise((resolve, reject) => { rejectRequest = reject; }));
    await openConfirmation(Page);
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));
    const pendingButton = screen.getByRole('button', { name: 'Menghapus...' });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(axios.delete).toHaveBeenCalledTimes(1);
    await act(async () => rejectRequest(new Error('Koneksi terputus.')));
    expect(screen.getByRole('alertdialog', { name: 'Gagal menghapus pelanggan' })).toHaveTextContent('Koneksi terputus.');
  });
});

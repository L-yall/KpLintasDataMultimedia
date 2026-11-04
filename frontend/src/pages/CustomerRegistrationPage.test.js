import React from 'react';
import axios from 'axios';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DialogProvider } from '../context/DialogContext';
import { API_BASE_URL } from '../config';
import CustomerRegistrationPage from './CustomerRegistrationPage';

jest.mock('axios');

beforeEach(() => {
  jest.resetAllMocks();
  axios.get.mockResolvedValue({
    data: { success: true, data: [{ id: 1, nama_paket: 'Paket Uji', harga: 185000 }] }
  });
});

afterEach(() => {
  jest.useRealTimers();
});

async function submitRegistration() {
  render(
    <MemoryRouter initialEntries={['/registrasi']}>
      <DialogProvider>
        <Routes>
          <Route path="/registrasi" element={<CustomerRegistrationPage />} />
          <Route path="/" element={<h1>Beranda</h1>} />
        </Routes>
      </DialogProvider>
    </MemoryRouter>
  );
  await screen.findByRole('option', { name: /Paket Uji/ });
  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Pelanggan Uji' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '080000000000' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pelanggan@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password-uji' } });
  fireEvent.change(screen.getByLabelText('Alamat pemasangan'), { target: { value: 'Alamat pengujian' } });
  fireEvent.change(screen.getByLabelText(/^NIK/), { target: { value: '1234567890123456' } });
  fireEvent.change(screen.getByLabelText(/^Upload foto KTP/), {
    target: { files: [new File(['foto-uji'], 'ktp-uji.png', { type: 'image/png' })] }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim registrasi' }));
}

test('successful registration redirects to home and shows the admin review popup for 1.5 seconds', async () => {
  jest.useFakeTimers();
  axios.post.mockResolvedValue({ data: { success: true, message: 'Registrasi berhasil.' } });
  await submitRegistration();
  expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Registrasi layanan' })).not.toBeInTheDocument();
  const dialog = screen.getByRole('alertdialog', { name: 'Registrasi berhasil' });
  expect(dialog).toHaveTextContent('Registrasi berhasil. Pengajuan Anda sedang ditinjau oleh admin.');
  expect(within(dialog).queryByRole('button', { name: 'Mengerti' })).not.toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(API_BASE_URL + '/api/customer/auth/register', expect.any(FormData));
  const payload = axios.post.mock.calls[0][1];
  expect(payload.get('nama')).toBe('Pelanggan Uji');
  expect(payload.get('paket')).toBe('Paket Uji');
  expect(payload.get('foto').name).toBe('ktp-uji.png');
  await act(async () => jest.advanceTimersByTime(1500));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Beranda' })).toBeInTheDocument();
});

test('rejected registration stays on the form and retains the entered data', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'Email sudah terdaftar.' } } });
  await submitRegistration();
  expect(await screen.findByRole('alert')).toHaveTextContent('Email sudah terdaftar.');
  expect(screen.getByRole('heading', { name: 'Registrasi layanan' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveValue('pelanggan@example.test');
  expect(screen.getByLabelText('Nama lengkap')).toHaveValue('Pelanggan Uji');
  expect(screen.queryByRole('heading', { name: 'Beranda' })).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('an unsuccessful API response does not redirect or show a success popup', async () => {
  axios.post.mockResolvedValue({ data: { success: false, message: 'Paket layanan tidak tersedia.' } });
  await submitRegistration();
  expect(await screen.findByRole('alert')).toHaveTextContent('Paket layanan tidak tersedia.');
  expect(screen.getByRole('heading', { name: 'Registrasi layanan' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Beranda' })).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

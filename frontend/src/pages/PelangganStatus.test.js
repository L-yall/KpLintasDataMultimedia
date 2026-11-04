import React from 'react';
import axios from 'axios';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DialogProvider } from '../context/DialogContext';
import PelangganPage from './PelangganPage';

jest.mock('axios');

let customer;
let activeConnections;
let activeRequest;

function createSocket() {
  const listeners = new Map();
  return {
    on: jest.fn((event, handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    }),
    off: jest.fn((event, handler) => listeners.get(event)?.delete(handler)),
    receive(event, data) {
      listeners.get(event)?.forEach(handler => handler(data));
    }
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  customer = {
    id_pelanggan: 7,
    nama: 'Pelanggan Uji',
    no_hp: '080000000000',
    email: 'pelanggan@example.test',
    paket: 'Paket Uji',
    harga: 185000,
    pppoe_username: 'pppoe-uji',
    pppoe_status: 'inactive',
    status_tagihan: 'hijau',
    due_date: '2020-01-01'
  };
  activeConnections = [{ name: 'pppoe-uji' }];
  activeRequest = null;
  axios.get.mockImplementation(url => {
    if (url.endsWith('/api/pelanggan')) return Promise.resolve({ data: { success: true, data: [customer] } });
    if (url.endsWith('/api/mikrotik/active')) {
      if (activeRequest) return activeRequest();
      return Promise.resolve({ data: { success: true, data: activeConnections } });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function renderPage(socket) {
  return render(<MemoryRouter><DialogProvider><PelangganPage socket={socket} /></DialogProvider></MemoryRouter>);
}

const onlineLabel = 'PPPoE online: sesi aktif di router';
const offlineLabel = 'PPPoE offline: sesi tidak aktif di router';
const unavailableLabel = 'Koneksi router bermasalah: data PPPoE tidak tersedia';

test.each([
  ['hijau', 'Lunas'],
  ['merah', 'Menunggak'],
  ['kuning', 'Mendekati Jatuh Tempo']
])('database billing status %s is preserved when the PPPoE session is offline', async (status, label) => {
  customer.status_tagihan = status;
  customer.pppoe_status = 'active';
  activeConnections = [];
  renderPage();
  const indicator = await screen.findByRole('img', { name: offlineLabel });
  expect(indicator).toHaveStyle({ backgroundColor: 'var(--status-merah)' });
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByText('Tidak Aktif')).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Status Tagihan' })).toBeInTheDocument();
});

test('router sessions, not the cached database connection flag or invoice date, determine the network dot', async () => {
  customer.status_tagihan = 'merah';
  customer.pppoe_status = 'inactive';
  customer.due_date = '2099-01-01';
  renderPage();
  const indicator = await screen.findByRole('img', { name: onlineLabel });
  expect(indicator).toHaveStyle({ backgroundColor: 'var(--status-hijau)' });
  expect(screen.getByText('Menunggak')).toBeInTheDocument();
});

test('missing billing status is unknown rather than a statement about the connection', async () => {
  customer.status_tagihan = null;
  renderPage();
  await screen.findByRole('img', { name: onlineLabel });
  expect(screen.getByText('Belum Ditentukan')).toBeInTheDocument();
});

test('failed router requests clear stale cached online status without changing billing', async () => {
  customer.pppoe_status = 'active';
  activeRequest = () => Promise.reject(new Error('Router tidak terjangkau'));
  renderPage();
  const indicator = await screen.findByRole('img', { name: unavailableLabel });
  expect(indicator).toHaveStyle({ backgroundColor: 'var(--status-merah)' });
  expect(screen.getByText('Lunas')).toBeInTheDocument();
});

test('router offline and recovery events affect the dot only', async () => {
  const socket = createSocket();
  renderPage(socket);
  await screen.findByRole('img', { name: onlineLabel });
  act(() => socket.receive('mikrotik_ping', { online: false }));
  expect(screen.getByRole('img', { name: unavailableLabel })).toBeInTheDocument();
  expect(screen.getByText('Lunas')).toBeInTheDocument();
  act(() => socket.receive('mikrotik_ping', { online: true }));
  // Router health alone does not prove that this customer's session is active.
  expect(screen.getByRole('img', { name: unavailableLabel })).toBeInTheDocument();
  act(() => socket.receive('pppoe_summary', { telemetry_available: true, active_usernames: ['pppoe-uji'] }));
  expect(screen.getByRole('img', { name: onlineLabel })).toBeInTheDocument();
  expect(screen.getByText('Lunas')).toBeInTheDocument();
});

test('partial billing events update the badge without overwriting live PPPoE telemetry', async () => {
  const socket = createSocket();
  renderPage(socket);
  await screen.findByRole('img', { name: onlineLabel });
  act(() => socket.receive('pelanggan_updated', { id_pelanggan: 7, status_tagihan: 'merah', due_date: '2026-01-01' }));
  expect(screen.getByText('Menunggak')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: onlineLabel })).toBeInTheDocument();
  act(() => socket.receive('pelanggan_updated', { id_pelanggan: 7, pppoe_status: 'inactive' }));
  expect(screen.getByText('Menunggak')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: onlineLabel })).toBeInTheDocument();
  act(() => socket.receive('pppoe_summary', { telemetry_available: true, active_usernames: [] }));
  expect(screen.getByRole('img', { name: offlineLabel })).toBeInTheDocument();
  expect(screen.getByText('Menunggak')).toBeInTheDocument();
});

test('failed session telemetry clears the dot even if router ping remains online', async () => {
  const socket = createSocket();
  renderPage(socket);
  await screen.findByRole('img', { name: onlineLabel });
  act(() => socket.receive('pppoe_summary', { telemetry_available: false, active_usernames: [] }));
  expect(screen.getByRole('img', { name: unavailableLabel })).toBeInTheDocument();
  expect(screen.getByText('Lunas')).toBeInTheDocument();
});

test('polling refreshes session status when there is no WebSocket', async () => {
  renderPage();
  await screen.findByRole('img', { name: onlineLabel });
  activeConnections = [];
  await act(async () => jest.advanceTimersByTime(30000));
  expect(screen.getByRole('img', { name: offlineLabel })).toBeInTheDocument();
  expect(screen.getByText('Lunas')).toBeInTheDocument();
});

test('a stale HTTP response cannot overwrite a newer router-offline event', async () => {
  let resolveActive;
  activeRequest = () => new Promise(resolve => { resolveActive = resolve; });
  const socket = createSocket();
  renderPage(socket);
  await screen.findByText('Pelanggan Uji');
  expect(screen.getByRole('img', { name: 'Memeriksa koneksi PPPoE' })).toBeInTheDocument();
  act(() => socket.receive('mikrotik_ping', { online: false }));
  await act(async () => resolveActive({ data: { success: true, data: [{ name: 'pppoe-uji' }] } }));
  expect(screen.getByRole('img', { name: unavailableLabel })).toBeInTheDocument();
  expect(screen.getByText('Lunas')).toBeInTheDocument();
});

test('payment events refresh billing from the database independently of network status', async () => {
  customer.status_tagihan = 'merah';
  activeConnections = [];
  const socket = createSocket();
  renderPage(socket);
  await screen.findByRole('img', { name: offlineLabel });
  expect(screen.getByText('Menunggak')).toBeInTheDocument();
  customer = { ...customer, status_tagihan: 'hijau' };
  act(() => socket.receive('pembayaran_masuk', { id_tagihan: 9 }));
  expect(await screen.findByText('Lunas')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: offlineLabel })).toBeInTheDocument();
});

test('cleanup removes only this page listeners and stops network polling', async () => {
  const socket = createSocket();
  const otherListener = jest.fn();
  socket.on('pelanggan_updated', otherListener);
  const { unmount } = renderPage(socket);
  await screen.findByRole('img', { name: onlineLabel });
  unmount();
  expect(socket.off.mock.calls.every(call => call.length === 2)).toBe(true);
  socket.receive('pelanggan_updated', { id_pelanggan: 7 });
  expect(otherListener).toHaveBeenCalledTimes(1);
  const requests = axios.get.mock.calls.length;
  act(() => jest.advanceTimersByTime(60000));
  expect(axios.get).toHaveBeenCalledTimes(requests);
});

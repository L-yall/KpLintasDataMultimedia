import React, { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DialogProvider, useDialog } from './DialogContext';

function Example({ alertTone = 'success' }) {
  const { showAlert, confirmDialog, promptDialog } = useDialog();
  const [result, setResult] = useState('');
  return (
    <>
      <button onClick={async () => setResult(String(await confirmDialog('Hapus log ini?', { tone: 'danger', confirmLabel: 'Ya, hapus' })))}>Hapus log</button>
      <button onClick={async () => { await showAlert('Data berhasil disimpan.', { tone: alertTone }); setResult('ditutup'); }}>Tampilkan pesan</button>
      <button onClick={async () => {
        const notification = showAlert('Data berhasil disimpan.', { tone: 'success' });
        const confirmation = confirmDialog('Hapus data berikutnya?', { tone: 'danger' });
        setResult(String(await confirmation));
        await notification;
      }}>Pesan lalu konfirmasi</button>
      <button onClick={async () => setResult(JSON.stringify(await promptDialog('Berikan alasan penolakan.', { required: true, inputLabel: 'Alasan', confirmLabel: 'Kirim alasan' })))}>Minta alasan</button>
      <button onClick={async () => setResult(JSON.stringify(await promptDialog('Catatan tambahan.', { inputLabel: 'Catatan' })))}>Catatan opsional</button>
      <button onClick={async () => {
        const first = promptDialog('Pesan pertama.', { defaultValue: 'Awal' });
        const second = promptDialog('Pesan kedua.', { defaultValue: 'Berikutnya' });
        setResult(JSON.stringify(await Promise.all([first, second])));
      }}>Antrekan dialog</button>
      <output data-testid="result">{result}</output>
    </>
  );
}

function renderExample(alertTone) {
  return render(<StrictMode><DialogProvider><Example alertTone={alertTone} /></DialogProvider></StrictMode>);
}

test('confirmation is rendered outside the page and cancel is focused by default', async () => {
  const { container } = renderExample();
  const trigger = screen.getByRole('button', { name: 'Hapus log' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Konfirmasi tindakan' });
  expect(container).not.toContainElement(dialog);
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(within(dialog).getByRole('button', { name: 'Batal' })).toHaveFocus();
  expect(container).toHaveAttribute('inert');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  expect(container).not.toHaveAttribute('inert');
  expect(trigger).toHaveFocus();
});

test('confirmation resolves true only after approval', async () => {
  renderExample();
  fireEvent.click(screen.getByRole('button', { name: 'Hapus log' }));
  expect(screen.getByTestId('result')).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole('button', { name: 'Ya, hapus' }));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('true'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('escape cancels and restores focus while tab stays within the dialog', async () => {
  renderExample();
  const trigger = screen.getByRole('button', { name: 'Hapus log' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  const accept = within(dialog).getByRole('button', { name: 'Ya, hapus' });
  const close = within(dialog).getByRole('button', { name: 'Tutup dialog' });
  accept.focus();
  fireEvent.keyDown(accept, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(accept).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  expect(trigger).toHaveFocus();
});

test.each([
  ['success', 'Berhasil'],
  ['error', 'Terjadi kesalahan'],
  ['info', 'Informasi'],
  ['warning', 'Periksa kembali'],
  ['danger', 'Konfirmasi tindakan']
])('%s alert closes automatically after 1.5 seconds without an acknowledgement button', async (tone, title) => {
  jest.useFakeTimers();
  try {
    const { container } = renderExample(tone);
    const trigger = screen.getByRole('button', { name: 'Tampilkan pesan' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog', { name: title });
    expect(dialog).toHaveTextContent('Data berhasil disimpan.');
    expect(dialog).toHaveClass('app-dialog--' + tone);
    expect(within(dialog).queryByRole('button', { name: 'Mengerti' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tutup dialog' })).toHaveFocus();
    act(() => jest.advanceTimersByTime(1499));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await act(async () => jest.advanceTimersByTime(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('result')).toHaveTextContent('ditutup');
    expect(container).not.toHaveAttribute('inert');
    expect(trigger).toHaveFocus();
  } finally {
    jest.useRealTimers();
  }
});

test('closing success early clears its timer without dismissing the next confirmation', async () => {
  jest.useFakeTimers();
  try {
    renderExample();
    fireEvent.click(screen.getByRole('button', { name: 'Pesan lalu konfirmasi' }));
    act(() => jest.advanceTimersByTime(500));
    fireEvent.click(screen.getByRole('button', { name: 'Tutup dialog' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Hapus data berikutnya?');
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('result')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  } finally {
    jest.useRealTimers();
  }
});

test('required prompt rejects whitespace then returns entered text', async () => {
  renderExample();
  fireEvent.click(screen.getByRole('button', { name: 'Minta alasan' }));
  const input = screen.getByRole('textbox', { name: 'Alasan' });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim alasan' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Bagian ini wajib diisi.');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(input, { target: { value: 'Bukti tidak sesuai' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim alasan' }));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('"Bukti tidak sesuai"'));
});

test('closing a prompt returns null instead of an empty string', async () => {
  renderExample();
  fireEvent.click(screen.getByRole('button', { name: 'Minta alasan' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tutup dialog' }));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('null'));
});

test('optional prompt accepts an empty string', async () => {
  renderExample();
  fireEvent.click(screen.getByRole('button', { name: 'Catatan opsional' }));
  fireEvent.click(screen.getByRole('button', { name: 'Simpan keterangan' }));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('""'));
});

test('queued dialogs are shown in order and reset the input for each request', async () => {
  renderExample();
  fireEvent.click(screen.getByRole('button', { name: 'Antrekan dialog' }));
  expect(screen.getByRole('textbox')).toHaveValue('Awal');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pertama' } });
  fireEvent.click(screen.getByRole('button', { name: 'Simpan keterangan' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Pesan kedua.');
  expect(screen.getByRole('textbox')).toHaveValue('Berikutnya');
  fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('["Pertama",null]'));
});

test('clicking the backdrop does not approve or dismiss a destructive action', () => {
  renderExample();
  fireEvent.click(screen.getByRole('button', { name: 'Hapus log' }));
  fireEvent.click(screen.getByTestId('app-dialog-backdrop'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByTestId('result')).toBeEmptyDOMElement();
});

test('unmount settles pending requests and restores the previous page state', async () => {
  let dialogApi;
  function Capture() {
    dialogApi = useDialog();
    return null;
  }
  const { unmount } = render(<DialogProvider><Capture /></DialogProvider>);
  let pending;
  // Opening via a button keeps the state transition inside React's test event handling.
  const { unmount: unmountTrigger } = render(<button onClick={() => { pending = dialogApi.confirmDialog('Konfirmasi'); }}>Buka</button>);
  fireEvent.click(screen.getByRole('button', { name: 'Buka' }));
  unmount();
  await expect(pending).resolves.toBe(false);
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  unmountTrigger();
});

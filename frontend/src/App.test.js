import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock socket.io-client to avoid network activity during test execution
jest.mock('socket.io-client', () => {
  return {
    io: () => ({
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn()
    })
  };
});

import App from './App';
import { DialogProvider } from './context/DialogContext';

test('renders Lintas Data Multimedia application without crashing', () => {
  const { container } = render(
    <BrowserRouter>
      <DialogProvider>
        <App />
      </DialogProvider>
    </BrowserRouter>
  );
  expect(container).toBeDefined();
});

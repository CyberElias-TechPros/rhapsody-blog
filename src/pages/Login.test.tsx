import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthProvider';
import Login from './Login';
import { getStoredToken } from '@/lib/api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login?next=/account']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<div>library page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('Login page', () => {
  it('renders accessible labelled fields, submit disabled until filled', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /sign in/i });
    expect(submit).toBeDisabled();
  });

  it('submits credentials, stores the token and honours ?next', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/auth/login')) {
        return Response.json({ user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'user' }, token: 'jwt-abc' });
      }
      return Response.json({});
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'hunter2!!secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('library page')).toBeInTheDocument());
    expect(getStoredToken()).toBe('jwt-abc');
    const loginBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(loginBody).toEqual({ email: 'a@b.co', password: 'hunter2!!secret' });
  });

  it('surfaces the server message on invalid credentials and stays put', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, { status: 401 })
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrong-password!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled());
    expect(screen.queryByText('library page')).not.toBeInTheDocument();
  });

  it('shows a network error banner when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/sign in failed|network error/i);
  });
});

import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireRole } from '@/auth/RequireRole';
import { SiteLayout } from '@/components/layout/SiteLayout';
import Index from '@/pages/Index';
import Blog from '@/pages/Blog';
import PostDetail from '@/pages/PostDetail';
import Channels from '@/pages/Channels';
import ChannelDetail from '@/pages/ChannelDetail';
import Search from '@/pages/Search';
import About from '@/pages/About';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import NotFound from '@/pages/NotFound';

// Admin + Account are gated, low-traffic screens — keep them out of the main bundle.
const Admin = lazy(() => import('@/pages/Admin'));
const Account = lazy(() => import('@/pages/Account'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never hammer the API on client errors; one gentle retry for blips.
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <BrowserRouter>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<Index />} />
                <Route path="blog" element={<Blog />} />
                <Route path="blog/:channelSlug/:slug" element={<PostDetail />} />
                <Route path="channels" element={<Channels />} />
                <Route path="channels/:slug" element={<ChannelDetail />} />
                <Route path="search" element={<Search />} />
                <Route path="about" element={<About />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route
                  path="account"
                  element={
                    <Suspense fallback={<div className="container py-32 text-center text-muted-foreground" role="status">Loading your library…</div>}>
                      <RequireRole roles={['user', 'editor', 'admin']} />
                    </Suspense>
                  }
                >
                  <Route index element={<Account />} />
                </Route>
                <Route
                  path="admin"
                  element={
                    <Suspense fallback={<div className="container py-32 text-center text-muted-foreground" role="status">Loading admin…</div>}>
                      <RequireRole roles={['editor', 'admin']} />
                    </Suspense>
                  }
                >
                  <Route index element={<Admin />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

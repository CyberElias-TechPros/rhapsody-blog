import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/** Reset scroll position on navigation (SPA default keeps the old offset — confusing). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export const SiteLayout = () => (
  <div className="min-h-screen flex flex-col gradient-warm">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground"
    >
      Skip to content
    </a>
    <ScrollToTop />
    <Navbar />
    <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
      <Suspense
        fallback={
          <div className="container py-24 text-center text-muted-foreground" role="status" aria-live="polite">
            Loading…
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </main>
    <Footer />
  </div>
);

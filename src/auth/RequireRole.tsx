import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * Client-side route gating for UX only (redirect + friendly screens).
 * The actual enforcement of every privileged operation is in the Worker API.
 */
export function RequireRole({ roles }: { roles: string[] }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="container py-32 text-center text-muted-foreground" role="status">
        Checking your session…
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="container py-32 text-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive mx-auto">
          <ShieldAlert className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-4xl mt-5">Restricted area</h1>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
          You’re signed in as <strong>{user.email}</strong> with the <code>{user.role}</code> role.
          This section requires {roles.join(' or ')}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline"><Link to="/">Back home</Link></Button>
          <Button asChild><Link to="/blog">Read the blog</Link></Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

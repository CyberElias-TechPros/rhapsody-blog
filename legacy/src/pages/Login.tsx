import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError } from '@/lib/api';
import { useSeo } from '@/hooks/useSeo';

const Login = () => {
  useSeo({ title: 'Sign in', noindex: true });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const safeNext = next.startsWith('/') ? next : '/'; // open-redirect guard

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back!');
      navigate(safeNext, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed — please try again.');
    } finally {
      setPending(false);
    }
  }

  // Convenience for local dev only; never renders in production.
  const devHint = import.meta.env.DEV ? 'admin@meaning.app' : null;

  return (
    <div className="container py-20 max-w-md mx-auto px-4">
      <div className="text-center mb-10">
        <div className="grid place-items-center w-12 h-12 rounded-2xl gradient-hero mx-auto shadow-glow">
          <Sparkles className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-4xl font-semibold mt-5">Welcome back</h1>
        <p className="text-muted-foreground mt-2">Sign in to save posts and follow channels.</p>
      </div>
      <form onSubmit={onSubmit} className="gradient-card rounded-2xl p-8 border border-border/60 shadow-soft space-y-5" noValidate>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {devHint && <p className="text-xs text-muted-foreground">dev seed admin: {devHint}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full gradient-hero text-primary-foreground border-0" disabled={pending || !email || !password}>
          {pending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Signing in</> : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New here? <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-primary hover:underline">Create an account</Link>
        </p>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Forgot your password? Ask an administrator to reset it — email-based self-service reset is on the roadmap (see README).
      </p>
    </div>
  );
};

export default Login;

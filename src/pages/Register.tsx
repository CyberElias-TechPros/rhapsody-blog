import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError } from '@/lib/api';
import { useSeo } from '@/hooks/useSeo';

/** Client-side rules mirror the Worker's zod schema — server still re-validates everything. */
const rules = {
  name: (v: string) => (v.trim().length >= 2 && v.trim().length <= 80 ? null : 'Name must be 2–80 characters.'),
  email: (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address.'),
  password: (v: string) =>
    v.length >= 10 ? (v.length <= 128 ? null : 'Password is too long.') : 'Use at least 10 characters.',
};

const Register = () => {
  useSeo({ title: 'Create an account', noindex: true });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const safeNext = next.startsWith('/') ? next : '/';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fieldError = (field: keyof typeof rules): string | null => {
    const rule = rules[field];
    const err = rule(form[field]);
    return touched[field] ? err : null;
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    const first = (Object.keys(rules) as (keyof typeof rules)[]).find((f) => rules[f](form[f]) !== null);
    if (first) return;
    setPending(true);
    setFormError(null);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      toast.success('Account created — welcome!');
      navigate(safeNext, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const msg = Object.entries(err.details).map(([k, v]) => `${k === '_' ? '' : `${k}: `}${v.join(', ')}`).join(' · ');
          setFormError(msg || err.message);
        } else setFormError(err.message);
      } else setFormError('Registration failed — please try again.');
    } finally {
      setPending(false);
    }
  }

  const strength = (() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 10) score++;
    if (p.length >= 16) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (/(?=.*[a-z])(?=.*[A-Z])/.test(p)) score++;
    return Math.min(score, 4);
  })();

  return (
    <div className="container py-20 max-w-md mx-auto px-4">
      <div className="text-center mb-10">
        <div className="grid place-items-center w-12 h-12 rounded-2xl gradient-hero mx-auto shadow-glow">
          <Sparkles className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-4xl font-semibold mt-5">Create your account</h1>
        <p className="text-muted-foreground mt-2">Free forever. Save bookmarks and follow channels.</p>
      </div>
      <form onSubmit={onSubmit} className="gradient-card rounded-2xl p-8 border border-border/60 shadow-soft space-y-5" noValidate>
        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {formError}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required placeholder="Jane Doe" autoComplete="name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            aria-invalid={!!fieldError('name')} aria-describedby={fieldError('name') ? 'name-err' : undefined} />
          {fieldError('name') && <p id="name-err" className="text-xs text-destructive">{fieldError('name')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required placeholder="you@example.com" autoComplete="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={!!fieldError('email')} aria-describedby={fieldError('email') ? 'email-err' : undefined} />
          {fieldError('email') && <p id="email-err" className="text-xs text-destructive">{fieldError('email')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required autoComplete="new-password" minLength={10} value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            aria-invalid={!!fieldError('password')} aria-describedby={fieldError('password') ? 'pw-err' : 'pw-strength'} />
          {fieldError('password') ? (
            <p id="pw-err" className="text-xs text-destructive">{fieldError('password')}</p>
          ) : (
            <div id="pw-strength" className="flex items-center gap-2" aria-label={`Password strength: ${strength} of 4`}>
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`h-1 w-8 rounded-full transition-colors ${i < strength ? 'bg-primary' : 'bg-secondary'}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">min 10 characters</span>
            </div>
          )}
        </div>
        <Button type="submit" className="w-full gradient-hero text-primary-foreground border-0" disabled={pending}>
          {pending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Creating account</> : 'Create account'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have one? <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;

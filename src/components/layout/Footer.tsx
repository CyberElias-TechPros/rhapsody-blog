import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth, hasRole } from '@/auth/AuthProvider';
import { useChannels } from '@/lib/queries';
import { NewsletterForm } from '@/components/common/NewsletterForm';

export const Footer = () => {
  const { data, isError, isLoading } = useChannels();
  const channels = data?.channels ?? [];
  const { user } = useAuth();

  return (
    <footer className="border-t border-border/60 mt-24 bg-secondary/30">
      <div className="container py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero">
              <Sparkles className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </span>
            <span className="font-serif text-xl font-semibold">Meaning.</span>
          </Link>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Giving your life a meaning. We turn every Telegram broadcast from your favourite
            channels into a beautifully readable, searchable blog — so the Word stays with you.
          </p>
          <p className="mt-5 text-sm font-medium">Get the daily digest</p>
          <NewsletterForm className="mt-2 max-w-sm" />
        </div>

        <nav aria-label="Channels">
          <h4 className="font-semibold mb-3">Channels</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {isLoading && <li aria-hidden="true" className="h-4 w-32 bg-secondary rounded animate-pulse" />}
            {isError && <li className="text-xs">Channel list unavailable right now.</li>}
            {channels.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link to={`/channels/${c.slug}`} className="hover:text-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Explore">
          <h4 className="font-semibold mb-3">Explore</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/blog" className="hover:text-primary transition-colors">All posts</Link></li>
            <li><Link to="/search" className="hover:text-primary transition-colors">Search</Link></li>
            <li><Link to="/about" className="hover:text-primary transition-colors">About</Link></li>
            {user && <li><Link to="/account" className="hover:text-primary transition-colors">My library</Link></li>}
            {hasRole(user, ['editor', 'admin']) && (
              <li><Link to="/admin" className="hover:text-primary transition-colors">Admin</Link></li>
            )}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/60">
        <div className="container py-5 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Meaning. Content remains the property of its authors; we mirror and attribute.</span>
          <span>Built with faith ✦</span>
        </div>
      </div>
    </footer>
  );
};

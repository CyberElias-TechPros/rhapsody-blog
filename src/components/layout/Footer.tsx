import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { CHANNELS } from "@/lib/channels";

export const Footer = () => (
  <footer className="border-t border-border/60 mt-24 bg-secondary/30">
    <div className="container py-14 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-2 max-w-md">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </span>
          <span className="font-serif text-xl font-semibold">Meaning.</span>
        </Link>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Giving your life a meaning. We turn every Telegram broadcast from your favourite
          channels into a beautifully readable, searchable blog — so the Word stays with you.
        </p>
      </div>

      <div>
        <h4 className="font-semibold mb-3">Channels</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {CHANNELS.map(c => (
            <li key={c.slug}>
              <Link to={`/channels/${c.slug}`} className="hover:text-primary transition-colors">{c.name}</Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-semibold mb-3">Explore</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><Link to="/blog" className="hover:text-primary">All posts</Link></li>
          <li><Link to="/search" className="hover:text-primary">Search</Link></li>
          <li><Link to="/about" className="hover:text-primary">About</Link></li>
          <li><Link to="/admin" className="hover:text-primary">Admin</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-border/60">
      <div className="container py-5 text-xs text-muted-foreground flex justify-between">
        <span>© {new Date().getFullYear()} Meaning. All rights reserved.</span>
        <span>Built with faith ✦</span>
      </div>
    </div>
  </footer>
);

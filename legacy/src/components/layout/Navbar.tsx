import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, Search, Settings2, ShieldCheck, Sparkles, UserCircle2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/auth/AuthProvider';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { hasRole } from '@/auth/AuthProvider';

const links = [
  { to: '/', label: 'Home' },
  { to: '/blog', label: 'Blog' },
  { to: '/channels', label: 'Channels' },
  { to: '/about', label: 'About' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'text-primary' : 'text-foreground/70 hover:text-foreground'
  }`;

export const Navbar = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, logout } = useAuth();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      setSheetOpen(false);
    }
  };

  const initials = user ? (user.name.trim().slice(0, 2) || 'U').toUpperCase() : '';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/75 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Meaning<span className="text-primary">.</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <form onSubmit={submit} className="hidden lg:flex items-center relative" role="search" aria-label="Site search">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search devotionals..."
              aria-label="Search devotionals"
              className="pl-9 pr-3 py-2 rounded-full bg-secondary/70 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </form>

          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 sm:px-3" aria-label="Account menu">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline max-w-[10rem] truncate text-sm">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="flex items-center gap-2">
                    <UserCircle2 className="w-4 h-4" aria-hidden="true" /> My library
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account?tab=bookmarks" className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4" aria-hidden="true" /> Bookmarks
                  </Link>
                </DropdownMenuItem>
                {hasRole(user, ['editor', 'admin']) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Admin
                        {user.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-primary ml-auto" aria-label="Administrator" />}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout()} className="flex items-center gap-2 text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="shadow-soft">
                <Link to="/register">Get Started</Link>
              </Button>
            </div>
          )}

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" /> Menu
                </SheetTitle>
              </SheetHeader>
              <form onSubmit={submit} className="mt-4 relative" role="search" aria-label="Site search">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search devotionals..."
                  aria-label="Search devotionals"
                  className="w-full pl-9 pr-3 py-2.5 rounded-full bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </form>
              <div className="mt-4 flex flex-col gap-1">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.to === '/'}
                    onClick={() => setSheetOpen(false)}
                    className={({ isActive }) =>
                      `px-3 py-3 rounded-md text-base ${isActive ? 'bg-secondary text-primary font-medium' : 'hover:bg-secondary/60'}`
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
                <div className="border-t my-3" aria-hidden="true" />
                {user ? (
                  <>
                    <Link to="/account" onClick={() => setSheetOpen(false)} className="px-3 py-3 rounded-md flex items-center gap-2 hover:bg-secondary/60">
                      <Settings2 className="w-4 h-4" aria-hidden="true" /> My library
                    </Link>
                    {hasRole(user, ['editor', 'admin']) && (
                      <Link to="/admin" onClick={() => setSheetOpen(false)} className="px-3 py-3 rounded-md flex items-center gap-2 hover:bg-secondary/60">
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => { logout(); setSheetOpen(false); }}
                      className="px-3 py-3 rounded-md text-left flex items-center gap-2 text-destructive hover:bg-secondary/60"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setSheetOpen(false)} className="px-3 py-3 rounded-md hover:bg-secondary/60">Sign in</Link>
                    <Button asChild className="mt-2">
                      <Link to="/register" onClick={() => setSheetOpen(false)}>Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

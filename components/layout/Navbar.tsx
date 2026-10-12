'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  Bookmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { hasRole, useAuth } from '@/auth/AuthProvider';
import { NAV_LINKS, SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

/** Router-aware replacement for react-router's NavLink: active when the path matches. */
function useIsActive() {
  const pathname = usePathname() ?? '/';
  return (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
}

export function Navbar() {
  const router = useRouter();
  const isActive = useIsActive();
  const [q, setQ] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, logout } = useAuth();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
    setSheetOpen(false);
  };

  const initials = user ? (user.name.trim().slice(0, 2) || 'U').toUpperCase() : '';

  const linkClass = (href: string) =>
    cn(
      'px-2.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
      isActive(href) ? 'text-primary' : 'text-foreground/70 hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/75 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            {SITE.shortName}
            <span className="text-primary">.</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
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
              className="pl-9 pr-3 py-2 rounded-full bg-secondary/70 text-sm w-44 xl:w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                  <Link href="/library" className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4" aria-hidden="true" /> Saved devotionals
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center gap-2">
                    <UserCircle2 className="w-4 h-4" aria-hidden="true" /> My account
                  </Link>
                </DropdownMenuItem>
                {hasRole(user, ['editor', 'admin']) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Admin
                        {user.role === 'admin' && (
                          <ShieldCheck className="w-3.5 h-3.5 text-primary ml-auto" aria-label="Administrator" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => logout()}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="shadow-soft">
                <Link href="/register">Get Started</Link>
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
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search devotionals..."
                  aria-label="Search devotionals"
                  className="w-full pl-9 pr-3 py-2.5 rounded-full bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </form>
              <div className="mt-4 flex flex-col gap-1">
                {/* The bar has no Home item — the logo covers it — but the sheet has room. */}
                <Link
                  href="/"
                  onClick={() => setSheetOpen(false)}
                  className={cn('px-3 py-3 rounded-md text-base', isActive('/') ? 'bg-secondary text-primary font-medium' : 'hover:bg-secondary/60')}
                >
                  Home
                </Link>
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      'px-3 py-3 rounded-md text-base',
                      isActive(l.href) ? 'bg-secondary text-primary font-medium' : 'hover:bg-secondary/60'
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="border-t my-3" aria-hidden="true" />
                {user ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setSheetOpen(false)}
                      className="px-3 py-3 rounded-md flex items-center gap-2 hover:bg-secondary/60"
                    >
                      <Settings2 className="w-4 h-4" aria-hidden="true" /> My library
                    </Link>
                    {hasRole(user, ['editor', 'admin']) && (
                      <Link
                        href="/admin"
                        onClick={() => setSheetOpen(false)}
                        className="px-3 py-3 rounded-md flex items-center gap-2 hover:bg-secondary/60"
                      >
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setSheetOpen(false);
                      }}
                      className="px-3 py-3 rounded-md text-left flex items-center gap-2 text-destructive hover:bg-secondary/60"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setSheetOpen(false)}
                      className="px-3 py-3 rounded-md hover:bg-secondary/60"
                    >
                      Sign in
                    </Link>
                    <Button asChild className="mt-2">
                      <Link href="/register" onClick={() => setSheetOpen(false)}>
                        Get Started
                      </Link>
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
}

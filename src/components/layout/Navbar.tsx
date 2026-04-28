import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const links = [
  { to: "/", label: "Home" },
  { to: "/blog", label: "Blog" },
  { to: "/channels", label: "Channels" },
  { to: "/about", label: "About" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/75 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid place-items-center w-9 h-9 rounded-xl gradient-hero shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Meaning<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "text-primary" : "text-foreground/70 hover:text-foreground"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <form onSubmit={submit} className="hidden lg:flex items-center relative">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search devotionals..."
              className="pl-9 pr-3 py-2 rounded-full bg-secondary/70 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </form>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex shadow-soft">
            <Link to="/register">Get Started</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {links.map(l => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.to === "/"}
                    className={({ isActive }) =>
                      `px-3 py-3 rounded-md text-base ${isActive ? "bg-secondary text-primary" : "hover:bg-secondary/60"}`
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
                <div className="border-t my-3" />
                <Link to="/login" className="px-3 py-3 rounded-md hover:bg-secondary/60">Sign in</Link>
                <Link to="/register" className="px-3 py-3 rounded-md text-primary font-medium">Get Started</Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

const Login = () => (
  <div className="container py-20 max-w-md">
    <div className="text-center mb-10">
      <div className="grid place-items-center w-12 h-12 rounded-2xl gradient-hero mx-auto shadow-glow">
        <Sparkles className="w-6 h-6 text-primary-foreground" />
      </div>
      <h1 className="font-serif text-4xl font-semibold mt-5">Welcome back</h1>
      <p className="text-muted-foreground mt-2">Sign in to save posts and follow channels.</p>
    </div>
    <form className="gradient-card rounded-2xl p-8 border border-border/60 shadow-soft space-y-5"
          onSubmit={(e) => { e.preventDefault(); alert("Connect to your backend /api/auth/login"); }}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required />
      </div>
      <Button type="submit" className="w-full gradient-hero text-primary-foreground border-0">Sign in</Button>
      <p className="text-center text-sm text-muted-foreground">
        New here? <Link to="/register" className="text-primary hover:underline">Create an account</Link>
      </p>
    </form>
  </div>
);

export default Login;

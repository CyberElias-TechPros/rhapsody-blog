import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useSeo';

const NotFound = () => {
  useSeo({ title: 'Page not found', noindex: true });
  useEffect(() => {
    document.title = 'Page not found — Meaning';
  }, []);
  return (
    <div className="container py-32 text-center">
      <div className="font-serif text-8xl font-semibold text-primary/20 select-none" aria-hidden="true">404</div>
      <h1 className="font-serif text-4xl md:text-5xl mt-4">This page drifted away.</h1>
      <p className="mt-4 text-muted-foreground max-w-md mx-auto">
        The page you’re looking for doesn’t exist, was unpublished, or moved to a new slug.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
        <Button asChild><Link to="/">Go home</Link></Button>
        <Button asChild variant="outline"><Link to="/blog">Browse the blog</Link></Button>
      </div>
    </div>
  );
};

export default NotFound;

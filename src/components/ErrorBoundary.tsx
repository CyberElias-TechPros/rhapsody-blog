import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Last-line-of-safety UI: a render crash must never leave a white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Uncaught render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
        <h1 className="font-serif text-3xl font-semibold">Something broke</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          An unexpected error occurred while rendering. Reloading usually fixes it. If it keeps happening,
          contact support.
        </p>
        <pre className="text-xs text-muted-foreground/70 max-w-lg overflow-auto text-left">{String(this.state.error?.message)}</pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          Reload the page
        </button>
      </div>
    );
  }
}

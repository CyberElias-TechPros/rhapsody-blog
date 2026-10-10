import { PostGridSkeleton } from '@/components/common/StateBlocks';

export default function Loading() {
  return (
    <div className="container py-16 md:py-20">
      <div className="h-4 w-24 rounded bg-secondary animate-pulse mb-4" aria-hidden="true" />
      <div className="h-12 w-2/3 max-w-xl rounded bg-secondary animate-pulse mb-6" aria-hidden="true" />
      <div className="h-4 w-1/2 max-w-md rounded bg-secondary animate-pulse mb-12" aria-hidden="true" />
      <PostGridSkeleton count={6} />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}

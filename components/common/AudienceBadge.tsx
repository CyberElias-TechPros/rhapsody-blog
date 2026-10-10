import Link from 'next/link';
import { AUDIENCES, type AudienceId } from '@/lib/audiences';
import { cn } from '@/lib/utils';

/**
 * Which edition family an article belongs to. On a card it is a static pill; on its own article
 * page the pill is a link into that audience's listing, which is how a reader who has drifted in
 * from a search result finds the rest of the family.
 */
export function AudienceBadge({
  audience,
  className,
  href,
}: {
  audience: AudienceId;
  className?: string;
  href?: string;
}) {
  const meta = AUDIENCES[audience];
  const classes = cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.7rem] font-medium uppercase tracking-wider',
    'bg-secondary text-muted-foreground hover:text-primary transition-colors',
    className
  );
  const content = <span className="truncate">{meta.shortLabel}</span>;

  if (href) {
    return (
      <Link href={href} className={classes} title={`${meta.label} — ${meta.blurb}`}>
        {content}
      </Link>
    );
  }
  return (
    <span className={classes} title={meta.label}>
      {content}
    </span>
  );
}

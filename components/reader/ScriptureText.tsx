import { BibleRefLink } from '@/components/reader/BibleRefLink';
import { splitReferences } from '@/lib/bible';

/**
 * Text with its Bible references linked ("Romans 5:17; 2 Corinthians 5:21" → two links). Server
 * component: the split happens at build time, and only the links themselves are client islands
 * (they read the reader's preferred translation).
 */
export function ScriptureText({ text, className }: { text: string; className?: string }) {
  const segments = splitReferences(text);
  if (!segments.some((segment) => segment.type === 'ref')) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.type === 'ref' ? (
          <BibleRefLink key={index} query={segment.query} version={segment.version}>
            {segment.text}
          </BibleRefLink>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </span>
  );
}

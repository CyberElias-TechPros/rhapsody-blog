import { Fragment, type ReactNode } from 'react';
import { parseBlocks, parseInline, type InlineToken } from '@/lib/markdown-lite';

/**
 * Renders synced Telegram post content safely: blocks → semantic elements, inline tokens →
 * React nodes. No dangerouslySetInnerHTML anywhere.
 */
function renderTokens(tokens: InlineToken[]): ReactNode[] {
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'text':
        return <Fragment key={i}>{t.text}</Fragment>;
      case 'bold':
        return <strong key={i}>{renderTokens(t.children)}</strong>;
      case 'italic':
        return <em key={i}>{renderTokens(t.children)}</em>;
      case 'code':
        return (
          <code key={i} className="rounded bg-secondary px-1.5 py-0.5 text-[0.9em] font-mono">
            {t.text}
          </code>
        );
      case 'link':
        return (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderTokens(t.children)}
          </a>
        );
    }
  });
}

export function Prose({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className={`prose-blog ${className ?? ''}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading2':
            return <h2 key={i}>{renderTokens(parseInline(b.text))}</h2>;
          case 'heading3':
            return <h3 key={i}>{renderTokens(parseInline(b.text))}</h3>;
          case 'quote':
            return <blockquote key={i}>{renderTokens(parseInline(b.text))}</blockquote>;
          default:
            return <p key={i}>{renderTokens(parseInline(b.text))}</p>;
        }
      })}
    </div>
  );
}

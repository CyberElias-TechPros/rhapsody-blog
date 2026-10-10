import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders the article message.
 *
 * `react-markdown` never emits raw HTML (no `rehype-raw`), so even a stray `<script>` in a
 * source PDF would render as text — the same XSS-safe posture the old `markdown-lite` parser
 * had, without hand-rolling a parser.
 */
export function Markdown({ children, dropCap = false }: { children: string; dropCap?: boolean }) {
  return (
    <div className={`prose-blog ${dropCap ? 'prose-dropcap' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: content }) => <p>{content}</p>,
          h2: ({ children: content }) => <h2>{content}</h2>,
          h3: ({ children: content }) => <h3>{content}</h3>,
          blockquote: ({ children: content }) => <blockquote>{content}</blockquote>,
          strong: ({ children: content }) => <strong>{content}</strong>,
          em: ({ children: content }) => <em>{content}</em>,
          ul: ({ children: content }) => <ul>{content}</ul>,
          ol: ({ children: content }) => <ol className="list-decimal pl-6 mb-5 space-y-1.5 text-lg">{content}</ol>,
          a: ({ href, children: content }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {content}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Safe Markdown: raw HTML is not rendered (react-markdown default), and only
 * http(s)/mailto links survive URL sanitising. Headings start at h2 because the
 * page title is the h1.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown space-y-3 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (/^(https?:|mailto:|#|\/)/i.test(url) ? url : '')}
        components={{
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            />
          ),
          h1: ({ node: _node, ...props }) => <h2 {...props} className="text-xl font-bold" />,
          h2: ({ node: _node, ...props }) => <h2 {...props} className="text-lg font-semibold" />,
          h3: ({ node: _node, ...props }) => <h3 {...props} className="font-semibold" />,
          ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc space-y-1 pl-6" />,
          ol: ({ node: _node, ...props }) => (
            <ol {...props} className="list-decimal space-y-1 pl-6" />
          ),
          code: ({ node: _node, ...props }) => (
            <code {...props} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]" />
          ),
          pre: ({ node: _node, ...props }) => (
            <pre
              {...props}
              className="overflow-x-auto rounded-lg bg-muted p-4 text-sm [&_code]:bg-transparent [&_code]:p-0"
            />
          ),
          img: ({ node: _node, alt, ...props }) => (
            <img {...props} alt={alt ?? ''} loading="lazy" className="max-h-96 rounded-lg" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

import { useRef, useEffect } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';
import './MarkdownPreview.css';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code(token: { text: string; lang?: string; escaped?: boolean }) {
      const lang = (token.lang || '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      const code = token.text.replace(/\n+$/, '') + '\n';
      if (lang === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
      }
      const escaped = token.escaped ? code : escapeHtml(code);
      return lang
        ? `<pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>\n`
        : `<pre><code>${escaped}</code></pre>\n`;
    },
  },
});

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      const raw = content.trim();
      const html = raw
        ? ((await marked.parse(content)) as string)
        : '<p class="wiki-preview-empty">Nothing to preview.</p>';
      if (cancelled || !containerRef.current) return;
      el.innerHTML = html;
      const nodes = el.querySelectorAll('.mermaid');
      if (nodes.length > 0) {
        await mermaid.run({ nodes, suppressErrors: true }).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`wiki-markdown-preview ${className}`}
      data-markdown-preview
    />
  );
}

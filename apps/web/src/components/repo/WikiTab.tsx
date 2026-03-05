import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { Modal } from '../Modal';
import { MarkdownPreview } from './MarkdownPreview';
import './WikiTab.css';

export interface WikiPageItem {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
}

export interface WikiPageDetail extends WikiPageItem {
  body: string | null;
}

interface WikiTabProps {
  repoId: string;
}

const slugRegex = /^[a-z0-9-_]+$/;

function slugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

export default function WikiTab({ repoId }: WikiTabProps) {
  const [pages, setPages] = useState<WikiPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<WikiPageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ pages: WikiPageItem[] }>(`/repos/${repoId}/wiki`);
      setPages(data.pages || []);
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const loadPage = useCallback(
    async (slug: string) => {
      setDetailLoading(true);
      try {
        const data = await apiFetch<{ page: WikiPageDetail }>(`/repos/${repoId}/wiki/${encodeURIComponent(slug)}`);
        setSelectedPage(data.page);
        setEditTitle(data.page.title);
        setEditBody(data.page.body ?? '');
        setEditError(null);
      } catch {
        setEditError('Failed to load page');
        setSelectedPage(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [repoId]
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const title = createTitle.trim();
    const slug = createSlug.trim().toLowerCase();
    if (!title) {
      setCreateError('Title is required');
      return;
    }
    if (!slug) {
      setCreateError('Slug is required (e.g. my-page)');
      return;
    }
    if (!slugRegex.test(slug)) {
      setCreateError('Slug may only contain lowercase letters, numbers, hyphens, and underscores');
      return;
    }
    setCreateSubmitting(true);
    try {
      const data = await apiFetch<{ page: WikiPageDetail }>(`/repos/${repoId}/wiki`, {
        method: 'POST',
        body: JSON.stringify({ slug, title, body: createBody.trim() || undefined }),
      });
      setCreateOpen(false);
      setCreateSlug('');
      setCreateTitle('');
      setCreateBody('');
      loadPages();
      setSelectedPage(data.page);
      setEditTitle(data.page.title);
      setEditBody(data.page.body ?? '');
      setEditError(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create page');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPage) return;
    setEditError(null);
    const title = editTitle.trim();
    if (!title) {
      setEditError('Title is required');
      return;
    }
    setEditSubmitting(true);
    try {
      const data = await apiFetch<{ page: WikiPageDetail }>(
        `/repos/${repoId}/wiki/${encodeURIComponent(selectedPage.slug)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title, body: editBody }),
        }
      );
      setSelectedPage(data.page);
      loadPages();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update page');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreateTitleChange = (value: string) => {
    setCreateTitle(value);
    if (!createSlug || slugRegex.test(slugFromTitle(value))) {
      setCreateSlug(slugFromTitle(value));
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="wiki-tab">
      <div className="wiki-toolbar">
        <button
          type="button"
          className="wiki-btn-primary"
          onClick={() => {
            setCreateOpen(true);
            setCreateError(null);
            setCreateSlug('');
            setCreateTitle('');
            setCreateBody('');
          }}
        >
          New page
        </button>
      </div>

      {loading ? (
        <div className="wiki-loading">Loading wiki…</div>
      ) : (
        <div className="wiki-layout">
          <aside className="wiki-sidebar">
            <ul className="wiki-page-list" aria-label="Wiki pages">
              {pages.length === 0 ? (
                <li className="wiki-empty">No pages yet. Create one to get started.</li>
              ) : (
                pages.map((p) => (
                  <li
                    key={p.id}
                    className={`wiki-page-item ${selectedPage?.slug === p.slug ? 'selected' : ''}`}
                    onClick={() => loadPage(p.slug)}
                  >
                    <span className="wiki-page-title">{p.title}</span>
                    <span className="wiki-page-meta">{formatDate(p.updated_at)}</span>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <main className="wiki-main">
            {!selectedPage ? (
              <div className="wiki-welcome">
                {pages.length === 0
                  ? 'Create a page to add documentation, runbooks, or notes in Markdown. Use ```mermaid code blocks for diagrams.'
                  : 'Select a page from the list or create a new one.'}
              </div>
            ) : detailLoading ? (
              <div className="wiki-loading">Loading…</div>
            ) : (
              <div className="wiki-split-view">
                <section
                  className={`wiki-editor-panel ${editorCollapsed ? 'wiki-panel-collapsed' : ''}`}
                  aria-label="Markdown editor"
                >
                  <div className="wiki-panel-header">
                    <span className="wiki-panel-title">Editor</span>
                    <button
                      type="button"
                      className="wiki-panel-toggle"
                      onClick={() => setEditorCollapsed((c) => !c)}
                      aria-expanded={!editorCollapsed}
                      aria-label={editorCollapsed ? 'Expand editor' : 'Collapse editor'}
                      title={editorCollapsed ? 'Expand editor' : 'Collapse editor'}
                    >
                      {editorCollapsed ? '▶' : '◀'}
                    </button>
                  </div>
                  {!editorCollapsed && (
                    <form onSubmit={handleUpdateSubmit} className="wiki-editor-form">
                      <div className="wiki-editor-header">
                        <input
                          type="text"
                          className="wiki-input wiki-title-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Page title"
                          maxLength={500}
                          disabled={editSubmitting}
                          aria-label="Page title"
                        />
                        <div className="wiki-editor-actions">
                          <button
                            type="submit"
                            className="wiki-btn-primary"
                            disabled={editSubmitting}
                          >
                            {editSubmitting ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                      <div className="wiki-editor-body">
                        <textarea
                          className="wiki-textarea wiki-markdown-input"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          placeholder="Write your content in **Markdown**. Use ```mermaid for diagrams..."
                          spellCheck={false}
                          disabled={editSubmitting}
                          aria-label="Page content (Markdown)"
                        />
                      </div>
                      {editError && <p className="wiki-error">{editError}</p>}
                    </form>
                  )}
                </section>
                <section
                  className={`wiki-preview-panel ${previewCollapsed ? 'wiki-panel-collapsed' : ''}`}
                  aria-label="Preview"
                >
                  <div className="wiki-panel-header">
                    <span className="wiki-panel-title">Preview</span>
                    <button
                      type="button"
                      className="wiki-panel-toggle"
                      onClick={() => setPreviewCollapsed((c) => !c)}
                      aria-expanded={!previewCollapsed}
                      aria-label={previewCollapsed ? 'Expand preview' : 'Collapse preview'}
                      title={previewCollapsed ? 'Expand preview' : 'Collapse preview'}
                    >
                      {previewCollapsed ? '◀' : '▶'}
                    </button>
                  </div>
                  {!previewCollapsed && (
                    <div className="wiki-preview-content">
                      <MarkdownPreview content={editBody} />
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      )}

      {createOpen && (
        <Modal title="New wiki page" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateSubmit} className="modal-form">
            <label htmlFor="wiki-create-title">Title</label>
            <input
              id="wiki-create-title"
              type="text"
              value={createTitle}
              onChange={(e) => handleCreateTitleChange(e.target.value)}
              placeholder="Page title"
              autoFocus
              disabled={createSubmitting}
              maxLength={500}
            />
            <label htmlFor="wiki-create-slug">Slug (URL path)</label>
            <input
              id="wiki-create-slug"
              type="text"
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              placeholder="my-page"
              disabled={createSubmitting}
              pattern="[a-z0-9-_]+"
            />
            <label htmlFor="wiki-create-body">Content (optional, Markdown)</label>
            <textarea
              id="wiki-create-body"
              value={createBody}
              onChange={(e) => setCreateBody(e.target.value)}
              placeholder="You can add content now or after creating the page."
              rows={4}
              disabled={createSubmitting}
              className="modal-form-textarea"
            />
            {createError && <p className="modal-error">{createError}</p>}
            <div className="modal-actions">
              <button type="button" onClick={() => setCreateOpen(false)} className="modal-btn secondary">
                Cancel
              </button>
              <button type="submit" className="modal-btn primary" disabled={createSubmitting}>
                {createSubmitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

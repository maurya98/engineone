import { useState, useRef, useEffect } from 'react';
import { getToken } from '../lib/authToken';
import './Modal.css';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </>
  );
}

interface CreateWorkspaceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateWorkspaceModal({ onClose, onSuccess }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch('/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to create workspace');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New workspace" onClose={onClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        <label htmlFor="workspace-name">Name</label>
        <input
          id="workspace-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace name"
          autoFocus
          disabled={submitting}
          maxLength={255}
        />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="modal-btn secondary">
            Cancel
          </button>
          <button type="submit" className="modal-btn primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface CreateRepoModalProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateRepoModal({
  workspaceId,
  workspaceName,
  onClose,
  onSuccess,
}: CreateRepoModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(`/workspaces/${workspaceId}/repos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to create repository');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`New repository in ${workspaceName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        <label htmlFor="repo-name">Name</label>
        <input
          id="repo-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Repository name"
          autoFocus
          disabled={submitting}
          maxLength={255}
        />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="modal-btn secondary">
            Cancel
          </button>
          <button type="submit" className="modal-btn primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

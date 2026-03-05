import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { COMPANY_NAME } from '../config';
import './Preferences.css';

interface Prefs {
  theme: string;
  font_size: string;
  font_style: string;
  icon_pack: string;
}

const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  font_size: 'medium',
  font_style: 'default',
  icon_pack: 'default',
};

const FONT_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Default (system UI)' },
  { value: 'sans', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

const ICON_PACK_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'outline', label: 'Outline' },
  { value: 'filled', label: 'Filled' },
  { value: 'duotone', label: 'Duotone' },
];

export default function Preferences() {
  const { setPreference, setFontSize } = useTheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ preferences: Prefs }>('/users/me/preferences')
      .then((data) => {
        if (cancelled) return;
        const raw = data.preferences;
        const fontStyle = FONT_STYLE_OPTIONS.some((o) => o.value === raw?.font_style)
          ? raw!.font_style
          : DEFAULT_PREFS.font_style;
        const iconPack = ICON_PACK_OPTIONS.some((o) => o.value === raw?.icon_pack)
          ? raw!.icon_pack
          : DEFAULT_PREFS.icon_pack;
        setPrefs({
          theme: raw?.theme ?? DEFAULT_PREFS.theme,
          font_size: raw?.font_size ?? DEFAULT_PREFS.font_size,
          font_style: fontStyle,
          icon_pack: iconPack,
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load preferences.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(prefs),
      });
      if (prefs.theme === 'light' || prefs.theme === 'dark' || prefs.theme === 'system') {
        setPreference(prefs.theme);
      }
      if (prefs.font_size === 'small' || prefs.font_size === 'medium' || prefs.font_size === 'large') {
        setFontSize(prefs.font_size);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="preferences-page">
        <h1>Preferences</h1>
        <p className="preferences-intro">Manage how {COMPANY_NAME} looks and behaves for you.</p>
        <div className="preferences-loading" aria-busy="true">
          <p>Loading preferences…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preferences-page">
      <h1>Preferences</h1>
      <p className="preferences-intro">Manage how {COMPANY_NAME} looks and behaves for you.</p>

      <form onSubmit={handleSave} className="preferences-form">
        {error && (
          <div className="preferences-error" role="alert">
            {error}
          </div>
        )}

        <section className="preferences-section" aria-labelledby="prefs-appearance">
          <h2 id="prefs-appearance" className="preferences-section-title">Appearance</h2>
          <div className="preferences-field">
            <label htmlFor="prefs-theme">Theme</label>
            <select
              id="prefs-theme"
              value={prefs.theme}
              onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value }))}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System (follow device)</option>
            </select>
            <span className="preferences-hint">Choose light, dark, or match your system.</span>
          </div>
        </section>

        <section className="preferences-section" aria-labelledby="prefs-typography">
          <h2 id="prefs-typography" className="preferences-section-title">Typography</h2>
          <div className="preferences-field">
            <label htmlFor="prefs-font-size">Font size</label>
            <select
              id="prefs-font-size"
              value={prefs.font_size}
              onChange={(e) => setPrefs((p) => ({ ...p, font_size: e.target.value }))}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
            <span className="preferences-hint">Base text size across the app.</span>
          </div>
          <div className="preferences-field">
            <label htmlFor="prefs-font-style">Font style</label>
            <select
              id="prefs-font-style"
              value={prefs.font_style}
              onChange={(e) => setPrefs((p) => ({ ...p, font_style: e.target.value }))}
            >
              {FONT_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="preferences-hint">Typeface style for the interface.</span>
          </div>
        </section>

        <section className="preferences-section" aria-labelledby="prefs-advanced">
          <h2 id="prefs-advanced" className="preferences-section-title">Advanced</h2>
          <div className="preferences-field">
            <label htmlFor="prefs-icon-pack">Icon pack</label>
            <select
              id="prefs-icon-pack"
              value={prefs.icon_pack}
              onChange={(e) => setPrefs((p) => ({ ...p, icon_pack: e.target.value }))}
            >
              {ICON_PACK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="preferences-hint">Icon style used across the app.</span>
          </div>
        </section>

        <div className="preferences-actions">
          <button
            type="submit"
            disabled={saving}
            className={`preferences-submit ${saved ? 'saved' : ''}`}
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}

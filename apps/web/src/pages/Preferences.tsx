import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import './Preferences.css';

interface Prefs {
  theme: string;
  font_size: string;
  font_style: string;
  icon_pack: string;
}

export default function Preferences() {
  const { setPreference } = useTheme();
  const [prefs, setPrefs] = useState<Prefs>({
    theme: 'system',
    font_size: 'medium',
    font_style: 'default',
    icon_pack: 'default',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ preferences: Prefs }>('/users/me/preferences')
      .then((data) => setPrefs(data.preferences || prefs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    if (prefs.theme === 'light' || prefs.theme === 'dark' || prefs.theme === 'system') {
      setPreference(prefs.theme);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="preferences-page">
      <h1>Preferences</h1>
      <form onSubmit={handleSave} className="preferences-form">
        <label>
          Theme
          <select
            value={prefs.theme}
            onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value }))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <label>
          Font size
          <select
            value={prefs.font_size}
            onChange={(e) => setPrefs((p) => ({ ...p, font_size: e.target.value }))}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label>
          Font style
          <input
            type="text"
            value={prefs.font_style}
            onChange={(e) => setPrefs((p) => ({ ...p, font_style: e.target.value }))}
            placeholder="default"
          />
        </label>
        <label>
          Icon pack
          <input
            type="text"
            value={prefs.icon_pack}
            onChange={(e) => setPrefs((p) => ({ ...p, icon_pack: e.target.value }))}
            placeholder="default"
          />
        </label>
        <button type="submit">{saved ? 'Saved!' : 'Save preferences'}</button>
      </form>
    </div>
  );
}

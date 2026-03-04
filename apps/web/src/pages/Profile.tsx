import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import './Profile.css';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState({ current: '', new: '' });
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: displayName || null }),
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    try {
      await apiFetch('/users/me/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: changePassword.current,
          newPassword: changePassword.new,
        }),
      });
      setChangePassword({ current: '', new: '' });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Change password failed');
    }
  };

  return (
    <div className="profile-page">
      <h1>Profile</h1>
      <section className="profile-section">
        <h2>Profile</h2>
        <form onSubmit={handleSaveProfile}>
          {error && <div className="form-error">{error}</div>}
          <label>
            Email (read-only)
            <input type="text" value={user?.email ?? ''} readOnly disabled />
          </label>
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <button type="submit">{saved ? 'Saved!' : 'Save'}</button>
        </form>
      </section>
      <section className="profile-section">
        <h2>Change password</h2>
        <form onSubmit={handleChangePassword}>
          {pwError && <div className="form-error">{pwError}</div>}
          <label>
            Current password
            <input
              type="password"
              value={changePassword.current}
              onChange={(e) =>
                setChangePassword((p) => ({ ...p, current: e.target.value }))
              }
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={changePassword.new}
              onChange={(e) =>
                setChangePassword((p) => ({ ...p, new: e.target.value }))
              }
              required
              minLength={8}
            />
          </label>
          <button type="submit">{pwSaved ? 'Password updated!' : 'Change password'}</button>
        </form>
      </section>
    </div>
  );
}

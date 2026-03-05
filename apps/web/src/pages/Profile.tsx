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
      <p className="profile-intro">Manage your account details and security.</p>

      <section className="profile-section" aria-labelledby="profile-details-heading">
        <h2 id="profile-details-heading">Profile details</h2>
        <form onSubmit={handleSaveProfile}>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="profile-field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="text"
              value={user?.email ?? ''}
              readOnly
              disabled
              aria-describedby="profile-email-hint"
            />
            <span id="profile-email-hint" className="profile-hint">Email cannot be changed.</span>
          </div>
          <div className="profile-field">
            <label htmlFor="profile-display-name">Display name</label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div className="profile-actions">
            <button
              type="submit"
              className={saved ? 'saved' : ''}
            >
              {saved ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="profile-password-heading">
        <h2 id="profile-password-heading">Change password</h2>
        <form onSubmit={handleChangePassword}>
          {pwError && <div className="form-error" role="alert">{pwError}</div>}
          <div className="profile-field">
            <label htmlFor="profile-current-password">Current password</label>
            <input
              id="profile-current-password"
              type="password"
              value={changePassword.current}
              onChange={(e) =>
                setChangePassword((p) => ({ ...p, current: e.target.value }))
              }
              required
              autoComplete="current-password"
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-new-password">New password</label>
            <input
              id="profile-new-password"
              type="password"
              value={changePassword.new}
              onChange={(e) =>
                setChangePassword((p) => ({ ...p, new: e.target.value }))
              }
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="profile-actions">
            <button
              type="submit"
              className={pwSaved ? 'saved' : ''}
            >
              {pwSaved ? 'Password updated!' : 'Change password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

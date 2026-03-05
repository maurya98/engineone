import { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginScene } from '../components/LoginScene';
import { COMPANY_NAME } from '../config';
import './Login.css';

export default function Login() {
  const { user, login, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionExpired) {
      setError('Your session has expired. Please sign in again.');
      clearSessionExpired();
    }
  }, [sessionExpired, clearSessionExpired]);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-scene-wrap">
        <LoginScene />
      </div>
      <aside className="login-panel">
        <div className="login-content">
          <div className="login-card">
            <div className="login-brand">
              <h1 className="login-logo">{COMPANY_NAME}</h1>
              <p className="login-tagline">Development platform for modern teams</p>
            </div>
            <div className="login-card-inner">
              <h2 className="login-heading">Sign in to your account</h2>
              <form onSubmit={handleSubmit} className="login-form">
                {error && (
                  <div className="login-error" role="alert">
                    {error}
                  </div>
                )}
                <label>
                  <span className="login-label-text">Email address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </label>
                <label>
                  <span className="login-label-text">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </label>
                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? (
                    <span className="login-submit-text">
                      <span className="login-spinner" aria-hidden="true" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
              <p className="login-register">
                Don’t have an account?{' '}
                <Link to="/register">Create an account</Link>
              </p>
            </div>
          </div>
          <p className="login-footer">
            By signing in, you agree to use {COMPANY_NAME} in accordance with your organization’s policies.
          </p>
        </div>
      </aside>
    </div>
  );
}

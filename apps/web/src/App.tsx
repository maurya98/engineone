import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Preferences from './pages/Preferences';
import RepoPage from './pages/RepoPage';
import { useAuth } from './context/AuthContext';
import { ThemeProvider, ThemeProviderWithPrefs } from './context/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <ThemeProviderWithPrefs>
      {children}
    </ThemeProviderWithPrefs>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="workspaces/:workspaceId" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="preferences" element={<Preferences />} />
        <Route path="workspaces/:workspaceId/repos/:repoId/*" element={<RepoPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

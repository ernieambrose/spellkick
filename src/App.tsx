import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import type { AuthClient } from './app/authClient';
import { useAuth } from './app/authContext';
import { ProfileProvider } from './app/ProfileProvider';
import { useActiveProfile } from './app/profileContext';
import { RepoProvider } from './app/RepoProvider';
import type { Repo } from './data/repo';
import { KidPlaceholder } from './screens/Kid/KidPlaceholder';
import { ParentPlaceholder } from './screens/Parent/ParentPlaceholder';
import { Profiles } from './screens/Profiles/Profiles';
import { SignIn } from './screens/SignIn/SignIn';

function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Navigate to="/signin" replace />;
  return <Outlet />;
}

function Home() {
  const { activeId } = useActiveProfile();
  return <Navigate to={activeId ? `/kid/${activeId}` : '/profiles'} replace />;
}

interface AppProps {
  repo?: Repo; // tests inject these; defaults are Supabase, or demo mode without env vars
  authClient?: AuthClient | null;
}

export default function App({ repo, authClient }: AppProps) {
  return (
    <RepoProvider repo={repo}>
      <AuthProvider client={authClient}>
        <ProfileProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route element={<RequireAuth />}>
                <Route index element={<Home />} />
                <Route path="/profiles" element={<Profiles />} />
                <Route path="/kid/:id/*" element={<KidPlaceholder />} />
                <Route path="/parent" element={<ParentPlaceholder />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ProfileProvider>
      </AuthProvider>
    </RepoProvider>
  );
}

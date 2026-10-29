import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import type { AuthClient } from './app/authClient';
import { useAuth } from './app/authContext';
import { ProfileProvider } from './app/ProfileProvider';
import { useActiveProfile } from './app/profileContext';
import { RepoProvider } from './app/RepoProvider';
import type { Repo } from './data/repo';
import { Awards } from './screens/Awards/Awards';
import { KidHome } from './screens/KidHome/KidHome';
import { KidRoute } from './screens/KidHome/KidRoute';
import { ListEditor } from './screens/Parent/ListEditor';
import { ParentGate } from './screens/Parent/ParentGate';
import { ParentHome } from './screens/Parent/ParentHome';
import { ProfileEditor } from './screens/Parent/ProfileEditor';
import { ProgressView } from './screens/Parent/ProgressView';
import { Profiles } from './screens/Profiles/Profiles';
import { SessionShell } from './screens/Session/SessionShell';
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
                <Route path="/kid/:id" element={<KidRoute />}>
                  <Route index element={<KidHome />} />
                  <Route path="play/:game" element={<SessionShell />} />
                  <Route path="awards" element={<Awards />} />
                </Route>
                <Route path="/parent" element={<ParentGate />}>
                  <Route index element={<ParentHome />} />
                  <Route path="profile/:id" element={<ProfileEditor />} />
                  <Route path="list/:id" element={<ListEditor />} />
                  <Route path="progress/:profileId" element={<ProgressView />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ProfileProvider>
      </AuthProvider>
    </RepoProvider>
  );
}

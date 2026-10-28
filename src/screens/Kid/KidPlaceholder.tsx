import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useActiveProfile } from '../../app/profileContext';

// Placeholder kid home; Task 12 replaces it. Only the active (PIN-checked) profile may open it.
export function KidPlaceholder() {
  const { id } = useParams();
  const { activeId, profile, clear } = useActiveProfile();
  const navigate = useNavigate();

  if (!id || id !== activeId) return <Navigate to="/profiles" replace />;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-8 px-4">
      {profile && <h1 className="text-4xl font-bold text-primary">Hi, {profile.name}!</h1>}
      <button
        type="button"
        onClick={() => {
          clear();
          navigate('/profiles');
        }}
        className="min-h-11 rounded-full border border-slate-300 px-6 font-semibold text-slate-600 hover:bg-white"
      >
        Switch kid
      </button>
    </main>
  );
}

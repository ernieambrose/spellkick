import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useActiveProfile } from '../../app/profileContext';

// Only the active (PIN-checked) profile may open its kid screens.
export function KidRoute() {
  const { id } = useParams();
  const { activeId } = useActiveProfile();
  if (!id || id !== activeId) return <Navigate to="/profiles" replace />;
  return <Outlet />;
}

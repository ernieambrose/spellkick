import { useOutletContext } from 'react-router-dom';

// What ParentGate hands its child routes once unlocked.
export interface ParentArea {
  changePin(): void; // back to the set-a-new-PIN step from inside the parent area
}

export const useParentArea = () => useOutletContext<ParentArea>();

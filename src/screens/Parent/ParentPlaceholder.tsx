import { Link } from 'react-router-dom';

// Placeholder parent area; Task 11 replaces it.
export function ParentPlaceholder() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold text-primary">Parent</h1>
      <p className="text-slate-600">Coming soon.</p>
      <Link
        to="/profiles"
        className="flex min-h-11 items-center rounded-full border border-slate-300 px-6 font-semibold text-slate-600"
      >
        Back to kids
      </Link>
    </main>
  );
}

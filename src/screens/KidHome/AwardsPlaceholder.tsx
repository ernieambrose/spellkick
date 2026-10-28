import { Link, useParams } from 'react-router-dom';

// Task 15 builds the awards shelf.
export function AwardsPlaceholder() {
  const { id } = useParams();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold text-primary">Awards</h1>
      <p className="text-slate-500">Coming soon.</p>
      <Link to={`/kid/${id}`} className="flex min-h-11 items-center rounded-full border border-slate-300 px-6 font-semibold text-slate-600">
        Home
      </Link>
    </main>
  );
}

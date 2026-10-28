import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Shared bits for the parent screens.

export const fieldClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-800 focus:border-primary focus:outline-none';
export const labelClass = 'mb-1 block font-semibold text-slate-700';
export const primaryButton =
  'min-h-11 rounded-full bg-primary px-6 font-semibold text-white transition active:scale-95 disabled:opacity-40';
export const secondaryButton =
  'flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-5 font-semibold text-slate-600 hover:bg-white';

export function ParentPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link to="/parent" className={secondaryButton} aria-label="Back to parent home">
          ←
        </Link>
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
      </div>
      {children}
    </main>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">{children}</section>;
}

// An inline "Are you sure?" step in place of window.confirm.
export function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm(): void | Promise<void> }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="min-h-11 rounded-full px-5 font-semibold text-tricky-text hover:bg-tricky-bg"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-tricky-bg p-3">
      <span className="font-semibold text-tricky-text">Are you sure? This can't be undone.</span>
      <button
        type="button"
        onClick={() => void onConfirm()}
        className="min-h-11 rounded-full bg-tricky-text px-5 font-semibold text-white"
      >
        Yes, delete
      </button>
      <button type="button" onClick={() => setAsking(false)} className={secondaryButton}>
        Keep it
      </button>
    </div>
  );
}

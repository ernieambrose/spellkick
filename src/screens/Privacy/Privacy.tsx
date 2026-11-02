import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const CONTACT_EMAIL = 'hello@spellkick.app';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-2 text-lg font-bold text-slate-800">{title}</h2>
      <div className="flex flex-col gap-2 text-slate-700">{children}</div>
    </section>
  );
}

// Plain-language privacy note, readable signed in or out.
export function Privacy() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline">
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Back to SpellKick"
          className="flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-5 font-semibold text-slate-600 hover:bg-white"
        >
          ←
        </Link>
        <h1 className="text-2xl font-bold text-primary">Privacy</h1>
      </div>
      <p className="text-lg text-slate-700">
        SpellKick is a small spelling app built by one parent for their own kids. Here is
        exactly what it keeps and why.
      </p>

      <Section title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>The grown-up's email address, so you can sign in with a code.</li>
          <li>Each kid's name (a first name or nickname is plenty), grade, theme, and timer setting.</li>
          <li>The word lists you enter, with their names and test dates.</li>
          <li>Practice results: which words were tried, right or wrong, hints used, points, streaks, and badges.</li>
          <li>PINs are stored scrambled (hashed), never as the actual digits.</li>
        </ul>
        <p>Kids never type an email, password, or anything about themselves. The grown-up owns the account.</p>
      </Section>

      <Section title="What we don't do">
        <ul className="list-disc space-y-1 pl-5">
          <li>No ads, no tracking, no analytics.</li>
          <li>We never sell or share your information.</li>
          <li>No one outside your family can see your kids or their progress.</li>
        </ul>
      </Section>

      <Section title="Where it lives">
        <p>
          Your data is stored with Supabase in the United States, and each family can only reach its own rows. The
          app is hosted on Vercel, and sign-in codes are emailed through Resend.
        </p>
        <p>
          This device also remembers a few small things so the app works offline: who's signed in, which kid was
          picked, tap or type in Scramble, and practice waiting to sync.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>Email {mail} and we'll delete your family's account and everything in it.</p>
      </Section>

      <Section title="Questions">
        <p>Write to {mail}. A real person reads it.</p>
      </Section>
    </main>
  );
}

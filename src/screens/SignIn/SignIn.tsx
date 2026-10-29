import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import type { AuthError } from '../../app/authClient';
import { useAuth } from '../../app/authContext';

// With shouldCreateUser: false, Supabase rejects emails it doesn't know with otp_disabled.
function sendErrorMessage(error: AuthError): string {
  if (error.code === 'otp_disabled' || /signups not allowed/i.test(error.message)) {
    return "This email isn't set up for SpellKick.";
  }
  return "Couldn't send a code. Check your connection and try again.";
}

const inputClass =
  'mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-lg focus:border-primary focus:outline-none';
const buttonClass =
  'min-h-11 w-full rounded-xl bg-primary px-4 text-lg font-semibold text-white disabled:opacity-50';

export function SignIn() {
  const { status, sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedIn') return <Navigate to="/" replace />;

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendCode(email.trim());
    setBusy(false);
    if (error) setError(sendErrorMessage(error));
    else setStep('code');
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await verifyCode(email.trim(), code);
    setBusy(false);
    if (error) setError("That code didn't work. Check it and try again.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="text-center text-4xl font-bold text-primary">SpellKick</h1>
      <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
        {step === 'email' ? (
          <form onSubmit={onSend} className="space-y-4">
            <p className="text-slate-600">Grown-ups: enter your email and we'll send you a code.</p>
            <label className="block font-semibold text-slate-700">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <button type="submit" disabled={busy || !email.trim()} className={buttonClass}>
              Send code
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="space-y-4">
            <p className="text-slate-600">We sent a code to {email.trim()}.</p>
            <label className="block font-semibold text-slate-700">
              Code from the email
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputClass} tracking-[0.5em]`}
              />
            </label>
            <button type="submit" disabled={busy || code.length < 6} className={buttonClass}>
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="min-h-11 w-full rounded-xl font-semibold text-slate-500 hover:bg-slate-100"
            >
              Use a different email
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-4 text-center font-semibold text-tricky-text">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

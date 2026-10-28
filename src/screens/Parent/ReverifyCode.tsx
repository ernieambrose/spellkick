import { useState, type FormEvent } from 'react';
import { useAuth } from '../../app/authContext';
import { fieldClass, labelClass, primaryButton } from './ui';

interface Props {
  email: string; // the signed-in parent's email; codes only go there
  onVerified(): void;
  onCancel(): void;
}

// "Forgot PIN?": proves it's the parent by emailing a 6-digit code (same flow as sign-in).
export function ReverifyCode({ email, onVerified, onCancel }: Props) {
  const { sendCode, verifyCode } = useAuth();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) setError("Couldn't send a code. Check your connection and try again.");
    else setSent(true);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await verifyCode(email, code);
    setBusy(false);
    if (error) setError("That code didn't work. Check it and try again.");
    else onVerified();
  }

  return (
    <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl">
      <h2 className="text-center text-xl font-bold text-slate-800">Forgot PIN?</h2>
      {!sent ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-slate-600">We'll email a code to {email} so you can set a new PIN.</p>
          <button type="button" disabled={busy} onClick={() => void send()} className={primaryButton}>
            Email me a code
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void verify(e)} className="mt-4 flex flex-col gap-4">
          <p className="text-slate-600">We sent a code to {email}.</p>
          <div>
            <label htmlFor="reverify-code" className={labelClass}>
              6-digit code
            </label>
            <input
              id="reverify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${fieldClass} tracking-[0.5em]`}
            />
          </div>
          <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
            Verify
          </button>
        </form>
      )}
      <p role="alert" className="mt-3 min-h-6 text-center font-semibold text-tricky-text">
        {error}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 min-h-11 w-full rounded-xl font-semibold text-slate-500 hover:bg-slate-100"
      >
        Cancel
      </button>
    </div>
  );
}

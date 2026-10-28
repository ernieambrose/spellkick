import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/authContext';
import { useRepo } from '../../app/repoContext';
import { PinPad } from '../../components/PinPad';
import { hashPin } from '../../engine/pin';

type Step = { kind: 'loading' } | { kind: 'failed' } | { kind: 'check'; hash: string } | { kind: 'set' } | { kind: 'confirm'; pin: string };

// Layout route over /parent/*. The unlocked flag lives only in this component, so the PIN is
// asked again every time the parent area is opened (leaving it unmounts the gate).
export function ParentGate() {
  const repo = useRepo();
  const { getUserId } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [unlocked, setUnlocked] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    let live = true;
    repo.getParentPinHash().then(
      (hash) => live && setStep(hash ? { kind: 'check', hash } : { kind: 'set' }),
      () => live && setStep({ kind: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [repo]);

  // Salt = the signed-in owner's id; demo mode has none, so it uses 'parent'.
  const hash = async (pin: string) => hashPin(pin, (await getUserId()) ?? 'parent');

  if (unlocked) return <Outlet />;

  const leave = () => navigate('/profiles');
  let pad = null;
  if (step.kind === 'check') {
    pad = (
      <PinPad
        title="Parent PIN"
        lockKey="parent"
        onSubmit={async (pin) => {
          const ok = (await hash(pin)) === step.hash;
          if (ok) setUnlocked(true);
          return ok;
        }}
        onCancel={leave}
      />
    );
  } else if (step.kind === 'set') {
    pad = (
      <PinPad
        key="set"
        title="Set a parent PIN"
        lockKey="parent-set"
        onSubmit={(pin) => {
          setMismatch(false);
          setStep({ kind: 'confirm', pin });
          return true;
        }}
        onCancel={leave}
      />
    );
  } else if (step.kind === 'confirm') {
    pad = (
      <PinPad
        key="confirm"
        title="Enter it again"
        lockKey="parent-set"
        onSubmit={async (pin) => {
          if (pin !== step.pin) {
            setMismatch(true);
            setStep({ kind: 'set' });
            return true; // not a wrong guess; start over without counting toward the cooldown
          }
          await repo.setParentPinHash(await hash(pin));
          setUnlocked(true);
          return true;
        }}
        onCancel={leave}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      {step.kind === 'failed' && (
        <p className="text-center text-tricky-text">Couldn't load the parent settings. Check your connection.</p>
      )}
      {step.kind === 'set' && (
        <p className="max-w-xs text-center text-slate-600">
          {mismatch ? "Those didn't match. Let's try again." : 'Pick 4 digits the kids don’t know.'}
        </p>
      )}
      {pad}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/authContext';
import { useRepo } from '../../app/repoContext';
import { PinPad } from '../../components/PinPad';
import { hashPin } from '../../engine/pin';
import type { ParentArea } from './parentArea';
import { ReverifyCode } from './ReverifyCode';

type Step =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'check'; hash: string }
  | { kind: 'forgot'; email: string }
  | { kind: 'set' }
  | { kind: 'confirm'; pin: string };


// Layout route over /parent/*. The unlocked flag lives only in this component, so the PIN is
// asked again every time the parent area is opened (leaving it unmounts the gate).
export function ParentGate() {
  const repo = useRepo();
  const { getUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [unlocked, setUnlocked] = useState(false);
  const [changing, setChanging] = useState(false); // set step opened from inside; Cancel returns there
  const [mismatch, setMismatch] = useState(false);
  const [notice, setNotice] = useState('');

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
  const hash = async (pin: string) => hashPin(pin, (await getUser())?.id ?? 'parent');

  function startSet(fromInside: boolean) {
    setMismatch(false);
    setNotice('');
    setChanging(fromInside);
    setStep({ kind: 'set' });
  }

  async function forgot() {
    setNotice('');
    const user = await getUser().catch(() => undefined);
    if (user === null) return startSet(false); // demo mode: no email to verify against
    if (!user?.email) return setNotice("Couldn't find your email. Check your connection and try again.");
    setStep({ kind: 'forgot', email: user.email });
  }

  const area: ParentArea = {
    changePin() {
      setUnlocked(false);
      startSet(true);
    },
  };
  if (unlocked) return <Outlet context={area} />;

  const leave = () => (changing ? setUnlocked(true) : navigate('/profiles'));
  let pad = null;
  if (step.kind === 'check') {
    const checkHash = step.hash;
    pad = (
      <>
        <PinPad
          title="Parent PIN"
          lockKey="parent"
          onSubmit={async (pin) => {
            const ok = (await hash(pin)) === checkHash;
            if (ok) setUnlocked(true);
            return ok;
          }}
          onCancel={leave}
        />
        <button
          type="button"
          onClick={() => void forgot()}
          className="min-h-11 rounded-full px-5 font-semibold text-primary hover:bg-white"
        >
          Forgot PIN?
        </button>
      </>
    );
  } else if (step.kind === 'forgot') {
    pad = <ReverifyCode email={step.email} onVerified={() => startSet(false)} onCancel={leave} />;
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
    const first = step.pin;
    pad = (
      <PinPad
        key="confirm"
        title="Enter it again"
        lockKey="parent-set"
        onSubmit={async (pin) => {
          if (pin !== first) {
            setMismatch(true);
            setStep({ kind: 'set' });
            return true; // not a wrong guess; start over without counting toward the cooldown
          }
          const h = await hash(pin);
          await repo.setParentPinHash(h);
          setStep({ kind: 'check', hash: h });
          setChanging(false);
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
      {notice && (
        <p role="alert" className="max-w-xs text-center font-semibold text-tricky-text">
          {notice}
        </p>
      )}
      {pad}
    </main>
  );
}

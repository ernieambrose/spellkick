import { act, fireEvent, render, screen } from '@testing-library/react';
import { PinPad } from '../../src/components/PinPad';

async function enter(pin: string) {
  for (const d of pin) fireEvent.click(screen.getByRole('button', { name: d }));
  await act(async () => {}); // let the submit promise settle
}

afterEach(() => vi.useRealTimers());

describe('PinPad', () => {
  it('auto-submits at 4 digits, and backspace removes a digit', async () => {
    const onSubmit = vi.fn(() => true);
    render(<PinPad title="PIN" onSubmit={onSubmit} onCancel={() => {}} lockKey="kid-0" />);
    for (const d of '125') fireEvent.click(screen.getByRole('button', { name: d }));
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await enter('34');
    expect(onSubmit).toHaveBeenCalledWith('1234');
  });

  it('locks for 30 seconds after 3 wrong tries, with a visible countdown', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(() => false);
    render(<PinPad title="PIN" onSubmit={onSubmit} onCancel={() => {}} lockKey="kid-1" />);
    await enter('0000');
    await enter('0000');
    await enter('0000');
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/Wait 30s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(/Wait 20s/)).toBeInTheDocument();
    await enter('1111');
    expect(onSubmit).toHaveBeenCalledTimes(3);

    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByText(/Wait/)).not.toBeInTheDocument();
    await enter('2222');
    expect(onSubmit).toHaveBeenCalledTimes(4);
  });

  it('keeps the lock when the pad is closed and reopened', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(() => false);
    const { unmount } = render(<PinPad title="PIN" onSubmit={onSubmit} onCancel={() => {}} lockKey="kid-2" />);
    for (let i = 0; i < 3; i++) await enter('0000');
    unmount();
    render(<PinPad title="PIN" onSubmit={onSubmit} onCancel={() => {}} lockKey="kid-2" />);
    expect(screen.getByText(/Wait 30s/)).toBeInTheDocument();
  });
});

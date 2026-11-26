import { describe, expect, it, vi } from 'vitest';
import { settleWithin } from './settle';

describe('settleWithin', () => {
  it('resolves ready when the work finishes in time', async () => {
    await expect(settleWithin(() => Promise.resolve(1), 1000)).resolves.toBe('ready');
  });

  it('resolves timeout when the work never finishes', async () => {
    vi.useFakeTimers();
    try {
      const p = settleWithin(() => new Promise(() => {}), 500);
      vi.advanceTimersByTime(500);
      await expect(p).resolves.toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves failed, never rejects, when the work rejects or throws', async () => {
    await expect(settleWithin(() => Promise.reject(new Error('lost')), 1000)).resolves.toBe(
      'failed',
    );
    await expect(
      settleWithin(() => {
        throw new Error('no context');
      }, 1000),
    ).resolves.toBe('failed');
  });

  it('keeps the first outcome: late work after a timeout changes nothing', async () => {
    vi.useFakeTimers();
    try {
      let finish = () => {};
      const p = settleWithin(() => new Promise<void>((r) => (finish = r)), 100);
      vi.advanceTimersByTime(100);
      finish();
      await expect(p).resolves.toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });
});

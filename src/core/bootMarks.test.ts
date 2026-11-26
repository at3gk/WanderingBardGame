import { describe, expect, it } from 'vitest';
import { bootMark, bootSpans } from './bootMarks';

describe('boot marks', () => {
  it('reads boot marks back in order with the gap from the previous one', () => {
    const spans = bootSpans([
      { name: 'boot:road', startTime: 300 },
      { name: 'other', startTime: 50 },
      { name: 'boot:main', startTime: 100 },
      { name: 'boot:world-build', startTime: 900 },
    ]);
    expect(spans).toEqual([
      { name: 'main', at: 100, took: 100 },
      { name: 'road', at: 300, took: 200 },
      { name: 'world-build', at: 900, took: 600 },
    ]);
  });

  it('never throws, even where performance.mark is missing or broken', () => {
    const original = globalThis.performance.mark;
    try {
      (globalThis.performance as { mark: unknown }).mark = () => {
        throw new Error('no');
      };
      expect(() => bootMark('x')).not.toThrow();
      (globalThis.performance as { mark: unknown }).mark = undefined;
      expect(() => bootMark('x')).not.toThrow();
    } finally {
      globalThis.performance.mark = original;
    }
  });
});

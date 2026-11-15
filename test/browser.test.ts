// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, deprecate, resetDeprecations } from '../src/index';

describe('browser environment (no process)', () => {
  const realProcess = globalThis.process;

  beforeEach(() => {
    resetDeprecations();
    configure({ mode: undefined, logger: undefined, onDeprecation: undefined, once: undefined });
    vi.stubGlobal('process', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.process = realProcess;
  });

  it('falls back to console.warn with the call site', () => {
    expect(typeof window).toBe('object');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    deprecate(() => 1, { name: 'old' })();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^DeprecationWarning: old is deprecated\.\n {4}at .*browser\.test\.ts/);
  });
});

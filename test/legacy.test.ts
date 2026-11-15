import { beforeEach, describe, expect, it } from 'vitest';
import deprecated from '../src/index';
import { setup } from './helpers';

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('v0.x default export (compatibility)', () => {
  it('wraps functions and warns on call with the v0 config shape', () => {
    expect.assertions(4);
    const metrics: unknown[] = [];
    const fn = deprecated((a: number) => a * 2, {
      message: 'This function will be removed',
      sendMetrics: (event) => metrics.push(event),
    });
    expect(ctx.logger.warn).not.toHaveBeenCalled();
    expect(fn(2)).toBe(4);
    expect(ctx.logger.warn).toHaveBeenCalledWith('This function will be removed');
    expect(metrics).toHaveLength(1);
  });

  it('wraps object methods', async () => {
    const api = deprecated({ getUsers: () => Promise.resolve([1]) }, { method: 'getUsers' });
    await expect(api.getUsers()).resolves.toEqual([1]);
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('keeps the v0 error messages', () => {
    expect(() => deprecated(undefined as never)).toThrow('The param obj is required');
    expect(() => deprecated({}, { method: 'getUsers' })).toThrow('The object not have the method defined');
    expect(() => deprecated({})).toThrow('The object not have the method defined');
  });
});

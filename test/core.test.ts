import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configure,
  deprecate,
  deprecateMethod,
  deprecateProperty,
  DeprecationError,
  resetDeprecations,
} from '../src/index';
import { setup } from './helpers';

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('deprecate()', () => {
  it('does not warn when wrapping, only when calling', () => {
    const wrapped = deprecate(function sum(a: number, b: number) {
      return a + b;
    });
    expect(ctx.logger.warn).not.toHaveBeenCalled();

    expect(wrapped(1, 2)).toBe(3);
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
    expect(ctx.logger.warn).toHaveBeenCalledWith('sum is deprecated.');
  });

  it('keeps this, name, length and static members', () => {
    function greet(this: { who: string }, greeting: string) {
      return `${greeting} ${this.who}`;
    }
    greet.version = 2;
    const wrapped = deprecate(greet);

    expect(wrapped.name).toBe('greet');
    expect(wrapped.length).toBe(1);
    expect(wrapped.version).toBe(2);
    expect(wrapped.call({ who: 'Ana' }, 'hi')).toBe('hi Ana');
  });

  it('supports classes, new and instanceof', () => {
    class User {
      constructor(public name: string) {}
    }
    const LegacyUser = deprecate(User, { replacement: 'Account' });
    const user = new LegacyUser('Ana');

    expect(user).toBeInstanceOf(User);
    expect(user).toBeInstanceOf(LegacyUser);
    expect(user.name).toBe('Ana');
    expect(ctx.logger.warn).toHaveBeenCalledWith('User is deprecated. Use Account instead.');
  });

  it('builds the message from metadata', () => {
    const fn = deprecate(() => 1, {
      name: 'getUsers()',
      since: '1.2.0',
      removeIn: '2.0.0',
      replacement: 'getUsersV2()',
      url: 'https://example.com/migrate',
    });
    fn();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'getUsers() is deprecated since 1.2.0 and will be removed in 2.0.0. Use getUsersV2() instead. See https://example.com/migrate',
    );
  });

  it('uses the custom message as is', () => {
    deprecate(() => 1, { message: 'Bye bye' })();
    expect(ctx.logger.warn).toHaveBeenCalledWith('Bye bye');
  });

  it('flags overdue removal dates and logs them as errors', () => {
    const fn = deprecate(() => 1, { name: 'old', removeIn: '2000-01-01' });
    fn();
    expect(ctx.logger.error).toHaveBeenCalledWith(
      '[OVERDUE] old is deprecated and was scheduled for removal on 2000-01-01.',
    );
    expect(ctx.events[0].overdue).toBe(true);
  });

  it('accepts Date objects and future dates', () => {
    const future = new Date(Date.now() + 86_400_000 * 365);
    deprecate(() => 1, { name: 'soon', removeIn: future })();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      `soon is deprecated and will be removed on ${future.toISOString().slice(0, 10)}.`,
    );
    expect(ctx.events[0].overdue).toBe(false);
  });

  it('ignores invalid dates', () => {
    deprecate(() => 1, { name: 'x', removeIn: new Date('nope') })();
    expect(ctx.logger.warn).toHaveBeenCalledWith('x is deprecated.');
  });

  it('warns once per call site by default', () => {
    const fn = deprecate(function legacy() {});
    for (let i = 0; i < 5; i += 1) fn(); // same call site
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1);

    fn(); // a different call site
    expect(ctx.logger.warn).toHaveBeenCalledTimes(2);
  });

  it('warns on every call when once is false', () => {
    const fn = deprecate(function legacy() {}, { once: false });
    for (let i = 0; i < 3; i += 1) fn();
    expect(ctx.logger.warn).toHaveBeenCalledTimes(3);
  });

  it('honors the global once setting', () => {
    configure({ once: false });
    const fn = deprecate(function legacy() {});
    for (let i = 0; i < 3; i += 1) fn();
    expect(ctx.logger.warn).toHaveBeenCalledTimes(3);
  });

  it('resetDeprecations() lets warnings show again', () => {
    const fn = deprecate(function legacy() {});
    const call = () => fn();
    call();
    resetDeprecations();
    call();
    expect(ctx.logger.warn).toHaveBeenCalledTimes(2);
  });

  it('reports the caller as call site', () => {
    deprecate(function legacy() {})();
    expect(ctx.events[0].callSite).toContain('core.test.ts');
    expect(ctx.events[0].stack).toContain('core.test.ts');
  });

  it('finds the call site without Error.captureStackTrace (non V8 engines)', () => {
    const E = Error as any;
    const original = E.captureStackTrace;
    E.captureStackTrace = undefined;
    try {
      deprecate(function legacy() {})();
    } finally {
      E.captureStackTrace = original;
    }
    expect(ctx.events[0].callSite).toContain('core.test.ts');
  });

  it('still reports when stacks are disabled', () => {
    const E = Error as any;
    const original = E.captureStackTrace;
    E.captureStackTrace = () => {
      throw new Error('blocked');
    };
    try {
      deprecate(function legacy() {})();
    } finally {
      E.captureStackTrace = original;
    }
    expect(ctx.events[0].callSite).toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalledWith('legacy is deprecated.');
  });

  it('sends a structured event to every hook', () => {
    const onDeprecation = vi.fn();
    const sendMetrics = vi.fn();
    deprecate(() => 1, { name: 'old', code: 'DEP001', since: '1.0.0', onDeprecation, sendMetrics })();

    const expected = expect.objectContaining({
      name: 'old',
      code: 'DEP001',
      since: '1.0.0',
      mode: 'warn',
      overdue: false,
      message: 'old is deprecated since 1.0.0.',
    });
    expect(ctx.events[0]).toEqual(expected);
    expect(onDeprecation).toHaveBeenCalledWith(expected);
    expect(sendMetrics).toHaveBeenCalledWith(expected);
  });

  it('never lets a failing hook break the caller', () => {
    const fn = deprecate(() => 42, {
      onDeprecation: () => {
        throw new Error('metrics down');
      },
    });
    expect(fn()).toBe(42);
  });

  it('rejects non functions', () => {
    expect(() => deprecate({} as never)).toThrow(TypeError);
  });

  it('falls back to a generic name for anonymous functions', () => {
    deprecate(Object.defineProperty(() => 1, 'name', { value: '' }))();
    expect(ctx.logger.warn).toHaveBeenCalledWith('anonymous function is deprecated.');
  });
});

describe('modes', () => {
  it('throw mode throws a DeprecationError on every call, after reporting', () => {
    expect.assertions(5);
    configure({ mode: 'throw' });
    const fn = deprecate(function legacy() {}, { code: 'DEP002' });
    for (let i = 0; i < 2; i += 1) {
      try {
        fn();
      } catch (error) {
        expect(error).toBeInstanceOf(DeprecationError);
        expect((error as DeprecationError).code).toBe('DEP002');
      }
    }
    expect(ctx.events).toHaveLength(2);
  });

  it('silent mode prints nothing but still reports telemetry', () => {
    configure({ mode: 'silent' });
    deprecate(() => 1)();
    expect(ctx.logger.warn).not.toHaveBeenCalled();
    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0].mode).toBe('silent');
  });

  describe('from the environment', () => {
    afterEach(() => {
      delete process.env.IS_DEPRECATED_MODE;
      process.noDeprecation = false;
      process.throwDeprecation = false;
    });

    it('reads IS_DEPRECATED_MODE', () => {
      configure({ mode: undefined });
      process.env.IS_DEPRECATED_MODE = ' Silent ';
      deprecate(() => 1)();
      expect(ctx.events[0].mode).toBe('silent');
    });

    it('ignores unknown IS_DEPRECATED_MODE values', () => {
      configure({ mode: undefined });
      process.env.IS_DEPRECATED_MODE = 'loud';
      deprecate(() => 1)();
      expect(ctx.events[0].mode).toBe('warn');
    });

    it('maps --no-deprecation to silent and --throw-deprecation to throw', () => {
      configure({ mode: undefined });
      process.noDeprecation = true;
      deprecate(() => 1, { name: 'a' })();
      expect(ctx.events[0].mode).toBe('silent');

      process.noDeprecation = false;
      process.throwDeprecation = true;
      expect(() => deprecate(() => 1, { name: 'b' })()).toThrow(DeprecationError);
    });
  });
});

describe('default output', () => {
  it('uses process.emitWarning in Node with code and call site', () => {
    configure({ logger: undefined });
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecate(() => 1, { name: 'old', code: 'DEP003' })();
    expect(emitWarning).toHaveBeenCalledWith('old is deprecated.', {
      type: 'DeprecationWarning',
      code: 'DEP003',
      detail: expect.stringContaining('core.test.ts'),
    });
  });
});

describe('deprecateMethod()', () => {
  const makeApi = () => ({
    timeout: 5000,
    getUsers() {
      return Promise.resolve([{ id: 1 }]);
    },
    getUsersV2() {
      return 'v2';
    },
    getAll() {
      return this.getUsers();
    },
  });

  it('warns when the method is called, not when it is read', async () => {
    const api = deprecateMethod(makeApi(), 'getUsers', { replacement: 'getUsersV2()' });

    expect(typeof api.getUsers).toBe('function');
    const { getUsers } = api;
    void getUsers;
    void { ...api };
    expect(ctx.logger.warn).not.toHaveBeenCalled();

    await expect(api.getUsers()).resolves.toEqual([{ id: 1 }]);
    expect(ctx.logger.warn).toHaveBeenCalledWith('getUsers is deprecated. Use getUsersV2() instead.');
  });

  it('leaves other members untouched and keeps method identity', () => {
    const api = deprecateMethod(makeApi(), 'getUsers');
    expect(api.timeout).toBe(5000);
    expect(api.getUsersV2()).toBe('v2');
    expect(api.getUsers).toBe(api.getUsers);
    expect(api.getUsers.name).toBe('getUsers');
    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  it('supports several methods with their own names', () => {
    const api = deprecateMethod(makeApi(), ['getUsers', 'getUsersV2'], { name: 'ignored' });
    void api.getUsers();
    api.getUsersV2();
    expect(ctx.events.map((e) => e.name)).toEqual(['getUsers', 'getUsersV2']);
  });

  it('uses options.name for a single method', () => {
    void deprecateMethod(makeApi(), 'getUsers', { name: 'API.getUsers()' }).getUsers();
    expect(ctx.events[0].name).toBe('API.getUsers()');
  });

  it('does not report calls a deprecated method makes through this', () => {
    const api = deprecateMethod(makeApi(), ['getAll', 'getUsers'], { once: false });
    void api.getAll();
    expect(ctx.events.map((e) => e.name)).toEqual(['getAll']);
  });

  it('works with class instances that use private fields', () => {
    class Store {
      #items = ['a'];

      list() {
        return this.#items;
      }
    }
    const store = deprecateMethod(new Store(), 'list');
    expect(store.list()).toEqual(['a']);
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('validates its arguments', () => {
    expect(() => deprecateMethod(null as never, 'x' as never)).toThrow(TypeError);
    expect(() => deprecateMethod(makeApi(), [])).toThrow(TypeError);
    expect(() => deprecateMethod(makeApi(), 'timeout')).toThrow('"timeout" is not a method');
  });
});

describe('deprecateProperty()', () => {
  it('warns when reading or writing a data property', () => {
    const config = deprecateProperty({ retries: 3, other: 1 }, 'retries', { replacement: 'maxRetries' });
    expect(ctx.logger.warn).not.toHaveBeenCalled();
    expect(config.other).toBe(1);
    expect(ctx.logger.warn).not.toHaveBeenCalled();

    expect(config.retries).toBe(3);
    config.retries = 5;
    expect(config.retries).toBe(5);
    expect(ctx.events.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(config)).toEqual(['retries', 'other']);
  });

  it('keeps read-only properties read-only', () => {
    const obj = Object.defineProperty({} as { id: number }, 'id', {
      value: 1,
      writable: false,
      enumerable: true,
      configurable: true,
    });
    deprecateProperty(obj, 'id');
    expect(obj.id).toBe(1);
    expect(() => {
      'use strict';

      obj.id = 2;
    }).toThrow(TypeError);
  });

  it('wraps existing getters and setters', () => {
    let stored = 1;
    const obj = {
      get value() {
        return stored;
      },
      set value(next: number) {
        stored = next;
      },
    };
    deprecateProperty(obj, 'value', { once: false });
    obj.value = 7;
    expect(obj.value).toBe(7);
    expect(ctx.logger.warn).toHaveBeenCalledTimes(2);
  });

  it('validates its arguments', () => {
    expect(() => deprecateProperty(null as never, 'x' as never)).toThrow(TypeError);
    expect(() => deprecateProperty({} as { x?: number }, 'x')).toThrow('not an own property');
    expect(() => deprecateProperty(Object.freeze({ x: 1 }), 'x')).toThrow('not configurable');
  });
});

import { modeFromEnvironment, nodeEmitWarning } from './env';
import type {
  DeprecationEvent,
  DeprecationMode,
  DeprecationOptions,
  GlobalConfig,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;

interface State {
  config: GlobalConfig;
  seen: Set<string>;
}

// Shared through globalThis so the ESM and CJS builds (dual package) share config and dedupe.
const STATE_KEY = Symbol.for('@mtorre4580/is-deprecated');
const store = globalThis as { [STATE_KEY]?: State };
const state: State = store[STATE_KEY] ?? (store[STATE_KEY] = { config: {}, seen: new Set() });

/**
 * Set global behavior. Only the keys you pass are changed; pass `undefined` to reset a key.
 * Returns the resulting configuration.
 */
export function configure(config: GlobalConfig): Readonly<GlobalConfig> {
  Object.assign(state.config, config);
  return { ...state.config };
}

/** Forget which deprecations were already reported, so `once` warnings show again. */
export function resetDeprecations(): void {
  state.seen.clear();
}

/** Thrown in `throw` mode. */
export class DeprecationError extends Error {
  readonly code?: string;

  readonly event: DeprecationEvent;

  constructor(event: DeprecationEvent) {
    super(event.message);
    this.name = 'DeprecationError';
    this.code = event.code;
    this.event = event;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function parseRemoval(removeIn: string | Date | undefined): { label?: string; date?: Date } {
  if (removeIn instanceof Date) {
    return Number.isNaN(removeIn.getTime())
      ? {}
      : { label: removeIn.toISOString().slice(0, 10), date: removeIn };
  }
  if (typeof removeIn !== 'string' || removeIn === '') return {};
  if (ISO_DATE.test(removeIn)) {
    const date = new Date(removeIn);
    if (!Number.isNaN(date.getTime())) return { label: removeIn, date };
  }
  return { label: removeIn };
}

function buildMessage(
  options: DeprecationOptions,
  name: string,
  removal: { label?: string; date?: Date },
  overdue: boolean,
): string {
  let message = options.message;
  if (message === undefined) {
    message = `${name} is deprecated`;
    if (options.since) message += ` since ${options.since}`;
    if (removal.label) {
      if (overdue) message += ` and was scheduled for removal on ${removal.label}`;
      else message += ` and will be removed ${removal.date ? 'on' : 'in'} ${removal.label}`;
    }
    message += '.';
    if (options.replacement) message += ` Use ${options.replacement} instead.`;
    if (options.url) message += ` See ${options.url}`;
  }
  return overdue ? `[OVERDUE] ${message}` : message;
}

type StackLimitedError = ErrorConstructor & {
  captureStackTrace?: (target: object, boundary?: AnyFunction) => void;
  stackTraceLimit?: number;
};

/** Stack starting at the code that called the deprecated API (best effort). */
function captureCallSite(boundary: AnyFunction): { callSite?: string; stack?: string } {
  const E = Error as StackLimitedError;
  const holder: { stack?: string } = {};
  const previousLimit = E.stackTraceLimit;
  let skip = 0;
  try {
    // Formatting a full stack is costly; a few frames are enough to locate the caller.
    if (typeof previousLimit === 'number') E.stackTraceLimit = 10;
    if (typeof E.captureStackTrace === 'function') {
      E.captureStackTrace(holder, boundary);
    } else {
      holder.stack = new Error().stack;
      skip = 3; // captureCallSite, notify, wrapper
    }
    void holder.stack; // V8 formats the stack lazily: read it while the limit applies.
  } catch {
    return {};
  } finally {
    if (typeof previousLimit === 'number') E.stackTraceLimit = previousLimit;
  }
  if (typeof holder.stack !== 'string') return {};
  const frames = holder.stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !/^Error\b/.test(line))
    .slice(skip);
  if (frames.length === 0) return {};
  return {
    callSite: frames[0].replace(/^at\s+/, ''),
    stack: frames.join('\n'),
  };
}

function safeCall(hook: ((event: DeprecationEvent) => void) | undefined, event: DeprecationEvent) {
  if (typeof hook !== 'function') return;
  try {
    hook(event);
  } catch {
    // Telemetry must never break the caller.
  }
}

/**
 * Report a deprecated API usage.
 * @param boundary function whose frame (and everything above it) is hidden from the stack.
 */
export function notify(options: DeprecationOptions, fallbackName: string, boundary: AnyFunction): void {
  const { config } = state;
  const mode: DeprecationMode = config.mode ?? modeFromEnvironment();
  const name = options.name ?? fallbackName;
  const { callSite, stack } = captureCallSite(boundary);

  if (mode !== 'throw' && (options.once ?? config.once ?? true)) {
    const key = `${options.code ?? ''}|${name}|${callSite ?? ''}`;
    if (state.seen.has(key)) return;
    state.seen.add(key);
  }

  const removal = parseRemoval(options.removeIn);
  const overdue = removal.date !== undefined && removal.date.getTime() <= Date.now();
  const message = buildMessage(options, name, removal, overdue);

  const event: DeprecationEvent = {
    name,
    message,
    code: options.code,
    since: options.since,
    removeIn: removal.label,
    replacement: options.replacement,
    url: options.url,
    overdue,
    callSite,
    stack,
    mode,
  };

  safeCall(config.onDeprecation, event);
  safeCall(options.onDeprecation, event);
  safeCall(options.sendMetrics, event);

  if (mode === 'silent') return;
  if (mode === 'throw') throw new DeprecationError(event);

  const logger = options.logger ?? config.logger;
  if (logger) {
    if (overdue && typeof logger.error === 'function') logger.error(message);
    else logger.warn(message);
    return;
  }

  const emitWarning = nodeEmitWarning();
  if (emitWarning) {
    emitWarning(message, {
      type: 'DeprecationWarning',
      code: options.code,
      detail: callSite ? `Called from ${callSite}` : undefined,
    });
    return;
  }

  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`DeprecationWarning: ${message}${callSite ? `\n    at ${callSite}` : ''}`);
  }
}

function copyFunctionShape(target: AnyFunction, source: AnyFunction): void {
  for (const key of ['name', 'length'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor) Object.defineProperty(target, key, { ...descriptor, configurable: true });
  }
}

/**
 * Wrap a function or class so every call (or `new`) reports a deprecation.
 * The wrapper keeps `this`, `new`, `name`, `length`, `prototype` and static members.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deprecate<T extends AnyFunction | (abstract new (...args: any[]) => any)>(
  fn: T,
  options: DeprecationOptions = {},
): T {
  if (typeof fn !== 'function') {
    throw new TypeError('deprecate() expects a function or class as first argument');
  }
  const fallbackName = fn.name || 'anonymous function';
  const handler: ProxyHandler<T> = {
    apply(target, thisArg, args) {
      notify(options, fallbackName, handler.apply as AnyFunction);
      return Reflect.apply(target as AnyFunction, thisArg, args);
    },
    construct(target, args, newTarget) {
      notify(options, fallbackName, handler.construct as AnyFunction);
      return Reflect.construct(target as AnyFunction, args, newTarget);
    },
  };
  return new Proxy(fn, handler);
}

/**
 * Return a proxy of `obj` whose given methods report a deprecation when they are **called**
 * (reading the property, `typeof`, spreading or logging the object does not warn).
 * Deprecated methods run against the original object, so calls they make through `this`
 * are not reported again and private class fields keep working.
 */
export function deprecateMethod<T extends object>(
  obj: T,
  methods: keyof T | readonly (keyof T)[],
  options: DeprecationOptions = {},
): T {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('deprecateMethod() expects an object as first argument');
  }
  const keys: readonly PropertyKey[] = Array.isArray(methods) ? methods : [methods as PropertyKey];
  if (keys.length === 0) throw new TypeError('deprecateMethod() expects at least one method name');
  for (const key of keys) {
    if (typeof (obj as Record<PropertyKey, unknown>)[key] !== 'function') {
      throw new TypeError(`"${String(key)}" is not a method of the given object`);
    }
  }

  const cache = new Map<PropertyKey, { original: AnyFunction; wrapped: AnyFunction }>();
  const proxy: T = new Proxy(obj, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function' || !keys.includes(property)) return value;
      const original = value as AnyFunction;
      const cached = cache.get(property);
      if (cached && cached.original === original) return cached.wrapped;

      // With several methods, a shared options.name would merge them into one deprecation.
      const methodOptions: DeprecationOptions =
        keys.length === 1 ? options : { ...options, name: undefined };
      const wrapped = function deprecatedMethod(this: unknown, ...args: unknown[]): unknown {
        notify(methodOptions, String(property), wrapped);
        // Run against the real object so private fields and internal calls keep working.
        return Reflect.apply(original, this === proxy ? target : this, args);
      };
      copyFunctionShape(wrapped, original);
      cache.set(property, { original, wrapped });
      return wrapped;
    },
  });
  return proxy;
}

/**
 * Redefine `obj[property]` in place so reading or writing it reports a deprecation.
 * Works with data properties and getters/setters. Returns the same object.
 */
export function deprecateProperty<T extends object>(
  obj: T,
  property: keyof T,
  options: DeprecationOptions = {},
): T {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('deprecateProperty() expects an object as first argument');
  }
  const descriptor = Object.getOwnPropertyDescriptor(obj, property);
  if (!descriptor) throw new TypeError(`"${String(property)}" is not an own property of the given object`);
  if (!descriptor.configurable) throw new TypeError(`"${String(property)}" is not configurable`);

  const name = options.name ?? String(property);
  const next: PropertyDescriptor = { configurable: true, enumerable: descriptor.enumerable };

  if ('value' in descriptor || 'writable' in descriptor) {
    let current: unknown = descriptor.value;
    next.get = function get() {
      notify(options, name, get);
      return current;
    };
    if (descriptor.writable) {
      next.set = function set(value: unknown) {
        notify(options, name, set);
        current = value;
      };
    }
  } else {
    const { get: originalGet, set: originalSet } = descriptor;
    if (originalGet) {
      next.get = function get(this: unknown) {
        notify(options, name, get);
        return originalGet.call(this);
      };
    }
    if (originalSet) {
      next.set = function set(this: unknown, value: unknown) {
        notify(options, name, set);
        originalSet.call(this, value);
      };
    }
  }

  Object.defineProperty(obj, property, next);
  return obj;
}

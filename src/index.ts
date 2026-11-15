import { deprecate, deprecateMethod } from './core';
import type { DeprecationOptions } from './types';

export {
  configure,
  deprecate,
  deprecateMethod,
  deprecateProperty,
  DeprecationError,
  resetDeprecations,
} from './core';
export { Deprecated } from './decorator';
export type {
  DeprecationEvent,
  DeprecationMode,
  DeprecationOptions,
  GlobalConfig,
  Logger,
} from './types';

/** Options accepted by the v0.x default export. */
export interface LegacyConfig extends DeprecationOptions {
  /** Name of the method to deprecate when the first argument is an object. */
  method?: string;
}

/**
 * v0.x API, kept so existing code keeps working.
 * @deprecated Use `deprecate(fn, options)` or `deprecateMethod(obj, 'method', options)`.
 */
export default function deprecated<T extends object>(obj: T, config: LegacyConfig = {}): T {
  if (obj == null) throw new TypeError('The param obj is required');
  const { method, ...options } = config;
  if (typeof obj === 'function' && method === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deprecate(obj as any, options) as T;
  }
  if (method === undefined || typeof (obj as Record<string, unknown>)[method] !== 'function') {
    throw new TypeError('The object not have the method defined');
  }
  return deprecateMethod(obj, method as keyof T, options);
}

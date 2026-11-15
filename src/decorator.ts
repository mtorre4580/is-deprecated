/* eslint-disable @typescript-eslint/no-explicit-any */
import { type AnyFunction, deprecate, notify } from './core';
import type { DeprecationOptions } from './types';

interface StandardContext {
  kind: 'class' | 'method' | 'getter' | 'setter' | 'field' | 'accessor';
  name: string | symbol | undefined;
  static?: boolean;
}

function isStandardContext(context: unknown): context is StandardContext {
  return typeof context === 'object' && context !== null && 'kind' in context;
}

function ownerName(instanceOrClass: any, isStatic: boolean): string {
  try {
    const owner = isStatic ? instanceOrClass : instanceOrClass?.constructor;
    return typeof owner?.name === 'string' && owner.name !== '' ? owner.name : 'Object';
  } catch {
    return 'Object';
  }
}

function wrapCallable(
  original: AnyFunction,
  member: string,
  isStatic: boolean,
  suffix: string,
  options: DeprecationOptions,
): AnyFunction {
  const wrapped = function (this: any, ...args: any[]): any {
    notify(options, `${ownerName(this, isStatic)}.${member}${suffix}`, wrapped);
    return original.apply(this, args);
  };
  Object.defineProperty(wrapped, 'name', { value: original.name, configurable: true });
  return wrapped;
}

function fieldError(): TypeError {
  return new TypeError(
    '@Deprecated() cannot intercept plain class fields: use an `accessor` field or a getter/setter',
  );
}

function decorateStandard(value: any, context: StandardContext, options: DeprecationOptions): any {
  const member = String(context.name);
  const isStatic = Boolean(context.static);
  switch (context.kind) {
    case 'class':
      return deprecate(value, { ...options, name: options.name ?? (member || value.name) });
    case 'method':
      return wrapCallable(value, member, isStatic, '()', options);
    case 'getter':
    case 'setter':
      return wrapCallable(value, member, isStatic, '', options);
    case 'accessor': {
      const get = function (this: any): unknown {
        notify(options, `${ownerName(this, isStatic)}.${member}`, get);
        return value.get.call(this);
      };
      const set = function (this: any, next: unknown): void {
        notify(options, `${ownerName(this, isStatic)}.${member}`, set);
        value.set.call(this, next);
      };
      return { get, set, init: (initial: unknown) => initial };
    }
    default:
      throw fieldError();
  }
}

function decorateLegacy(
  target: any,
  key: string | symbol | undefined,
  descriptor: PropertyDescriptor | undefined,
  options: DeprecationOptions,
): any {
  if (key === undefined && typeof target === 'function') {
    return deprecate(target, { ...options, name: options.name ?? target.name });
  }
  if (!descriptor) throw fieldError();
  const member = String(key);
  const isStatic = typeof target === 'function';
  const next: PropertyDescriptor = { ...descriptor };
  if (typeof descriptor.value === 'function') {
    next.value = wrapCallable(descriptor.value, member, isStatic, '()', options);
  }
  if (descriptor.get) next.get = wrapCallable(descriptor.get, member, isStatic, '', options);
  if (descriptor.set) next.set = wrapCallable(descriptor.set, member, isStatic, '', options);
  return next;
}

/**
 * Decorator that reports a deprecation when a class is instantiated, or when a method,
 * getter, setter or `accessor` field is used.
 *
 * Works with standard (TC39, TypeScript 5+) decorators and with legacy
 * `experimentalDecorators` (Angular, NestJS...).
 *
 * @example
 * ```ts
 * class Api {
 *   \@Deprecated({ since: '1.2.0', replacement: 'Api.getUsersV2()' })
 *   getUsers() {}
 * }
 * ```
 */
export function Deprecated(options: DeprecationOptions = {}): any {
  return function deprecatedDecorator(value: any, context?: unknown, descriptor?: PropertyDescriptor): any {
    if (isStandardContext(context)) return decorateStandard(value, context, options);
    return decorateLegacy(value, context as string | symbol | undefined, descriptor, options);
  };
}

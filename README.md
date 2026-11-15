# is-deprecated

[![npm version](https://img.shields.io/npm/v/@mtorre4580/is-deprecated.svg)](https://www.npmjs.com/package/@mtorre4580/is-deprecated)
[![npm downloads](https://img.shields.io/npm/dm/@mtorre4580/is-deprecated.svg)](https://www.npmjs.com/package/@mtorre4580/is-deprecated)
[![bundle size](https://img.shields.io/bundlejs/size/@mtorre4580/is-deprecated)](https://bundlejs.com/?q=@mtorre4580/is-deprecated)
[![CI](https://github.com/mtorre4580/is-deprecated/actions/workflows/node.js.yml/badge.svg)](https://github.com/mtorre4580/is-deprecated/actions/workflows/node.js.yml)
[![types](https://img.shields.io/npm/types/@mtorre4580/is-deprecated.svg)](https://www.npmjs.com/package/@mtorre4580/is-deprecated)
[![license](https://img.shields.io/npm/l/@mtorre4580/is-deprecated.svg)](./LICENSE)

**Deprecate functions, methods, properties and classes in JavaScript and TypeScript** with runtime deprecation warnings that tell developers what to use instead, since when, and from where they are calling the old API.

Works in **Node and the browser**, ships **TypeScript types**, supports **decorators** (TC39 and `experimentalDecorators`), **telemetry hooks** and **warn / throw / silent** modes. Zero dependencies, ~2 kB gzip. A modern alternative to `depd`, `util-deprecate` and Node's `util.deprecate`.

<img width="128" height="128" alt="is-deprecated logo: deprecation warnings for JavaScript and TypeScript" src="https://raw.githubusercontent.com/mtorre4580/is-deprecated/main/deprecated.png" />

```
npm i @mtorre4580/is-deprecated
```

```ts
import { deprecate } from '@mtorre4580/is-deprecated';

export const getUsers = deprecate(getUsersImpl, {
  since: '1.4.0',
  removeIn: '2.0.0',
  replacement: 'getUsersV2()',
});

getUsers();
// (node:4242) DeprecationWarning: getUsers is deprecated since 1.4.0 and will be removed in 2.0.0. Use getUsersV2() instead.
// Called from file:///app/src/routes.ts:12:3
```

## Comparison with depd, util-deprecate and util.deprecate

| | is-deprecated | [depd](https://www.npmjs.com/package/depd) | [util-deprecate](https://www.npmjs.com/package/util-deprecate) | Node `util.deprecate` |
|---|:-:|:-:|:-:|:-:|
| Works in browsers | ✅ | ❌ (no-op) | ✅ | ❌ |
| TypeScript types included | ✅ | ❌ | ❌ | ✅ |
| Functions and classes (`new`) | ✅ | ✅ | ✅ | ✅ |
| Object methods and properties | ✅ | ✅ | ❌ | ❌ |
| Decorators (TC39 + legacy) | ✅ | ❌ | ❌ | ❌ |
| Call site in the warning | ✅ | ✅ | ❌ | with `--trace-deprecation` |
| Once per call site | ✅ | ✅ | once total | once total |
| `since` / `removeIn` / `replacement` metadata | ✅ | ❌ | ❌ | `code` only |
| Overdue removal dates | ✅ | ❌ | ❌ | ❌ |
| Telemetry hook with structured event | ✅ | `process.on('deprecation')` | ❌ | `process.on('warning')` |
| Modes warn / throw / silent | ✅ | ✅ (Node flags) | partial | ✅ (Node flags) |
| ESM + CJS | ✅ | CJS | CJS | n/a |

If you only target Node and need to deprecate a single function, `util.deprecate` is perfectly fine. Use this library when you ship code to browsers, want typed metadata, decorators or telemetry.

## API

### `deprecate(fn, options?)`

Wraps a function or class. It warns **when called** (or instantiated with `new`), never when wrapped. It keeps `this`, `new`, `instanceof`, `name`, `length`, `prototype` and static members.

```ts
const LegacyClient = deprecate(Client, { replacement: 'ApiClient' });
new LegacyClient(); // Client is deprecated. Use ApiClient instead.
```

### `deprecateMethod(obj, method | methods[], options?)`

Returns a proxy of `obj` whose methods warn when **called**. Reading the property, `typeof`, spreading or logging the object does not warn. Deprecated methods run against the original object, so private fields work and their internal `this.x()` calls are not reported again.

```ts
export const api = deprecateMethod(apiImpl, ['getUsers', 'getUser'], {
  removeIn: '2027-06-30',
  url: 'https://example.com/migrate-users',
});
```

### `deprecateProperty(obj, property, options?)`

Redefines the property **in place** so reading or writing it warns. It works with data properties and with getters/setters.

```ts
deprecateProperty(config, 'retries', { replacement: 'config.maxRetries' });
```

### `@Deprecated(options?)`

Decorator for classes, methods, getters, setters and `accessor` fields. It supports standard decorators (TypeScript 5+, Babel) and legacy `experimentalDecorators` (Angular, NestJS).

```ts
import { Deprecated } from '@mtorre4580/is-deprecated';

class Api {
  /** @deprecated Use {@link Api.getUsersV2} */
  @Deprecated({ since: '1.2.0', replacement: 'Api.getUsersV2()' })
  getUsers() {}

  @Deprecated()
  accessor timeout = 5000;
}
// Api.getUsers() is deprecated since 1.2.0. Use Api.getUsersV2() instead.
```

Plain class fields cannot be intercepted: use `accessor` or a getter/setter.

### Options

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Name shown in the message. Defaults to the function, method or property name. |
| `message` | `string` | Full custom message (replaces the generated one). |
| `since` | `string` | Version in which the API was deprecated. |
| `removeIn` | `string \| Date` | Version (`"2.0.0"`) or date (`"2027-01-01"`) of removal. Past dates are marked `[OVERDUE]` and logged with `logger.error` when available. |
| `replacement` | `string` | What to use instead. |
| `code` | `string` | Stable id such as `MYLIB_DEP001`. Shown by Node and used for dedupe. |
| `url` | `string` | Migration guide. |
| `once` | `boolean` | Warn once per call site (default `true`). |
| `logger` | `{ warn, error? }` | Logger for this API. |
| `onDeprecation` | `(event) => void` | Telemetry hook for this API. |

### `configure(config)`

```ts
import { configure } from '@mtorre4580/is-deprecated';

configure({
  mode: process.env.NODE_ENV === 'production' ? 'silent' : 'warn', // or 'throw' in CI
  once: true,
  logger: pinoLogger, // default: process.emitWarning in Node, console.warn in browsers
  onDeprecation(event) {
    metrics.increment('deprecated_api', { name: event.name, code: event.code });
  },
});
```

- **`warn`** (default) prints the warning.
- **`throw`** throws a `DeprecationError` on every call (`error.event` holds the details). It is handy in CI to make sure nothing still uses old APIs.
- **`silent`** prints nothing but **still calls `onDeprecation`**, so you can track usage in production without noise.

When `mode` is not configured it is read from the `IS_DEPRECATED_MODE` env var (`warn|throw|silent`), and then from Node's `--no-deprecation` / `--throw-deprecation` flags.

The `onDeprecation` event has this shape:

```ts
{ name, message, code?, since?, removeIn?, replacement?, url?, overdue, callSite?, stack?, mode }
```

Hooks that throw are ignored: telemetry never breaks your app.

### `resetDeprecations()`

Clears the "already warned" cache. It is useful in tests.

## Best practices

- Combine the static and runtime signals: the JSDoc `/** @deprecated */` tag strikes the API through in editors and is caught by [`@typescript-eslint/no-deprecated`](https://typescript-eslint.io/rules/no-deprecated/), while this library warns people who use it at runtime or from plain JavaScript.
- Always set `replacement` and `removeIn`, so a warning tells people what to do and by when.
- Use `code` so people can search for it and filter it with Node's `--no-deprecation`/`process.on('warning')`.
- Send `onDeprecation` to your metrics, so you know when it is safe to remove the API.

## Migrating from 0.x

The 0.x default export still works but is deprecated:

```diff
- import deprecated from '@mtorre4580/is-deprecated';
- const fn = deprecated(myFn, { message: '...' });
- const api = deprecated(API, { method: 'getUsers', sendMetrics });
+ import { deprecate, deprecateMethod } from '@mtorre4580/is-deprecated';
+ const fn = deprecate(myFn, { message: '...' });
+ const api = deprecateMethod(API, 'getUsers', { onDeprecation });
```

Behavior changes in 1.0:

- **Bug fix:** in 0.x a wrapped function warned once when it was *wrapped* and never when it was *called*. It now warns on calls.
- Object methods warn when called, not on every property read.
- Warnings are deduplicated per call site (`once: false` restores warning on every call).
- The default message is generated from the metadata instead of `"This will be deprecated soon"`.
- `sendMetrics` now receives the event object.
- In CommonJS, `require()` returns the module namespace: use `const { deprecate } = require('@mtorre4580/is-deprecated')`.

## FAQ

### How do I deprecate a function in JavaScript or TypeScript?

Wrap it with `deprecate()` and export the wrapper. Add a `/** @deprecated */` JSDoc tag too, so editors strike it through:

```ts
/** @deprecated Use getUsersV2() */
export const getUsers = deprecate(getUsersImpl, { replacement: 'getUsersV2()' });
```

### How do I show a deprecation warning in the browser?

Use the same API: outside Node the warning is printed with `console.warn`, including the call site. `depd` and `util.deprecate` do nothing in browsers.

### How do I deprecate a method of a class with a decorator?

Use `@Deprecated()` on the method, getter, setter, `accessor` or the whole class. It works with TypeScript 5+ standard decorators and with `experimentalDecorators` (Angular, NestJS).

### How do I deprecate an object property or a config option?

Use `deprecateProperty(obj, 'option', { replacement: 'newOption' })`: reading or writing it warns.

### How do I make CI fail when deprecated APIs are used?

Run with `IS_DEPRECATED_MODE=throw` (or `node --throw-deprecation`), or call `configure({ mode: 'throw' })` in your test setup.

### How do I know when it is safe to remove a deprecated API?

Send `onDeprecation` events to your metrics. They still fire in `silent` mode, so you can measure usage in production without printing warnings.

### What is the difference between `@deprecated` in JSDoc and this library?

The JSDoc tag is static: it only shows up in editors and linters (`@typescript-eslint/no-deprecated`). This library warns at runtime, so it also reaches plain JavaScript users, dynamic calls and people who never read the editor hint. Use both.

## License

MIT

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.2 - 2026-11-15

- docs: API reference site at https://mtorre4580.github.io/is-deprecated/ (TypeDoc), linked from the README and set as the package homepage.
- types: export the `AnyFunction` type used in public signatures.

## 1.0.1 - 2026-11-15

- docs: better npm description and keywords, README badges, comparison section and FAQ.

## 1.0.0 - 2026-11-15

Full rewrite in TypeScript.

- **Breaking change / fix:** `deprecated(fn)` warned once when the wrapper was *created* and never when it was called. Warnings now fire on every call (deduplicated per call site).
- **Breaking change:** in CommonJS, `require('@mtorre4580/is-deprecated')` now returns the module namespace. Use `const { deprecate } = require(...)` (or `.default` for the v0 function).
- **Breaking change:** wrapping an object method only warns when the method is *called*, not on every property read.
- feat: new `deprecate`, `deprecateMethod` (one or many methods), `deprecateProperty` and `@Deprecated` decorator (TC39 and legacy `experimentalDecorators`).
- feat: metadata `since`, `removeIn` (version or date, flags overdue removals), `replacement`, `code`, `url`.
- feat: `configure({ mode: 'warn' | 'throw' | 'silent', once, logger, onDeprecation })`, the `IS_DEPRECATED_MODE` env var, and support for `--no-deprecation` / `--throw-deprecation`.
- feat: call site in the warning and in telemetry events; uses `process.emitWarning` in Node and `console.warn` in browsers.
- feat: keeps `this`, `new`, `name`, `length` and static members of wrapped functions.
- feat: TypeScript types, ESM + CJS builds, `sideEffects: false`, zero dependencies.
- deprecated: the default export (v0 API) and `sendMetrics` (use `onDeprecation`). Both still work in 1.x.

## [0.0.2](https://github.com/mtorre4580/is-deprecated/compare/0.0.1...0.0.2) - 2023-12-16

## 0.0.1 - 2023-12-16

- fix: improve browser and node integration with vite [`#2`](https://github.com/mtorre4580/is-deprecated/pull/2)
- feat: add deprecated implementation [`#1`](https://github.com/mtorre4580/is-deprecated/pull/1)

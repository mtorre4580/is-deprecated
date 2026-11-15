/** How deprecations are surfaced. */
export type DeprecationMode = 'warn' | 'throw' | 'silent';

/** Anything with a `warn` method (console, pino, winston, a custom logger...). */
export interface Logger {
  warn: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

/** Metadata describing a single deprecated API. */
export interface DeprecationOptions {
  /** Human readable name of the deprecated API. Defaults to the function/property name. */
  name?: string;
  /** Full custom message. When omitted, a message is built from the other fields. */
  message?: string;
  /** Version (or date) in which the API was deprecated, e.g. `"1.4.0"`. */
  since?: string;
  /**
   * Version or date in which the API will be removed, e.g. `"2.0.0"`, `"2027-01-01"` or a `Date`.
   * When it is a date that already passed, the deprecation is flagged as overdue.
   */
  removeIn?: string | Date;
  /** What to use instead, e.g. `"getUsersV2()"`. */
  replacement?: string;
  /** Stable identifier, e.g. `"MYLIB_DEP001"`. Used for dedupe and shown in Node warnings. */
  code?: string;
  /** Link to the migration guide. */
  url?: string;
  /** Warn only once per call site (default: global `once`, which defaults to `true`). */
  once?: boolean;
  /** Per-API logger. When set, it is used instead of `process.emitWarning`/`console.warn`. */
  logger?: Logger;
  /** Per-API telemetry hook, called in addition to the global `onDeprecation`. */
  onDeprecation?: (event: DeprecationEvent) => void;
  /**
   * @deprecated Use `onDeprecation` instead. Kept for compatibility with v0.x.
   */
  sendMetrics?: (event: DeprecationEvent) => void;
}

/** Payload delivered to `onDeprecation` hooks. */
export interface DeprecationEvent {
  name: string;
  message: string;
  code?: string;
  since?: string;
  removeIn?: string;
  replacement?: string;
  url?: string;
  /** `true` when `removeIn` is a date that already passed. */
  overdue: boolean;
  /** First stack frame outside this library (best effort, `undefined` when unavailable). */
  callSite?: string;
  /** Stack trace starting at the caller (best effort). */
  stack?: string;
  /** Mode that was applied to this event. */
  mode: DeprecationMode;
}

/** Global configuration, set with `configure()`. */
export interface GlobalConfig {
  /**
   * `warn` (default), `throw` or `silent`. When not set, it is read from the
   * `IS_DEPRECATED_MODE` env var, then from Node's `--no-deprecation` / `--throw-deprecation`.
   */
  mode?: DeprecationMode;
  /** Warn only once per API and call site. Default `true`. */
  once?: boolean;
  /** Global logger. Default: `process.emitWarning` in Node, `console.warn` elsewhere. */
  logger?: Logger;
  /** Global telemetry hook. Called even in `silent` mode. */
  onDeprecation?: (event: DeprecationEvent) => void;
}

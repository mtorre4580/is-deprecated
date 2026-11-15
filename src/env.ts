import type { DeprecationMode } from './types';

interface WarningOptions {
  type?: string;
  code?: string;
  detail?: string;
}

/** Minimal shape of Node's `process` used here, so the browser build needs no Node types. */
interface ProcessLike {
  env?: Record<string, string | undefined>;
  noDeprecation?: boolean;
  throwDeprecation?: boolean;
  emitWarning?: (warning: string | Error, options?: WarningOptions) => void;
}

export function getProcess(): ProcessLike | undefined {
  const proc = (globalThis as { process?: ProcessLike }).process;
  return proc && typeof proc === 'object' ? proc : undefined;
}

const MODES: readonly DeprecationMode[] = ['warn', 'throw', 'silent'];

/** Mode implied by the environment when `configure({ mode })` was not called. */
export function modeFromEnvironment(): DeprecationMode {
  const proc = getProcess();
  let fromEnv: string | undefined;
  try {
    fromEnv = proc?.env?.IS_DEPRECATED_MODE;
  } catch {
    // Some sandboxes throw when reading process.env.
  }
  const normalized = fromEnv?.trim().toLowerCase() as DeprecationMode | undefined;
  if (normalized && MODES.includes(normalized)) return normalized;
  if (proc?.noDeprecation) return 'silent';
  if (proc?.throwDeprecation) return 'throw';
  return 'warn';
}

/** `process.emitWarning` when running in Node (respects `--no-deprecation`, `--trace-deprecation`...). */
export function nodeEmitWarning(): ProcessLike['emitWarning'] | undefined {
  const emit = getProcess()?.emitWarning;
  return typeof emit === 'function' ? emit.bind(getProcess()) : undefined;
}

import { vi } from 'vitest';
import { configure, resetDeprecations, type DeprecationEvent } from '../src/index';

/** Reset global state and capture output/events with a fake logger. */
export function setup() {
  resetDeprecations();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const events: DeprecationEvent[] = [];
  configure({
    mode: 'warn',
    once: undefined,
    logger,
    onDeprecation: (event) => events.push(event),
  });
  return { logger, events };
}

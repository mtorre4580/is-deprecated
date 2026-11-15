import { beforeEach, describe, expect, it } from 'vitest';
import { Deprecated } from '../src/index';
import { setup } from './helpers';

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('@Deprecated (standard TC39 decorators)', () => {
  it('decorates methods, getters, setters, static members and accessors', () => {
    class Api {
      #token = 'a';

      @Deprecated({ replacement: 'Api.getUsersV2()' })
      getUsers() {
        return [this.#token];
      }

      @Deprecated()
      get token() {
        return this.#token;
      }

      @Deprecated()
      set token(next: string) {
        this.#token = next;
      }

      @Deprecated()
      static create() {
        return new Api();
      }

      @Deprecated()
      accessor retries = 3;
    }

    const api = Api.create();
    expect(api.getUsers()).toEqual(['a']);
    api.token = 'b';
    expect(api.token).toBe('b');
    expect(api.retries).toBe(3);
    api.retries = 4;
    expect(api.retries).toBe(4);

    expect(ctx.events.map((e) => e.name)).toEqual([
      'Api.create()',
      'Api.getUsers()',
      'Api.token',
      'Api.token',
      'Api.retries', // read
      'Api.retries', // write
      'Api.retries', // read from another call site
    ]);
    expect(ctx.events[1].message).toBe('Api.getUsers() is deprecated. Use Api.getUsersV2() instead.');
    expect(ctx.events[1].callSite).toContain('decorator.test.ts');
  });

  it('decorates classes', () => {
    @Deprecated({ replacement: 'NewClient' })
    class OldClient {
      ping() {
        return 'pong';
      }
    }
    const client = new OldClient();
    expect(client.ping()).toBe('pong');
    expect(client).toBeInstanceOf(OldClient);
    expect(ctx.logger.warn).toHaveBeenCalledWith('OldClient is deprecated. Use NewClient instead.');
  });

  it('names detached method calls after Object', () => {
    class Api {
      @Deprecated()
      ping() {
        return 'pong';
      }
    }
    const { ping } = new Api();
    expect(ping()).toBe('pong');
    expect(ctx.events[0].name).toBe('Object.ping()');
  });

  it('refuses plain fields', () => {
    const decorator = Deprecated();
    expect(() => decorator(undefined, { kind: 'field', name: 'x', static: false })).toThrow(
      /accessor/,
    );
  });
});

describe('@Deprecated (legacy experimentalDecorators)', () => {
  it('decorates methods and accessors through the property descriptor', () => {
    class Service {
      run() {
        return 'ran';
      }

      get mode() {
        return 'fast';
      }

      static make() {
        return 'made';
      }
    }
    const decorate = Deprecated();
    for (const key of ['run', 'mode'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(Service.prototype, key)!;
      Object.defineProperty(Service.prototype, key, decorate(Service.prototype, key, descriptor));
    }
    const staticDescriptor = Object.getOwnPropertyDescriptor(Service, 'make')!;
    Object.defineProperty(Service, 'make', decorate(Service, 'make', staticDescriptor));

    const service = new Service();
    expect(service.run()).toBe('ran');
    expect(service.mode).toBe('fast');
    expect(Service.make()).toBe('made');
    expect(ctx.events.map((e) => e.name)).toEqual(['Service.run()', 'Service.mode', 'Service.make()']);
  });

  it('decorates classes and refuses properties without descriptor', () => {
    class Legacy {}
    const Wrapped = Deprecated({ name: 'LegacyThing' })(Legacy);
    void new Wrapped();
    expect(ctx.events[0].name).toBe('LegacyThing');
    expect(() => Deprecated()(Legacy.prototype, 'field')).toThrow(TypeError);
  });
});

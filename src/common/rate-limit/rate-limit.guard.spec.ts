import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RateLimitRule } from './rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitStore } from './rate-limit.store';

function makeContext(ip: string, args: Record<string, unknown> = {}) {
  jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
    getContext: () => ({ req: { ip } }),
    getArgs: () => args,
  } as unknown as GqlExecutionContext);
  return {
    getType: () => 'graphql',
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(rule: RateLimitRule | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(rule),
  } as unknown as Reflector;
  const store = new RateLimitStore();
  stores.push(store);
  return new RateLimitGuard(reflector, store);
}

const stores: RateLimitStore[] = [];

afterEach(() => {
  stores.splice(0).forEach((store) => store.onModuleDestroy());
  jest.restoreAllMocks();
});

describe('RateLimitGuard', () => {
  it('allows operations without a rule', () => {
    const guard = makeGuard(undefined);
    for (let i = 0; i < 100; i += 1) {
      expect(guard.canActivate(makeContext('1.1.1.1'))).toBe(true);
    }
  });

  it('blocks one IP after the limit and returns 429', () => {
    const guard = makeGuard({ name: 'login', perIp: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i += 1) {
      expect(guard.canActivate(makeContext('1.1.1.1'))).toBe(true);
    }
    try {
      guard.canActivate(makeContext('1.1.1.1'));
      throw new Error('expected a rate limit error');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Other clients are unaffected.
    expect(guard.canActivate(makeContext('2.2.2.2'))).toBe(true);
  });

  it('also limits one account across many IPs', () => {
    const guard = makeGuard({
      name: 'login',
      perIp: 100,
      windowMs: 60_000,
      perIdentifier: { path: 'input.email', limit: 2 },
    });
    const args = { input: { email: 'Vet@Clinic.lt' } };
    expect(guard.canActivate(makeContext('1.1.1.1', args))).toBe(true);
    expect(
      guard.canActivate(
        makeContext('2.2.2.2', { input: { email: 'vet@clinic.lt ' } }),
      ),
    ).toBe(true);
    expect(() => guard.canActivate(makeContext('3.3.3.3', args))).toThrow(
      HttpException,
    );
  });
});

describe('RateLimitStore', () => {
  it('starts a new window after it expires', () => {
    const store = new RateLimitStore();
    stores.push(store);
    expect(store.hit('k', 1, 1_000, 0)).toBe(0);
    expect(store.hit('k', 1, 1_000, 500)).toBe(1);
    expect(store.hit('k', 1, 1_000, 1_001)).toBe(0);
  });
});

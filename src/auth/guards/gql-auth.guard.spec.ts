import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';

describe('GqlAuthGuard', () => {
  it('extracts the HTTP request from GraphQL context', () => {
    const guard = new GqlAuthGuard();
    const req = { headers: { authorization: 'Bearer token' } };
    const context = {
      getType: () => 'graphql',
    } as ExecutionContext;

    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
      getArgs: jest.fn(),
      getRoot: jest.fn(),
      getInfo: jest.fn(),
    } as unknown as GqlExecutionContext);

    expect(guard.getRequest(context)).toBe(req);
  });
});

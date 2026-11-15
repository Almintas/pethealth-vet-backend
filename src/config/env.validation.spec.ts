import { describe, expect, it } from '@jest/globals';
import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  it('applies development defaults', () => {
    const { value, error } = envValidationSchema.validate({
      NODE_ENV: 'development',
    });
    expect(error).toBeUndefined();
    expect(value.MONGODB_URI).toContain('pethealth_vet_dev');
    expect(value.JWT_SECRET).toBeDefined();
    expect(value.PORT).toBe(3001);
  });

  it('requires production secrets', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
    });
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/MONGODB_URI/);
  });

  it('requires a strong JWT secret in production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/pethealth_vet',
      JWT_SECRET: 'short',
    });
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/JWT_SECRET/);
  });
});

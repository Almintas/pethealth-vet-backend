import { beforeEach, describe, expect, it } from '@jest/globals';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes and verifies passwords', async () => {
    const hash = await service.hash('secure-password');
    expect(hash).not.toBe('secure-password');
    await expect(service.compare('secure-password', hash)).resolves.toBe(true);
    await expect(service.compare('wrong-password', hash)).resolves.toBe(false);
  });
});

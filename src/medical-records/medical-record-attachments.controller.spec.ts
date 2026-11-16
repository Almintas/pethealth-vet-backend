import { describe, expect, it } from '@jest/globals';
import { decodeMultipartFileName } from './medical-record-attachments.controller';

describe('decodeMultipartFileName', () => {
  it('repairs UTF-8 names that multer read as latin1', () => {
    const mangled = Buffer.from('Kraujo tyrimas ąčę.pdf', 'utf8').toString(
      'latin1',
    );
    expect(decodeMultipartFileName(mangled)).toBe('Kraujo tyrimas ąčę.pdf');
  });

  it('keeps names that are already text or not UTF-8 bytes', () => {
    expect(decodeMultipartFileName('Rentgenas.pdf')).toBe('Rentgenas.pdf');
    expect(decodeMultipartFileName('Žvaigždė.pdf')).toBe('Žvaigždė.pdf');
    expect(decodeMultipartFileName('café.pdf')).toBe('café.pdf');
  });
});

import { describe, it, expect } from 'vitest';
import { generateId, parseJSON } from '../../../tree/orders/helpers.js';

describe('generateId', () => {
  it('returns string starting with ID_ (default prefix)', () => {
    const id: string = generateId();
    expect(id.startsWith('ID_')).toBe(true);
  });

  it('returns string with custom prefix', () => {
    const id: string = generateId('ORD_');
    expect(id.startsWith('ORD_')).toBe(true);
  });

  it('generates unique values across two calls', () => {
    const id1: string = generateId();
    const id2: string = generateId();
    expect(id1).not.toEqual(id2);
  });
});

describe('parseJSON', () => {
  it('parses valid JSON body', async() => {
    const request = new Request('https://test.local', {
      method: 'POST',
      body: JSON.stringify({ name: 'Pho', price: 50000 }),
      headers: { 'Content-Type': 'application/json' }
    });
    const result: Record<string, unknown> = await parseJSON(request);
    expect(result).toEqual({ name: 'Pho', price: 50000 });
  });

  it('throws Invalid JSON body on invalid JSON', async() => {
    const request = new Request('https://test.local', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' }
    });
    await expect(parseJSON(request)).rejects.toThrow('Invalid JSON body');
  });

  it('throws Invalid JSON body on empty body (0 bytes)', async() => {
    const request = new Request('https://test.local', {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json' }
    });
    await expect(parseJSON(request)).rejects.toThrow('Invalid JSON body');
  });
});

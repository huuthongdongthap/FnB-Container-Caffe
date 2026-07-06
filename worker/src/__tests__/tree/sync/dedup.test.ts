import { describe, it, expect } from 'vitest';
import { findDuplicate, mergeCustomerData } from '../../../tree/sync/dedup.js';

describe('dedup', () => {
 const existing = {
  id: '1',
  name: 'Nguyen Van A',
  phone: '0909123456',
  email: 'a@example.com',
  tax_id: 'TAX001',
 };

 it('findDuplicate matches phone', () => {
  const local = { name: 'A Nguyen', phone: '0909123456', email: 'new@example.com' };
  const r = findDuplicate(local, existing);
  expect(r.matched).toBe(true);
  expect(r.matchField).toBe('phone');
 });

 it('findDuplicate matches email', () => {
  const local = { name: 'A Nguyen', email: 'a@example.com' };
  const r = findDuplicate(local, existing);
  expect(r.matched).toBe(true);
  expect(r.matchField).toBe('email');
 });

 it('findDuplicate matches tax_id', () => {
  const local = { name: 'A Nguyen', tax_id: 'TAX001' };
  const r = findDuplicate(local, existing);
  expect(r.matched).toBe(true);
  expect(r.matchField).toBe('tax_id');
 });

 it('findDuplicate no overlap returns false', () => {
  const local = { name: 'B Nguyen', phone: '0909999999' };
  const r = findDuplicate(local, existing);
  expect(r.matched).toBe(false);
 });

 it('mergeCustomerData fills missing from existing', () => {
  const local = { name: 'New Name' };
  const merged = mergeCustomerData(local, existing);
  expect(merged.name).toBe('New Name');
  expect(merged.phone).toBe('0909123456');
 });

 it('mergeCustomerData keeps existing value when local has empty string', () => {
  const local = { name: 'New Name', phone: '' };
  const merged = mergeCustomerData(local, existing);
  // empty string is treated as "no value" — existing phone preserved
  expect(merged.phone).toBe('0909123456');
 });
});

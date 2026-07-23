import { describe, expect, it } from 'vitest';
import { filterFieldsForRead, filterFieldsForWrite } from './fieldAccess.js';
import { atLeast } from './access.js';
import type { Field } from './fields.js';

const fields: Field[] = [
  { name: 'title', type: 'text' },
  { name: 'salary', type: 'number', access: { read: atLeast('editor'), update: atLeast('admin') } },
  { name: 'featured', type: 'boolean', access: { update: atLeast('editor') } },
];

const admin = { user: { id: '1', role: 'admin' as const } };
const author = { user: { id: '2', role: 'author' as const } };
const anon = { user: null };

describe('filterFieldsForRead', () => {
  it('keeps a restricted field for a user who satisfies the check', () => {
    const out = filterFieldsForRead(fields, { title: 'Hi', salary: 100 }, admin);
    expect(out.salary).toBe(100);
  });

  it('strips a restricted field for a user who does not satisfy the check', () => {
    const out = filterFieldsForRead(fields, { title: 'Hi', salary: 100 }, author);
    expect('salary' in out).toBe(false);
    expect(out.title).toBe('Hi');
  });

  it('strips for anonymous users', () => {
    const out = filterFieldsForRead(fields, { salary: 100 }, anon);
    expect('salary' in out).toBe(false);
  });

  it('leaves fields with no access rule untouched for anyone', () => {
    const out = filterFieldsForRead(fields, { title: 'Hi' }, anon);
    expect(out.title).toBe('Hi');
  });
});

describe('filterFieldsForWrite', () => {
  it('keeps a field the user is allowed to update', () => {
    const out = filterFieldsForWrite(fields, { featured: true }, admin);
    expect(out.featured).toBe(true);
  });

  it('strips a field the user is not allowed to update', () => {
    const out = filterFieldsForWrite(fields, { featured: true }, author);
    expect('featured' in out).toBe(false);
  });

  it('enforces a stricter update rule than read (salary: admin-only write)', () => {
    const editorArgs = { user: { id: '3', role: 'editor' as const } };
    const out = filterFieldsForWrite(fields, { salary: 5 }, editorArgs);
    expect('salary' in out).toBe(false);
  });

  it('does not touch keys absent from the input', () => {
    const out = filterFieldsForWrite(fields, { title: 'Hi' }, author);
    expect(Object.keys(out)).toEqual(['title']);
  });
});

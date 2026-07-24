/**
 * Form definitions — config as code, same idea as collections/globals. See
 * packages/core/src/form.ts.
 */

import { defineForm, buildFormRegistry, type ResolvedForm } from '@ferrocms/core';

export const contactForm = defineForm({
  slug: 'contact',
  name: 'Contact',
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    { name: 'email', type: 'text', required: true, maxLength: 200 },
    { name: 'message', type: 'textarea', required: true, maxLength: 2000 },
  ],
});

export const forms: ResolvedForm[] = [contactForm];

export const formRegistry = buildFormRegistry(forms);

export function getForm(slug: string): ResolvedForm | undefined {
  return formRegistry.get(slug);
}

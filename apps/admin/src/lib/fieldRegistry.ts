/**
 * A registry for custom field *renderers* — lets a fork or a bundled plugin
 * swap in a different admin widget for a given field `type` (e.g. a color
 * swatch picker instead of the default `select` dropdown) without touching
 * `FieldInput.tsx`. This overrides how a field is *edited*, not the
 * underlying storage/validation shape (that's still defined by `@ferrocms/core`
 * field types) — the same model Payload/Strapi field-customization plugins use.
 */

import type { ComponentType } from 'react';
import type { Field } from './types.js';

export interface CustomFieldProps {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}

const registry = new Map<string, ComponentType<CustomFieldProps>>();

/** Register a renderer for the given field `type`, replacing the built-in one. */
export function registerFieldRenderer(
  type: Field['type'] | (string & {}),
  component: ComponentType<CustomFieldProps>,
): void {
  registry.set(type, component);
}

export function getFieldRenderer(type: string): ComponentType<CustomFieldProps> | undefined {
  return registry.get(type);
}

export function unregisterFieldRenderer(type: string): void {
  registry.delete(type);
}

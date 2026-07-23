/**
 * A generic JSON scalar for the `data` field, hand-rolled to avoid adding a
 * `graphql-scalars` dependency for one type. The GraphQL API mirrors the
 * REST API's schema-flexible design (config-as-code content types, not a
 * fixed shape), so `data` is intentionally untyped here — same trade-off
 * the REST responses already make.
 */

import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

function parseLiteral(node: ValueNode): unknown {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return Object.fromEntries(node.fields.map((f) => [f.name.value, parseLiteral(f.value)]));
    case Kind.LIST:
      return node.values.map(parseLiteral);
    default:
      return undefined;
  }
}

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value (a collection entry’s field data).',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral,
});

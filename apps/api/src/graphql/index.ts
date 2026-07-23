import { createYoga } from 'graphql-yoga';
import { schema, type GraphQLContext } from './schema.js';

/**
 * A single Yoga instance for the whole app's lifetime. `context` is built
 * fresh per request from whatever server context `.fetch()` is called with
 * (see app.ts) — Yoga does not cache context across requests.
 */
export const yoga = createYoga<GraphQLContext>({
  schema,
  context: ({ db, user }) => ({ db, user }),
  graphqlEndpoint: '/graphql',
  // Default error masking stays ON — same principle as the REST API's
  // toErrorResponse: unexpected errors must never leak internals to clients.
  // Our own intentionally-thrown GraphQLErrors (NOT_FOUND/FORBIDDEN/
  // UNAUTHENTICATED, with extensions.code set) pass through unmasked already.
});

export type { GraphQLContext };

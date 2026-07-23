/**
 * A generic GraphQL API — deliberately schema-flexible to match this CMS's
 * config-as-code content model. Rather than generating a distinct GraphQL
 * type per collection (a much bigger, ongoing-maintenance feature), `data`
 * is a JSON scalar, same trade-off many schema-flexible headless CMSs make
 * for their GraphQL layer. Access control mirrors the REST API exactly:
 * the same `resolveAccess` + `filterFieldsForRead` calls, so GraphQL never
 * bypasses collection- or field-level permissions.
 */

import { createGraphQLError, createSchema } from 'graphql-yoga';
import {
  filterFieldsForRead,
  resolveAccess,
  type AccessArgs,
  type EntryStatus,
} from '@ferrocms/core';
import type { Db } from '@ferrocms/db';
import { collections, getCollection } from '../config/collections.js';
import * as svc from '../services/entries.js';
import type { AuthUser } from '../env.js';
import { JSONScalar } from './jsonScalar.js';

export interface GraphQLContext {
  db: Db;
  user: AuthUser | null;
}

function accessArgs(user: AuthUser | null, id?: string): AccessArgs {
  return { user: user ? { id: user.id, role: user.role } : null, id };
}

function unauthorized(user: AuthUser | null): Error {
  return user
    ? createGraphQLError('You do not have permission to do that.', {
        extensions: { code: 'FORBIDDEN' },
      })
    : createGraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
}

const typeDefs = /* GraphQL */ `
  scalar JSON

  type CollectionInfo {
    slug: String!
    singular: String!
    plural: String!
  }

  type Entry {
    id: ID!
    collection: String!
    status: String!
    slug: String
    data: JSON!
    authorId: ID
    publishedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type EntryList {
    items: [Entry!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type Query {
    collections: [CollectionInfo!]!
    entries(collection: String!, status: String, slug: String, limit: Int, offset: Int): EntryList!
    entry(collection: String!, id: ID!): Entry
  }
`;

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    JSON: JSONScalar,
    Query: {
      collections: (_root: unknown, _args: unknown, ctx: GraphQLContext) => {
        if (!ctx.user) throw unauthorized(null);
        return collections.map((c) => ({
          slug: c.slug,
          singular: c.labels.singular,
          plural: c.labels.plural,
        }));
      },
      entries: async (
        _root: unknown,
        args: {
          collection: string;
          status?: string;
          slug?: string;
          limit?: number;
          offset?: number;
        },
        ctx: GraphQLContext,
      ) => {
        const collection = getCollection(args.collection);
        if (!collection) {
          throw createGraphQLError('Collection not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        const access = resolveAccess(collection.access);
        const args_ = accessArgs(ctx.user);
        if (!access.read(args_)) throw unauthorized(ctx.user);

        const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
        const offset = Math.max(args.offset ?? 0, 0);
        const publishedOnly = ctx.user === null;

        const result = await svc.listEntries(ctx.db, {
          collection: collection.slug,
          status: args.status as EntryStatus | undefined,
          slug: args.slug,
          publishedOnly,
          limit,
          offset,
        });
        const items = result.items.map((entry) => ({
          ...entry,
          data: filterFieldsForRead(
            collection.fields,
            entry.data as Record<string, unknown>,
            args_,
          ),
        }));
        return { ...result, items, limit, offset };
      },
      entry: async (
        _root: unknown,
        args: { collection: string; id: string },
        ctx: GraphQLContext,
      ) => {
        const collection = getCollection(args.collection);
        if (!collection) {
          throw createGraphQLError('Collection not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        const access = resolveAccess(collection.access);
        const args_ = accessArgs(ctx.user, args.id);
        if (!access.read(args_)) throw unauthorized(ctx.user);

        const entry = await svc.getEntry(ctx.db, collection.slug, args.id);
        if (!entry) return null;
        if (ctx.user === null && entry.status !== 'published') return null;
        return {
          ...entry,
          data: filterFieldsForRead(
            collection.fields,
            entry.data as Record<string, unknown>,
            args_,
          ),
        };
      },
    },
  },
});

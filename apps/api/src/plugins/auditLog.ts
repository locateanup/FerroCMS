/**
 * A minimal example plugin — logs every create/update on `posts`. Proves the
 * plugin mechanism end-to-end: no core code was touched to add this
 * behavior, only `applyPlugins([...], [auditLogPlugin])` in config/collections.ts.
 */

import { definePlugin } from '@ferrocms/core';

export const auditLogPlugin = definePlugin({
  name: 'audit-log',
  hooks: {
    posts: {
      afterChange: [
        ({ operation, doc, user }) => {
          console.log(
            `[audit] posts.${operation} id=${doc.id ?? '(new)'} by=${user?.id ?? 'anonymous'}`,
          );
        },
      ],
    },
  },
});

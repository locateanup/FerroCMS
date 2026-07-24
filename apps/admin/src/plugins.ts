/**
 * The admin's extension point — register custom field renderers, field-type
 * overrides, or whole custom pages here before the app renders (imported for
 * its side effects in main.tsx). A fork or a bundled plugin package adds to
 * this file (or replaces it) rather than touching core admin source.
 *
 * The System Status page below is a minimal working example: it proves a
 * plugin can add an entire route + nav entry, not just a field widget.
 */

import { registerAdminPage } from './lib/pageRegistry.js';
import { SystemStatusPage } from './pages/SystemStatusPage.js';

registerAdminPage({
  path: '/tools/status',
  label: 'System status',
  component: SystemStatusPage,
  minRole: 'admin',
});

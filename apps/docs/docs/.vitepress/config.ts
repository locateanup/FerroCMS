import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'FerroCMS',
  description: 'An open-source, headless, Cloudflare-native CMS for JavaScript sites.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Content modeling', link: '/content-modeling' },
      { text: 'API reference', link: '/api-reference' },
      { text: 'Plugins', link: '/plugins' },
      { text: 'GitHub', link: 'https://github.com/locateanup/FerroCMS' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Deployment', link: '/deployment' },
          { text: 'Upgrading', link: '/migrations' },
        ],
      },
      {
        text: 'Building with FerroCMS',
        items: [
          { text: 'Content modeling', link: '/content-modeling' },
          { text: 'API reference', link: '/api-reference' },
          { text: 'Plugin authoring', link: '/plugins' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/locateanup/FerroCMS' }],
    search: { provider: 'local' },
  },
});

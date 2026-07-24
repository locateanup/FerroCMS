/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Media served from the FerroCMS API (R2 in production, filesystem on
    // Node) — allow any host here and lock it down to your real CMS domain
    // once you deploy.
    remotePatterns: [{ protocol: 'http', hostname: '**' }, { protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;

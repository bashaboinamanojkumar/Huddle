/**
 * The service worker at `public/sw.js` is hand written so it never caches protected
 * routes, and `components/pwa/register-sw.tsx` registers it. A generator plugin here
 * would overwrite that file with one that caches navigations.
 */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {},
};

export default nextConfig;

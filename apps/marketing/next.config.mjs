/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages; the marketing site owns the site root
  // (the app lives at /app/, its own staging subtree in the deploy workflow).
  output: 'export',
  basePath: process.env.ONEMARK_BASE ?? '',
  images: { unoptimized: true },
};

export default nextConfig;

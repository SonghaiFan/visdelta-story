import { createMDX } from 'fumadocs-mdx/next';
const withMDX = createMDX();
const basePath = (process.env.STORY_BASE_PATH ?? '').replace(/\/$/, '');
const config = {
  output: 'export', trailingSlash: true, basePath, reactStrictMode: true,
  images: { unoptimized: true }, allowedDevOrigins: ['127.0.0.1'],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: { root: import.meta.dirname },
};

export default withMDX(config);

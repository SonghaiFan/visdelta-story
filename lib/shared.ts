import { createGetUrl } from 'fumadocs-core/source';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const visdeltaUrl = 'https://songhaifan.github.io/visdelta/';
export const siteUrl = (process.env.SITE_URL ?? 'https://songhaifan.github.io/visdelta-story').replace(/\/$/, '');
export const repositoryUrl = 'https://github.com/SonghaiFan/visdelta-story';
export const docsRoute = '/docs';
const getContentUrl = createGetUrl('/llms.mdx/docs');
export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  return { url: getContentUrl([...page.slugs, 'content.md'], page.locale) };
}
export function absoluteUrl(path: string) { return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`; }

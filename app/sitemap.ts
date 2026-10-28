import { source } from '@/lib/source';
import { absoluteUrl } from '@/lib/shared';
export const dynamic = 'force-static';
export default function sitemap() { return ['/', '/story/', ...source.getPages().map(page => page.url)].map(path => ({ url: absoluteUrl(path) })); }

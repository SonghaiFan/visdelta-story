import { source } from '@/lib/source';
import { absoluteUrl, getPageMarkdownUrl } from '@/lib/shared';
export const revalidate = false;
export function GET() {
  return new Response('# VisDelta Story\n\nIndependent MDX scrollytelling application using public VisDelta APIs.\n\n'+source.getPages().map(page => `- [${page.data.title}](${absoluteUrl(getPageMarkdownUrl(page).url)})`).join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

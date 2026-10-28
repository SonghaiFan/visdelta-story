import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
export const revalidate = false;
export function generateStaticParams() { return source.getPages().map(page => ({ slug: [...page.slugs, 'content.md'] })); }
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (slug.at(-1) !== 'content.md') notFound();
  const page = source.getPage(slug.slice(0, -1)); if (!page) notFound();
  return new Response(`# ${page.data.title}\n\n${await page.data.getText('processed')}`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}

import { source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, MarkdownCopyButton, ViewOptionsPopover } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { absoluteUrl, basePath, getPageMarkdownUrl, repositoryUrl } from '@/lib/shared';
export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params; const page = source.getPage(slug); if (!page) notFound();
  const MDX = page.data.body; const markdownUrl = `${basePath}${getPageMarkdownUrl(page).url}`;
  return <DocsPage toc={page.data.toc} full={page.data.full}>
    <DocsTitle>{page.data.title}</DocsTitle><DocsDescription>{page.data.description}</DocsDescription>
    <div className="mb-6 flex gap-2 border-b pb-4"><MarkdownCopyButton markdownUrl={markdownUrl} /><ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={`${repositoryUrl}/blob/main/content/docs/${page.path}`} /></div>
    <DocsBody><MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} /></DocsBody>
  </DocsPage>;
}
export function generateStaticParams() { return source.generateParams(); }
export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params; const page = source.getPage(slug); if (!page) notFound();
  return { title: `${page.data.title} · VisDelta Story`, description: page.data.description, alternates: { canonical: absoluteUrl(page.url) } };
}

import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout tree={source.getPageTree()} nav={{ title: 'Story Documentation', url: '/docs' }} links={[]} githubUrl={undefined} themeSwitch={{ enabled: false }}>{children}</DocsLayout>;
}

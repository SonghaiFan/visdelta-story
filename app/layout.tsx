import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { Provider } from '@/components/provider';
import { basePath } from '@/lib/shared';
import 'visdelta/style.css';
import './global.css';
export const metadata: Metadata = { title: 'VisDelta Story', description: 'Author interactive data stories with MDX and VisDelta.', icons: { icon: `${basePath}/visdelta-logo.svg` } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body className="flex min-h-screen flex-col font-sans"><Provider><SiteHeader />{children}</Provider></body></html>;
}

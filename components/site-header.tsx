import Link from 'next/link';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { Logo } from './logo';
import { visdeltaUrl } from '@/lib/shared';
export function SiteHeader() {
  return <header className="sticky top-0 z-40 flex h-11 shrink-0 items-center gap-3 border-b bg-fd-background px-3">
    <Link href="/story/" className="inline-flex items-center gap-2 text-sm font-semibold"><Logo className="h-4 w-auto" />VisDelta Story</Link>
    <nav aria-label="Main navigation" className="ml-auto flex items-center gap-3 text-xs">
      <Link href="/docs/">Docs</Link><a href="https://github.com/SonghaiFan/visdelta-story" className="hidden sm:inline">GitHub</a><a href={visdeltaUrl}>VisDelta ↗</a><ThemeSwitch />
    </nav>
  </header>;
}

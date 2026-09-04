/**
 * The public marketing site: navigation, footer, floating contact actions.
 * Everything a visitor sees. The admin and the portals sit outside this group
 * and inherit none of it.
 */

import { I18nProvider } from '@/components/site/i18n'
import { Navigation } from '@/components/site/navigation'
import { Footer } from '@/components/site/footer'
import { FloatingActions } from '@/components/site/floating-actions'
import { ScrollProgress } from '@/components/site/scroll-progress'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ScrollProgress />
      <Navigation />
      {children}
      <Footer />
      <FloatingActions />
    </I18nProvider>
  )
}

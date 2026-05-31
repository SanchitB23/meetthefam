import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

// Routes listed here that have no page yet (/about, /dmca, /childrens-privacy)
// are deferred to sibling issues under #56 but included now so the sitemap
// is complete at launch when those pages land. See issue #149.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/terms`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/contact`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/about`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/dmca`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/childrens-privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}

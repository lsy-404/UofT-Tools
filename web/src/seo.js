import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SITE_URL, SITE_NAME, absoluteUrl } from './site.js'

function jsonLd(route, url) {
  const meta = route.meta
  const graph = []
  if (route.path === '/') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: meta.description,
      inLanguage: 'en',
    })
  }
  if (meta.app) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: meta.app.name,
      url,
      description: meta.description,
      applicationCategory: meta.app.category,
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
    })
  }
  if (meta.crumb) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: meta.crumb, item: url },
      ],
    })
  }
  return graph
}

export function useSeoHead() {
  const route = useRoute()
  useHead(computed(() => {
    const meta = route.meta || {}
    const url = absoluteUrl(route.path.replace(/\/+$/, '') || '/')
    const indexable = !meta.noindex
    return {
      htmlAttrs: { lang: 'en' },
      title: meta.title,
      meta: [
        { name: 'description', content: meta.description },
        indexable ? null : { name: 'robots', content: 'noindex' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:title', content: meta.title },
        { property: 'og:description', content: meta.description },
        indexable ? { property: 'og:url', content: url } : null,
        { name: 'twitter:card', content: 'summary' },
      ].filter(Boolean),
      link: indexable ? [{ rel: 'canonical', href: url }] : [],
      script: indexable
        ? jsonLd(route, url).map((o) => ({ type: 'application/ld+json', innerHTML: JSON.stringify(o) }))
        : [],
    }
  }))
}

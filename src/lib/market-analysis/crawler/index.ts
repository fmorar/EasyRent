// ============================================================
// Crawler — routes a URL to the right adapter
//
// `crawlSource(url, opts)` returns:
//   • the chosen adapter's source name
//   • the URL type detected
//   • the raw CrawledListing[] extracted
//   • a `pagesScanned` count for the source row
// ============================================================

import { Encuentra24Adapter } from "./adapters/encuentra24"
import { MercadoLibreAdapter } from "./adapters/mercadolibre"
import { GenericListingAdapter } from "./adapters/generic-listing"
import type { CrawledListing } from "../types"
import type { RealEstateSourceAdapter } from "./adapters/base"

const ADAPTERS: RealEstateSourceAdapter[] = [
  Encuentra24Adapter,
  MercadoLibreAdapter,
  // Generic must be last — its canHandle returns true for everything.
  GenericListingAdapter,
]

export function pickAdapter(url: string): RealEstateSourceAdapter {
  for (const a of ADAPTERS) {
    if (a !== GenericListingAdapter && a.canHandle(url)) return a
  }
  return GenericListingAdapter
}

export interface CrawlResult {
  sourceName:    string
  urlType:       "listing_page" | "property_detail_page" | "unsupported"
  listings:      CrawledListing[]
  pagesScanned:  number
  error?:        string
}

export async function crawlSource(
  url: string,
  opts: { scanDepth: number; maxListings: number },
): Promise<CrawlResult> {
  const adapter = pickAdapter(url)
  const urlType = adapter.detectUrlType(url)

  if (urlType === "unsupported") {
    return {
      sourceName: adapter.sourceName,
      urlType,
      listings: [],
      pagesScanned: 0,
      error: "Unsupported URL type",
    }
  }

  try {
    if (urlType === "property_detail_page") {
      const one = await adapter.crawlPropertyDetailPage({
        url,
        userAgent: "re-platform-market-analysis/1.0",
      })
      return {
        sourceName:   adapter.sourceName,
        urlType,
        listings:     one ? [one] : [],
        pagesScanned: 1,
      }
    }

    const listings = await adapter.crawlListingPage({
      url,
      scanDepth:   opts.scanDepth,
      maxListings: opts.maxListings,
      userAgent:   "re-platform-market-analysis/1.0",
    })
    return {
      sourceName:   adapter.sourceName,
      urlType,
      listings,
      pagesScanned: Math.min(opts.scanDepth, Math.max(1, Math.ceil(listings.length / 30))),
    }
  } catch (err) {
    return {
      sourceName:   adapter.sourceName,
      urlType,
      listings:     [],
      pagesScanned: 0,
      error:        err instanceof Error ? err.message : "Unknown crawler error",
    }
  }
}

// ============================================================
// Adapter base — every source-specific adapter implements this.
//
// Adapters are PURE wrt I/O — they receive raw HTML or a URL and
// return CrawledListing[]. Network I/O is delegated to fetcher.ts
// so we can centralize robots.txt + rate limiting.
// ============================================================

import type { CrawledListing, CrawlListingInput, CrawlDetailInput } from "../../types"

export interface RealEstateSourceAdapter {
  sourceName:   string
  canHandle(url: string): boolean
  detectUrlType(url: string): "listing_page" | "property_detail_page" | "unsupported"
  crawlListingPage(input: CrawlListingInput): Promise<CrawledListing[]>
  crawlPropertyDetailPage(input: CrawlDetailInput): Promise<CrawledListing | null>
}

"use server"

import { parseSearchQuery, type ParsedSearch } from "@/lib/ai/search-parser"

/** Public server action — takes a free-form query, returns structured filters. */
export async function parseMarketplaceQuery(query: string): Promise<ParsedSearch> {
  return parseSearchQuery(query)
}

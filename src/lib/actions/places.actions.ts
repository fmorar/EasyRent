"use server"

import { findPlaceIdFromText } from "@/lib/google-places"

/**
 * Client-callable wrapper to resolve a free-text address to a Google
 * place_id. Returns null when no API key is configured or no match is found.
 */
export async function resolveGooglePlaceId(query: string): Promise<string | null> {
  return findPlaceIdFromText(query)
}

/**
 * Google Places — fetch reviews for a given Place ID.
 *
 * Uses the Place Details API (legacy v1 endpoint) which returns up to 5 of
 * the most relevant recent reviews. We cache via Next.js fetch-tag for 24h
 * since reviews don't churn often.
 *
 * Required env var: GOOGLE_PLACES_API_KEY
 */

export interface GoogleReview {
  author_name:        string
  author_url?:        string
  profile_photo_url?: string
  rating:             number
  relative_time:      string
  text:               string
}

export interface GooglePlaceSummary {
  rating?:            number
  user_ratings_total?:number
  reviews:            GoogleReview[]
}

export async function fetchGoogleReviews(
  placeId: string,
  locale:  string = "es",
): Promise<GooglePlaceSummary | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || !placeId) return null

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
  url.searchParams.set("place_id", placeId)
  url.searchParams.set("fields",   "rating,user_ratings_total,reviews")
  url.searchParams.set("language", locale)
  url.searchParams.set("key",      apiKey)

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 * 60 * 24 }, // 24h cache
    })
    if (!res.ok) return null

    const json = (await res.json()) as {
      status: string
      result?: {
        rating?:             number
        user_ratings_total?: number
        reviews?: Array<{
          author_name:           string
          author_url?:           string
          profile_photo_url?:    string
          rating:                number
          relative_time_description: string
          text:                  string
        }>
      }
    }

    if (json.status !== "OK" || !json.result) return null

    return {
      rating:             json.result.rating,
      user_ratings_total: json.result.user_ratings_total,
      reviews: (json.result.reviews ?? []).map((r) => ({
        author_name:       r.author_name,
        author_url:        r.author_url,
        profile_photo_url: r.profile_photo_url,
        rating:            r.rating,
        relative_time:     r.relative_time_description,
        text:              r.text,
      })),
    }
  } catch {
    return null
  }
}

/**
 * Resolve a free-text address (e.g. from our Nominatim autocomplete) to a
 * Google Places place_id using Find Place From Text. Returns null if no
 * confident match is found or no API key is configured.
 */
export async function findPlaceIdFromText(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || !query.trim()) return null

  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json")
  url.searchParams.set("input",     query)
  url.searchParams.set("inputtype", "textquery")
  url.searchParams.set("fields",    "place_id")
  url.searchParams.set("key",       apiKey)

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 * 60 * 24 * 7 }, // 7 days — addresses stable
    })
    if (!res.ok) return null

    const json = (await res.json()) as {
      status: string
      candidates?: Array<{ place_id?: string }>
    }

    if (json.status !== "OK" || !json.candidates?.length) return null
    return json.candidates[0]?.place_id ?? null
  } catch {
    return null
  }
}

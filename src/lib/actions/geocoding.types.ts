// Plain types extracted out of `geocoding.actions.ts` so a `"use server"`
// file doesn't have to ship interface exports — some Next bundler
// versions choke on non-function exports from action files.

export interface AddressSuggestion {
  id:              string
  /** Full address — stored as `exact_address`. */
  displayName:     string
  /** First segment — bold in the dropdown. */
  shortName:       string
  /** City / country — muted in the dropdown. */
  secondaryName:   string
  /** Neighbourhood + city + state, no street — stored as `public_address` in approximate mode. */
  approximateName: string
  lat:             number
  lng:             number
}

export interface GeocodeResult {
  approximateName: string
  lat:             number
  lng:             number
}

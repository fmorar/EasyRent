// ES → EN mapping for the canonical amenities we ship in the
// AmenitiesPicker, plus a few common free-form additions we've seen
// agents type. Lookup is case-insensitive on the source. Anything
// unknown falls through to the original name — better to show the
// Spanish label than nothing.

const ES_TO_EN: Record<string, string> = {
  // Common picker entries
  "piscina":              "Pool",
  "gimnasio":             "Gym",
  "seguridad 24/7":       "24/7 security",
  "acceso controlado":    "Controlled access",
  "parqueo de visitas":   "Visitor parking",
  "área de bbq":          "BBQ area",
  "area de bbq":          "BBQ area",
  "salón comunal":        "Community lounge",
  "salon comunal":        "Community lounge",
  "áreas verdes":         "Green areas",
  "areas verdes":         "Green areas",
  "juegos infantiles":    "Playground",
  "cancha deportiva":     "Sports court",
  "spa":                  "Spa",
  "sauna":                "Sauna",
  "lavandería":           "Laundry",
  "lavanderia":           "Laundry",
  "ascensor":             "Elevator",
  "casa club":            "Clubhouse",
  "co-working":           "Co-working",
  "coworking":            "Co-working",
  "pet-friendly":         "Pet-friendly",
  "pet friendly":         "Pet-friendly",
  "vista panorámica":     "Panoramic view",
  "vista panoramica":     "Panoramic view",
  "cerca de la playa":    "Near the beach",
  "aire acondicionado":   "Air conditioning",

  // Free-form additions we've observed
  "amueblado":            "Furnished",
  "balcón":               "Balcony",
  "balcon":               "Balcony",
  "terraza":              "Terrace",
  "jardín":               "Garden",
  "jardin":               "Garden",
  "cancha de tenis":      "Tennis court",
  "cancha de fútbol":     "Soccer field",
  "cancha de futbol":     "Soccer field",
  "cancha de pádel":      "Padel court",
  "cancha de padel":      "Padel court",
  "calentador de agua":   "Water heater",
  "agua caliente":        "Hot water",
  "internet":             "Internet",
  "wifi":                 "Wi-Fi",
  "cisterna":             "Water cistern",
  "planta eléctrica":     "Power generator",
  "planta electrica":     "Power generator",
  "alarma":               "Alarm system",
}

export function translateAmenity(name: string, locale: string): string {
  if (locale === "es") return name
  // Only EN is mapped today; fall back to the source for any other
  // locale until we add more dictionaries.
  if (locale !== "en") return name
  const hit = ES_TO_EN[name.trim().toLowerCase()]
  return hit ?? name
}

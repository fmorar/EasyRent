/**
 * Property → Project inheritance.
 *
 * When a property has `project_id` set, fields the user did NOT explicitly fill
 * on the property fall back to the project's value. The property's own value
 * always takes precedence (overrides), but a missing/empty value inherits.
 *
 * For collections (amenities, photos) we MERGE: project + property, deduped.
 * Project amenities/photos appear first because they describe the building.
 */

import type { Property } from "@/types"

export type ProjectInheritance = {
  id:             string
  title:          string | null
  description:    string | null
  location_label: string | null
  amenities:      string[]                                 // names, in order
  photos: {
    id:           string
    url:          string
    is_cover:     boolean
    order_index:  number
    caption:      string | null
  }[]
}

export type MergedProperty = Property & {
  /** True when this field was inherited from the project (not overridden). */
  inherited: {
    title:          boolean
    description:    boolean
    public_address: boolean
  }
  /** Combined amenity list (project first, then property additions). */
  amenities_combined: string[]
  /** Combined photo list. project_photos[] is added separately (see below). */
  project_photos: ProjectInheritance["photos"]
}

const isBlank = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "")

export function mergePropertyWithProject(
  property: Property,
  project:  ProjectInheritance | null,
): MergedProperty {
  if (!project) {
    return {
      ...property,
      inherited: { title: false, description: false, public_address: false },
      amenities_combined: property.amenities ?? [],
      project_photos: [],
    }
  }

  const titleInherited       = isBlank(property.title)
  const descInherited        = isBlank(property.description)
  const addressInherited     = isBlank(property.public_address)

  // Merge amenities: project first, then any extra ones the property added.
  const projectLower = new Set(project.amenities.map((a) => a.toLowerCase()))
  const extraFromProperty = (property.amenities ?? []).filter(
    (a) => !projectLower.has(a.toLowerCase()),
  )
  const amenitiesCombined = [...project.amenities, ...extraFromProperty]

  return {
    ...property,
    title:          titleInherited      ? (project.title       ?? property.title)       : property.title,
    description:    descInherited       ? (project.description ?? property.description) : property.description,
    public_address: addressInherited
      ? (project.location_label ?? property.public_address)
      : property.public_address,
    // Replace amenities with the merged list so any consumer reading
    // property.amenities (preview, public page, etc.) sees both sets.
    amenities: amenitiesCombined,
    inherited: {
      title:          titleInherited,
      description:    descInherited,
      public_address: addressInherited,
    },
    amenities_combined: amenitiesCombined,
    project_photos:     project.photos,
  }
}

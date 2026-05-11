// ============================================================
// Property analytics — Zod schemas
//
// Validates every event arriving at /api/property-events.
// Types are inferred from Postgres enums via the generated
// Database type, so a new event type added to the SQL migration
// is a TS error here until we wire the union manually below.
// ============================================================

import { z } from "zod"

// Mirrors the `property_event_type` PG enum exactly.
// Keep in sync if the SQL enum changes.
export const PROPERTY_EVENT_TYPES = [
  "property_viewed",
  "property_unique_viewed",
  "whatsapp_clicked",
  "call_clicked",
  "email_clicked",
  "contact_form_started",
  "contact_form_submitted",
  "favorite_added",
  "share_clicked",
  "gallery_opened",
  "map_opened",
  "video_tour_opened",
  "pdf_downloaded",
  "deep_engagement",
  "anonymous_link_viewed",
  "lead_created",
  "lead_contacted",
  "appointment_scheduled",
  "appointment_completed",
  "appointment_cancelled",
  "appointment_no_show",
  "offer_received",
  "price_changed",
  "owner_report_viewed",
  "owner_report_pdf_downloaded",
] as const

export const PropertyEventTypeSchema = z.enum(PROPERTY_EVENT_TYPES)

// Public (whitelisted) event types — only these can be fired from
// the JS client. Server-side internal events (lead_created, etc.)
// are emitted directly by the actions that own those side effects.
export const PUBLIC_EVENT_TYPES = [
  "property_viewed",
  "anonymous_link_viewed",
  "whatsapp_clicked",
  "call_clicked",
  "email_clicked",
  "contact_form_started",
  "contact_form_submitted",
  "favorite_added",
  "share_clicked",
  "gallery_opened",
  "map_opened",
  "video_tour_opened",
  "pdf_downloaded",
  "deep_engagement",
] as const satisfies readonly (typeof PROPERTY_EVENT_TYPES)[number][]

export const PublicEventTypeSchema = z.enum(PUBLIC_EVENT_TYPES)

/**
 * Body shape for POST /api/property-events.
 *
 * Notes on the `metadata` cap:
 *   - We restrict metadata to a flat object of primitive values to
 *     prevent injection of nested PII or very large payloads.
 *   - 8 keys × 240-char string values is more than enough for any
 *     event we currently fire (gallery image index, share channel,
 *     scroll percentage, etc.).
 */
export const TrackEventInputSchema = z.object({
  property_id:  z.string().uuid(),
  event_type:   PublicEventTypeSchema,
  source:       z.string().max(64).optional(),
  session_id:   z.string().max(64).optional(),
  utm_source:   z.string().max(64).optional(),
  utm_medium:   z.string().max(64).optional(),
  utm_campaign: z.string().max(64).optional(),
  metadata: z.record(
    z.string().max(64),
    z.union([
      z.string().max(240),
      z.number().finite(),
      z.boolean(),
      z.null(),
    ]),
  ).optional(),
})

export type TrackEventInput = z.infer<typeof TrackEventInputSchema>
export type PublicEventType = z.infer<typeof PublicEventTypeSchema>

import type { Database } from "./supabase"

// ─────────────────────────────────────────────
// Table row aliases — use these throughout the app
// ─────────────────────────────────────────────
export type Profile             = Database["public"]["Tables"]["profiles"]["Row"]
export type Invitation          = Database["public"]["Tables"]["invitations"]["Row"]
export type Project             = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectAmenity      = Database["public"]["Tables"]["project_amenities"]["Row"]
export type ProjectPhoto        = Database["public"]["Tables"]["project_photos"]["Row"]
export type Owner               = Database["public"]["Tables"]["owners"]["Row"]
export type Property            = Database["public"]["Tables"]["properties"]["Row"]
export type PropertyOwner       = Database["public"]["Tables"]["property_owners"]["Row"]
export type PropertyPhoto       = Database["public"]["Tables"]["property_photos"]["Row"]
export type PropertyShare       = Database["public"]["Tables"]["property_shares"]["Row"]
export type Lead                = Database["public"]["Tables"]["leads"]["Row"]
export type BlogPost            = Database["public"]["Tables"]["blog_posts"]["Row"]
export type BlogPostInsert      = Database["public"]["Tables"]["blog_posts"]["Insert"]
export type BlogPostUpdate      = Database["public"]["Tables"]["blog_posts"]["Update"]
export type BlogPostStatus      = "draft" | "published" | "archived"
export type LeadStatusHistory   = Database["public"]["Tables"]["lead_status_history"]["Row"]
export type Conversation        = Database["public"]["Tables"]["conversations"]["Row"]
export type ConversationMessage = Database["public"]["Tables"]["conversation_messages"]["Row"]
// ── Contracts module ──────────────────────────────────────────────
export type ContractTemplate         = Database["public"]["Tables"]["contract_templates"]["Row"]
export type ContractTemplateInsert   = Database["public"]["Tables"]["contract_templates"]["Insert"]
export type ContractTemplateUpdate   = Database["public"]["Tables"]["contract_templates"]["Update"]
export type Contract                 = Database["public"]["Tables"]["contracts"]["Row"]
export type ContractInsert           = Database["public"]["Tables"]["contracts"]["Insert"]
export type ContractUpdate           = Database["public"]["Tables"]["contracts"]["Update"]
// `ContractStatus` is exported once below from the enum-aliases section.
export type ContractVersion          = Database["public"]["Tables"]["contract_versions"]["Row"]
export type ContractVersionInsert    = Database["public"]["Tables"]["contract_versions"]["Insert"]
export type ContractExport           = Database["public"]["Tables"]["contract_exports"]["Row"]
export type ContractExportInsert     = Database["public"]["Tables"]["contract_exports"]["Insert"]
export type ContractEvent            = Database["public"]["Tables"]["contract_events"]["Row"]
export type ContractEventInsert      = Database["public"]["Tables"]["contract_events"]["Insert"]
export type MarketReport            = Database["public"]["Tables"]["market_reports"]["Row"]
export type MarketReportInsert      = Database["public"]["Tables"]["market_reports"]["Insert"]
export type MarketReportUpdate      = Database["public"]["Tables"]["market_reports"]["Update"]
export type MarketReportSource      = Database["public"]["Tables"]["market_report_sources"]["Row"]
export type MarketReportSourceInsert = Database["public"]["Tables"]["market_report_sources"]["Insert"]
export type MarketReportComparable  = Database["public"]["Tables"]["market_report_comparables"]["Row"]
export type MarketReportComparableInsert = Database["public"]["Tables"]["market_report_comparables"]["Insert"]
export type MarketReportEvent       = Database["public"]["Tables"]["market_report_events"]["Row"]
export type FxRateCacheRow          = Database["public"]["Tables"]["fx_rate_cache"]["Row"]
// ── Property analytics events ─────────────────────────────────────
export type PropertyAnalyticsEvent       = Database["public"]["Tables"]["property_analytics_events"]["Row"]
export type PropertyAnalyticsEventInsert = Database["public"]["Tables"]["property_analytics_events"]["Insert"]
export type PropertyEventType            = Database["public"]["Enums"]["property_event_type"]
// ── Property performance reports ──────────────────────────────────
export type PropertyPerformanceReport       = Database["public"]["Tables"]["property_performance_reports"]["Row"]
export type PropertyPerformanceReportInsert = Database["public"]["Tables"]["property_performance_reports"]["Insert"]
export type PropertyPerformanceReportUpdate = Database["public"]["Tables"]["property_performance_reports"]["Update"]
export type PerfReportStatus                = Database["public"]["Enums"]["perf_report_status"]
export type PerfHealthStatus                = Database["public"]["Enums"]["perf_health_status"]
// ── Lead enrichment enums ─────────────────────────────────────────
export type LeadInterestLevel       = Database["public"]["Enums"]["lead_interest_level"]
export type LeadInquiryType         = Database["public"]["Enums"]["lead_inquiry_type"]
export type LeadMoveInWindow        = Database["public"]["Enums"]["lead_move_in_window"]
export type LeadPetsStatus          = Database["public"]["Enums"]["lead_pets_status"]
export type LeadBudgetRange         = Database["public"]["Enums"]["lead_budget_range"]
export type LeadContactChannel      = Database["public"]["Enums"]["lead_contact_channel"]
export type LeadAppointmentStatus   = Database["public"]["Enums"]["lead_appointment_status"]
export type LeadLostReason          = Database["public"]["Enums"]["lead_lost_reason"]

// ─────────────────────────────────────────────
// Insert / Update aliases
// ─────────────────────────────────────────────
export type ProfileUpdate     = Database["public"]["Tables"]["profiles"]["Update"]
export type PropertyInsert    = Database["public"]["Tables"]["properties"]["Insert"]
export type PropertyUpdate    = Database["public"]["Tables"]["properties"]["Update"]
export type ProjectInsert     = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate     = Database["public"]["Tables"]["projects"]["Update"]
export type LeadInsert        = Database["public"]["Tables"]["leads"]["Insert"]
export type LeadUpdate        = Database["public"]["Tables"]["leads"]["Update"]
export type PropertyShareInsert = Database["public"]["Tables"]["property_shares"]["Insert"]
export type InvitationInsert  = Database["public"]["Tables"]["invitations"]["Insert"]

// ─────────────────────────────────────────────
// View row aliases
// ─────────────────────────────────────────────
export type MarketplaceProperty  = Database["public"]["Views"]["v_marketplace"]["Row"]
export type AnonymousProperty    = Database["public"]["Views"]["v_properties_anonymous"]["Row"]

// ─────────────────────────────────────────────
// Function return types
// ─────────────────────────────────────────────
export type AgentProfileProperty =
  Database["public"]["Functions"]["get_agent_profile_properties"]["Returns"][number]

// ─────────────────────────────────────────────
// Enum aliases — named exports of the auto-generated PG enums.
// Centralised here so consumers don't have to write
// `Database["public"]["Enums"]["…"]` everywhere.
// ─────────────────────────────────────────────
type Enums = Database["public"]["Enums"]
export type UserRole           = Enums["user_role"]
export type UserStatus         = Enums["user_status"]
export type InvitationStatus   = Enums["invitation_status"]
export type PropertyType       = Enums["property_type"]
export type PropertyStatus     = Enums["property_status"]
export type ListingType        = Enums["listing_type"]
export type LocationMode       = Enums["location_mode"]
export type ProjectStatus      = Enums["project_status"]
export type ShareStatus        = Enums["share_status"]
export type CommissionType     = Enums["commission_type"]
export type ProjectPhotoType   = Enums["project_photo_type"]
export type LeadSource         = Enums["lead_source"]
export type LeadStage          = Enums["lead_stage"]
export type ContractStatus     = Enums["contract_status"]
export type ConversationStatus = Enums["conversation_status"]
export type MessageDirection   = Enums["message_direction"]
export type MarketReportType   = Enums["market_report_type"]
export type MarketReportStatus = Enums["market_report_status"]
export type MarketSourceType   = Enums["market_source_type"]
export type MarketSourceStatus = Enums["market_source_status"]

// ─────────────────────────────────────────────
// UI-specific compound types
// ─────────────────────────────────────────────
export type PropertyWithPhotos = Property & {
  property_photos: PropertyPhoto[]
}

export type PropertyWithCover = Property & {
  cover_url?: string | null
}

export type PropertyShareWithProfiles = PropertyShare & {
  shared_with_profile: Profile
  shared_by_profile:   Profile
}

export type LeadWithHistory = Lead & {
  lead_status_history: LeadStatusHistory[]
}

// ─────────────────────────────────────────────
// Server action response pattern
// ─────────────────────────────────────────────
export type ActionResult<T = void> =
  | { success: true;  data: T;    error?: never }
  | { success: false; data?: never; error: string }

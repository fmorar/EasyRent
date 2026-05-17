export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          author_id: string
          body_html: string | null
          category: string | null
          cover_alt: string | null
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string | null
          id: string
          locale: string
          og_image_url: string | null
          published_at: string | null
          reading_minutes: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body_html?: string | null
          category?: string | null
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          id?: string
          locale?: string
          og_image_url?: string | null
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_html?: string | null
          category?: string | null
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          id?: string
          locale?: string
          og_image_url?: string | null
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          contract_id: string
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          message: string | null
          metadata: Json | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_exports: {
        Row: {
          contract_id: string
          export_type: string
          file_name: string
          file_path: string
          generated_at: string
          generated_by: string | null
          id: string
        }
        Insert: {
          contract_id: string
          export_type: string
          file_name: string
          file_path: string
          generated_at?: string
          generated_by?: string | null
          id?: string
        }
        Update: {
          contract_id?: string
          export_type?: string
          file_name?: string
          file_path?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_exports_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          contract_type: string
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          language: string
          name: string
          placeholder_schema: Json | null
          placeholder_schema_legacy: Json
          template_content: string
          updated_at: string
        }
        Insert: {
          contract_type: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: string
          name: string
          placeholder_schema?: Json | null
          placeholder_schema_legacy?: Json
          template_content: string
          updated_at?: string
        }
        Update: {
          contract_type?: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: string
          name?: string
          placeholder_schema?: Json | null
          placeholder_schema_legacy?: Json
          template_content?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          change_summary: string | null
          contract_data: Json | null
          contract_id: string
          created_at: string
          created_by: string | null
          editor_content_html: string | null
          editor_content_json: Json | null
          id: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          contract_data?: Json | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          editor_content_html?: string | null
          editor_content_json?: Json | null
          id?: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          contract_data?: Json | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          editor_content_html?: string | null
          editor_content_json?: Json | null
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_data: Json | null
          contract_number: string | null
          contract_type: string
          country: string
          created_at: string
          created_by: string
          deleted_at: string | null
          document_url: string | null
          docx_path: string | null
          editor_content_html: string | null
          editor_content_json: Json | null
          finalized_at: string | null
          generated_plain_text: string | null
          id: string
          language: string
          lead_id: string | null
          owner_id: string | null
          pdf_path: string | null
          property_id: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          storage_path: string | null
          template_id: string | null
          title: string | null
          updated_at: string
          variables_data: Json | null
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          contract_data?: Json | null
          contract_number?: string | null
          contract_type: string
          country?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          document_url?: string | null
          docx_path?: string | null
          editor_content_html?: string | null
          editor_content_json?: Json | null
          finalized_at?: string | null
          generated_plain_text?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          owner_id?: string | null
          pdf_path?: string | null
          property_id?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          storage_path?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string
          variables_data?: Json | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          contract_data?: Json | null
          contract_number?: string | null
          contract_type?: string
          country?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          document_url?: string | null
          docx_path?: string | null
          editor_content_html?: string | null
          editor_content_json?: Json | null
          finalized_at?: string | null
          generated_plain_text?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          owner_id?: string | null
          pdf_path?: string | null
          property_id?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          storage_path?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string
          variables_data?: Json | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_msg_id: string | null
          id: string
          media_url: string | null
          read_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_msg_id?: string | null
          id?: string
          media_url?: string | null
          read_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_msg_id?: string | null
          id?: string
          media_url?: string | null
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          created_at: string
          external_id: string | null
          id: string
          kind: string
          last_message_at: string | null
          lead_id: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          created_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          lead_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          created_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          lead_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_zones: {
        Row: {
          code: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_zones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_listings: {
        Row: {
          advertiser: Json | null
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          claimed_at: string | null
          claimed_by: string | null
          claimed_property_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          is_active: boolean
          is_claimed: boolean
          is_furnished: boolean | null
          last_seen_at: string
          listing_type: Database["public"]["Enums"]["listing_type"] | null
          location_text: string | null
          price: number | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          raw_extracted: Json | null
          scraped_at: string
          source_id: string | null
          source_name: string
          source_url: string
          title: string
          updated_at: string
        }
        Insert: {
          advertiser?: Json | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          claimed_at?: string | null
          claimed_by?: string | null
          claimed_property_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_claimed?: boolean
          is_furnished?: boolean | null
          last_seen_at?: string
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          location_text?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          raw_extracted?: Json | null
          scraped_at?: string
          source_id?: string | null
          source_name: string
          source_url: string
          title: string
          updated_at?: string
        }
        Update: {
          advertiser?: Json | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          claimed_at?: string | null
          claimed_by?: string | null
          claimed_property_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_claimed?: boolean
          is_furnished?: boolean | null
          last_seen_at?: string
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          location_text?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          raw_extracted?: Json | null
          scraped_at?: string
          source_id?: string | null
          source_name?: string
          source_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_listings_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listings_claimed_property_id_fkey"
            columns: ["claimed_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listings_claimed_property_id_fkey"
            columns: ["claimed_property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listings_claimed_property_id_fkey"
            columns: ["claimed_property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rate_cache: {
        Row: {
          date: string
          fetched_at: string
          source: string
          usd_to_crc: number
        }
        Insert: {
          date: string
          fetched_at?: string
          source: string
          usd_to_crc: number
        }
        Update: {
          date?: string
          fetched_at?: string
          source?: string
          usd_to_crc?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          zones: string[]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          zones?: string[]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          zones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: Database["public"]["Enums"]["lead_stage"] | null
          id: string
          lead_id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["lead_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          appointment_at: string | null
          appointment_notes: string | null
          appointment_status:
            | Database["public"]["Enums"]["lead_appointment_status"]
            | null
          assigned_to: string | null
          budget_range: Database["public"]["Enums"]["lead_budget_range"] | null
          captured_by: string | null
          contact_channel:
            | Database["public"]["Enums"]["lead_contact_channel"]
            | null
          created_at: string
          deleted_at: string | null
          email: string | null
          extracted_data: Json | null
          full_name: string
          has_pets: Database["public"]["Enums"]["lead_pets_status"] | null
          how_did_you_find: string | null
          id: string
          inquiry_type: Database["public"]["Enums"]["lead_inquiry_type"] | null
          interest_level: Database["public"]["Enums"]["lead_interest_level"]
          is_archived: boolean
          last_contacted_at: string | null
          lost_reason: Database["public"]["Enums"]["lead_lost_reason"] | null
          move_in_window:
            | Database["public"]["Enums"]["lead_move_in_window"]
            | null
          next_follow_up_at: string | null
          notes: string | null
          party_size: number | null
          phone: string | null
          phone_e164: string | null
          preferred_visit_at: string | null
          project_id: string | null
          property_id: string | null
          public_summary: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_context: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          visit_feedback: string | null
        }
        Insert: {
          appointment_at?: string | null
          appointment_notes?: string | null
          appointment_status?:
            | Database["public"]["Enums"]["lead_appointment_status"]
            | null
          assigned_to?: string | null
          budget_range?: Database["public"]["Enums"]["lead_budget_range"] | null
          captured_by?: string | null
          contact_channel?:
            | Database["public"]["Enums"]["lead_contact_channel"]
            | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          extracted_data?: Json | null
          full_name: string
          has_pets?: Database["public"]["Enums"]["lead_pets_status"] | null
          how_did_you_find?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["lead_inquiry_type"] | null
          interest_level?: Database["public"]["Enums"]["lead_interest_level"]
          is_archived?: boolean
          last_contacted_at?: string | null
          lost_reason?: Database["public"]["Enums"]["lead_lost_reason"] | null
          move_in_window?:
            | Database["public"]["Enums"]["lead_move_in_window"]
            | null
          next_follow_up_at?: string | null
          notes?: string | null
          party_size?: number | null
          phone?: string | null
          phone_e164?: string | null
          preferred_visit_at?: string | null
          project_id?: string | null
          property_id?: string | null
          public_summary?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_context?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          visit_feedback?: string | null
        }
        Update: {
          appointment_at?: string | null
          appointment_notes?: string | null
          appointment_status?:
            | Database["public"]["Enums"]["lead_appointment_status"]
            | null
          assigned_to?: string | null
          budget_range?: Database["public"]["Enums"]["lead_budget_range"] | null
          captured_by?: string | null
          contact_channel?:
            | Database["public"]["Enums"]["lead_contact_channel"]
            | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          extracted_data?: Json | null
          full_name?: string
          has_pets?: Database["public"]["Enums"]["lead_pets_status"] | null
          how_did_you_find?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["lead_inquiry_type"] | null
          interest_level?: Database["public"]["Enums"]["lead_interest_level"]
          is_archived?: boolean
          last_contacted_at?: string | null
          lost_reason?: Database["public"]["Enums"]["lead_lost_reason"] | null
          move_in_window?:
            | Database["public"]["Enums"]["lead_move_in_window"]
            | null
          next_follow_up_at?: string | null
          notes?: string | null
          party_size?: number | null
          phone?: string | null
          phone_e164?: string | null
          preferred_visit_at?: string | null
          project_id?: string | null
          property_id?: string | null
          public_summary?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_context?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          visit_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      market_report_comparables: {
        Row: {
          agent_or_company: string | null
          amenities: string[] | null
          bathrooms: number | null
          bedrooms: number | null
          built_area_m2: number | null
          canton: string | null
          confidence_score: number | null
          created_at: string
          currency: string | null
          description: string | null
          district: string | null
          exclusion_reason: string | null
          extracted_data: Json | null
          id: string
          is_featured: boolean
          is_outlier: boolean
          latitude: number | null
          listing_url: string | null
          location_text: string | null
          longitude: number | null
          lot_area_m2: number | null
          maintenance_fee: number | null
          neighborhood: string | null
          operation_type: string | null
          parking_spaces: number | null
          price: number | null
          price_crc: number | null
          price_per_m2: number | null
          price_usd: number | null
          property_type: string | null
          province: string | null
          raw_text: string | null
          report_id: string
          similarity_score: number | null
          source_id: string | null
          source_name: string | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          agent_or_company?: string | null
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_area_m2?: number | null
          canton?: string | null
          confidence_score?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          district?: string | null
          exclusion_reason?: string | null
          extracted_data?: Json | null
          id?: string
          is_featured?: boolean
          is_outlier?: boolean
          latitude?: number | null
          listing_url?: string | null
          location_text?: string | null
          longitude?: number | null
          lot_area_m2?: number | null
          maintenance_fee?: number | null
          neighborhood?: string | null
          operation_type?: string | null
          parking_spaces?: number | null
          price?: number | null
          price_crc?: number | null
          price_per_m2?: number | null
          price_usd?: number | null
          property_type?: string | null
          province?: string | null
          raw_text?: string | null
          report_id: string
          similarity_score?: number | null
          source_id?: string | null
          source_name?: string | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          agent_or_company?: string | null
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_area_m2?: number | null
          canton?: string | null
          confidence_score?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          district?: string | null
          exclusion_reason?: string | null
          extracted_data?: Json | null
          id?: string
          is_featured?: boolean
          is_outlier?: boolean
          latitude?: number | null
          listing_url?: string | null
          location_text?: string | null
          longitude?: number | null
          lot_area_m2?: number | null
          maintenance_fee?: number | null
          neighborhood?: string | null
          operation_type?: string | null
          parking_spaces?: number | null
          price?: number | null
          price_crc?: number | null
          price_per_m2?: number | null
          price_usd?: number | null
          property_type?: string | null
          province?: string | null
          raw_text?: string | null
          report_id?: string
          similarity_score?: number | null
          source_id?: string | null
          source_name?: string | null
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_report_comparables_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "market_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_report_comparables_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_report_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      market_report_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          report_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          report_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "market_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      market_report_public_views: {
        Row: {
          id: string
          ip_hash: string | null
          report_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          report_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          report_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_report_public_views_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "market_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      market_report_sources: {
        Row: {
          created_at: string
          detected_category: string | null
          error_message: string | null
          id: string
          listings_found: number
          metadata: Json
          pages_scanned: number
          raw_snapshot_path: string | null
          report_id: string
          source_name: string | null
          source_type: Database["public"]["Enums"]["market_source_type"] | null
          source_url: string
          status: Database["public"]["Enums"]["market_source_status"]
        }
        Insert: {
          created_at?: string
          detected_category?: string | null
          error_message?: string | null
          id?: string
          listings_found?: number
          metadata?: Json
          pages_scanned?: number
          raw_snapshot_path?: string | null
          report_id: string
          source_name?: string | null
          source_type?: Database["public"]["Enums"]["market_source_type"] | null
          source_url: string
          status?: Database["public"]["Enums"]["market_source_status"]
        }
        Update: {
          created_at?: string
          detected_category?: string | null
          error_message?: string | null
          id?: string
          listings_found?: number
          metadata?: Json
          pages_scanned?: number
          raw_snapshot_path?: string | null
          report_id?: string
          source_name?: string | null
          source_type?: Database["public"]["Enums"]["market_source_type"] | null
          source_url?: string
          status?: Database["public"]["Enums"]["market_source_status"]
        }
        Relationships: [
          {
            foreignKeyName: "market_report_sources_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "market_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      market_reports: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string
          currency: string
          error_message: string | null
          expires_at: string | null
          id: string
          metadata: Json
          owner_visible: boolean
          pdf_path: string | null
          property_id: string
          public_token: string | null
          recommended_price: number | null
          recommended_price_max: number | null
          recommended_price_min: number | null
          report_html: string | null
          report_json: Json | null
          report_locale: string
          report_type: Database["public"]["Enums"]["market_report_type"]
          status: Database["public"]["Enums"]["market_report_status"]
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by: string
          currency?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          owner_visible?: boolean
          pdf_path?: string | null
          property_id: string
          public_token?: string | null
          recommended_price?: number | null
          recommended_price_max?: number | null
          recommended_price_min?: number | null
          report_html?: string | null
          report_json?: Json | null
          report_locale?: string
          report_type: Database["public"]["Enums"]["market_report_type"]
          status?: Database["public"]["Enums"]["market_report_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          owner_visible?: boolean
          pdf_path?: string | null
          property_id?: string
          public_token?: string | null
          recommended_price?: number | null
          recommended_price_max?: number | null
          recommended_price_min?: number | null
          report_html?: string | null
          report_json?: Json | null
          report_locale?: string
          report_type?: Database["public"]["Enums"]["market_report_type"]
          status?: Database["public"]["Enums"]["market_report_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          locale: string
          source_context: string | null
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          locale?: string
          source_context?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          locale?: string
          source_context?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      owner_leads: {
        Row: {
          area_sqm: number | null
          assigned_to: string | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          email: string | null
          expected_price: number | null
          full_name: string
          id: string
          intent: Database["public"]["Enums"]["owner_lead_intent"]
          locale: string
          message: string | null
          notes: string | null
          phone: string
          property_type: string | null
          source_context: string | null
          status: Database["public"]["Enums"]["owner_lead_status"]
          updated_at: string
          zone: string | null
        }
        Insert: {
          area_sqm?: number | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          expected_price?: number | null
          full_name: string
          id?: string
          intent: Database["public"]["Enums"]["owner_lead_intent"]
          locale?: string
          message?: string | null
          notes?: string | null
          phone: string
          property_type?: string | null
          source_context?: string | null
          status?: Database["public"]["Enums"]["owner_lead_status"]
          updated_at?: string
          zone?: string | null
        }
        Update: {
          area_sqm?: number | null
          assigned_to?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          expected_price?: number | null
          full_name?: string
          id?: string
          intent?: Database["public"]["Enums"]["owner_lead_intent"]
          locale?: string
          message?: string | null
          notes?: string | null
          phone?: string
          property_type?: string | null
          source_context?: string | null
          status?: Database["public"]["Enums"]["owner_lead_status"]
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_outreach_attempts: {
        Row: {
          accepted_at: string | null
          channel: string
          claimed_property_id: string | null
          conversation_id: string | null
          created_at: string
          declined_at: string | null
          external_listing_id: string
          external_msg_id: string | null
          first_response_at: string | null
          id: string
          last_error: string | null
          search_request_id: string
          send_attempts: number
          sent_at: string | null
          status: string
          target_confidence: number | null
          target_name: string | null
          target_phone_e164: string
          target_role: string | null
          template_sid: string | null
          template_variables: Json | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          channel?: string
          claimed_property_id?: string | null
          conversation_id?: string | null
          created_at?: string
          declined_at?: string | null
          external_listing_id: string
          external_msg_id?: string | null
          first_response_at?: string | null
          id?: string
          last_error?: string | null
          search_request_id: string
          send_attempts?: number
          sent_at?: string | null
          status?: string
          target_confidence?: number | null
          target_name?: string | null
          target_phone_e164: string
          target_role?: string | null
          template_sid?: string | null
          template_variables?: Json | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          channel?: string
          claimed_property_id?: string | null
          conversation_id?: string | null
          created_at?: string
          declined_at?: string | null
          external_listing_id?: string
          external_msg_id?: string | null
          first_response_at?: string | null
          id?: string
          last_error?: string | null
          search_request_id?: string
          send_attempts?: number
          sent_at?: string | null
          status?: string
          target_confidence?: number | null
          target_name?: string | null
          target_phone_e164?: string
          target_role?: string | null
          template_sid?: string | null
          template_variables?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_outreach_attempts_claimed_property_id_fkey"
            columns: ["claimed_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_outreach_attempts_claimed_property_id_fkey"
            columns: ["claimed_property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_outreach_attempts_claimed_property_id_fkey"
            columns: ["claimed_property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_outreach_attempts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_outreach_attempts_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_outreach_attempts_search_request_id_fkey"
            columns: ["search_request_id"]
            isOneToOne: false
            referencedRelation: "search_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_report_public_views: {
        Row: {
          id: string
          ip_hash: string | null
          report_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          report_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          report_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_report_public_views_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "property_performance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          invited_by: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          slug: string
          status: Database["public"]["Enums"]["user_status"]
          tour_completed_at: string | null
          updated_at: string
          zones: string[]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          invited_by?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          slug: string
          status?: Database["public"]["Enums"]["user_status"]
          tour_completed_at?: string | null
          updated_at?: string
          zones?: string[]
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          slug?: string
          status?: Database["public"]["Enums"]["user_status"]
          tour_completed_at?: string | null
          updated_at?: string
          zones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_amenities: {
        Row: {
          icon: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_amenities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          project_id: string
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          project_id: string
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          project_id?: string
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_faqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_cover: boolean
          order_index: number
          project_id: string
          storage_path: string | null
          type: Database["public"]["Enums"]["project_photo_type"]
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          order_index?: number
          project_id: string
          storage_path?: string | null
          type?: Database["public"]["Enums"]["project_photo_type"]
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          order_index?: number
          project_id?: string
          storage_path?: string | null
          type?: Database["public"]["Enums"]["project_photo_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_shares: {
        Row: {
          created_at: string
          project_id: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          project_id: string
          shared_with: string
        }
        Update: {
          created_at?: string
          project_id?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_shares_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          available_units: number | null
          completion_date: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          developer_name: string | null
          forked_from: string | null
          google_place_id: string | null
          id: string
          is_active: boolean
          is_master_template: boolean
          is_public: boolean
          location_label: string | null
          slug: string
          status: Database["public"]["Enums"]["project_status"]
          title: string
          total_units: number | null
          updated_at: string
        }
        Insert: {
          available_units?: number | null
          completion_date?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          developer_name?: string | null
          forked_from?: string | null
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          is_master_template?: boolean
          is_public?: boolean
          location_label?: string | null
          slug: string
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          available_units?: number | null
          completion_date?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          developer_name?: string | null
          forked_from?: string | null
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          is_master_template?: boolean
          is_public?: boolean
          location_label?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          total_units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_forked_from_fkey"
            columns: ["forked_from"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          amenities: string[]
          anonymous_slug: string | null
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          description: string | null
          display_address: string | null
          display_lat: number | null
          display_lng: number | null
          exact_address: string | null
          exact_lat: number | null
          exact_lng: number | null
          floor: number | null
          id: string
          is_featured: boolean
          is_furnished: boolean
          is_marketplace_visible: boolean
          listing_type: Database["public"]["Enums"]["listing_type"]
          location_mode: Database["public"]["Enums"]["location_mode"]
          maintenance_fee: number | null
          owner_id: string | null
          parking_spaces: number | null
          price: number
          project_id: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          public_address: string | null
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          title: string
          total_floors: number | null
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          anonymous_slug?: string | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          display_address?: string | null
          display_lat?: number | null
          display_lng?: number | null
          exact_address?: string | null
          exact_lat?: number | null
          exact_lng?: number | null
          floor?: number | null
          id?: string
          is_featured?: boolean
          is_furnished?: boolean
          is_marketplace_visible?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location_mode?: Database["public"]["Enums"]["location_mode"]
          maintenance_fee?: number | null
          owner_id?: string | null
          parking_spaces?: number | null
          price: number
          project_id?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          public_address?: string | null
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          total_floors?: number | null
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          anonymous_slug?: string | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          display_address?: string | null
          display_lat?: number | null
          display_lng?: number | null
          exact_address?: string | null
          exact_lat?: number | null
          exact_lng?: number | null
          floor?: number | null
          id?: string
          is_featured?: boolean
          is_furnished?: boolean
          is_marketplace_visible?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location_mode?: Database["public"]["Enums"]["location_mode"]
          maintenance_fee?: number | null
          owner_id?: string | null
          parking_spaces?: number | null
          price?: number
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          public_address?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          total_floors?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      property_analytics_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["property_event_type"]
          id: string
          ip_hash: string | null
          is_bot: boolean
          lead_id: string | null
          metadata: Json
          property_id: string
          session_id: string | null
          source: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["property_event_type"]
          id?: string
          ip_hash?: string | null
          is_bot?: boolean
          lead_id?: string | null
          metadata?: Json
          property_id: string
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["property_event_type"]
          id?: string
          ip_hash?: string | null
          is_bot?: boolean
          lead_id?: string | null
          metadata?: Json
          property_id?: string
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_analytics_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_analytics_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_analytics_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_analytics_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          profile_id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          profile_id: string
          property_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          profile_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      property_performance_report_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          report_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          report_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_performance_report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "property_performance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      property_performance_reports: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          expires_at: string | null
          id: string
          last_generated_at: string | null
          metadata: Json
          owner_visible: boolean
          pdf_path: string | null
          performance_score: number | null
          performance_status:
            | Database["public"]["Enums"]["perf_health_status"]
            | null
          property_id: string
          public_token: string | null
          report_json: Json | null
          report_period_end: string | null
          report_period_start: string | null
          status: Database["public"]["Enums"]["perf_report_status"]
          summary: string | null
          updated_at: string
          visibility_settings: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          last_generated_at?: string | null
          metadata?: Json
          owner_visible?: boolean
          pdf_path?: string | null
          performance_score?: number | null
          performance_status?:
            | Database["public"]["Enums"]["perf_health_status"]
            | null
          property_id: string
          public_token?: string | null
          report_json?: Json | null
          report_period_end?: string | null
          report_period_start?: string | null
          status?: Database["public"]["Enums"]["perf_report_status"]
          summary?: string | null
          updated_at?: string
          visibility_settings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          last_generated_at?: string | null
          metadata?: Json
          owner_visible?: boolean
          pdf_path?: string | null
          performance_score?: number | null
          performance_status?:
            | Database["public"]["Enums"]["perf_health_status"]
            | null
          property_id?: string
          public_token?: string | null
          report_json?: Json | null
          report_period_end?: string | null
          report_period_start?: string | null
          status?: Database["public"]["Enums"]["perf_report_status"]
          summary?: string | null
          updated_at?: string
          visibility_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "property_performance_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_performance_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_performance_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_performance_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_cover: boolean
          order_index: number
          property_id: string
          storage_path: string | null
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          order_index?: number
          property_id: string
          storage_path?: string | null
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          order_index?: number
          property_id?: string
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      property_shares: {
        Row: {
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          property_id: string
          public_contact_user_id: string
          shared_by: string
          shared_with: string
          status: Database["public"]["Enums"]["share_status"]
          updated_at: string
        }
        Insert: {
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          property_id: string
          public_contact_user_id: string
          shared_by: string
          shared_with: string
          status?: Database["public"]["Enums"]["share_status"]
          updated_at?: string
        }
        Update: {
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          public_contact_user_id?: string
          shared_by?: string
          shared_with?: string
          status?: Database["public"]["Enums"]["share_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_shares_public_contact_user_id_fkey"
            columns: ["public_contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_shares_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_translations: {
        Row: {
          created_at: string
          description: string | null
          highlights: Json | null
          id: string
          locale: string
          property_id: string
          public_address: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seo_description: string | null
          seo_title: string | null
          source_hash: string | null
          status: string
          title: string | null
          translated_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          highlights?: Json | null
          id?: string
          locale: string
          property_id: string
          public_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: string | null
          seo_title?: string | null
          source_hash?: string | null
          status?: string
          title?: string | null
          translated_by?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          highlights?: Json | null
          id?: string
          locale?: string
          property_id?: string
          public_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: string | null
          seo_title?: string | null
          source_hash?: string | null
          status?: string
          title?: string | null
          translated_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_translations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_translations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_translations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_translations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_videos: {
        Row: {
          created_at: string
          id: string
          order_index: number
          property_id: string
          title: string | null
          youtube_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          property_id: string
          title?: string | null
          youtube_url: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          property_id?: string
          title?: string | null
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
        ]
      }
      search_requests: {
        Row: {
          candidates_count: number
          contacted_lead: boolean
          conversation_id: string | null
          created_at: string
          expired_at: string
          filters: Json
          fulfilled_at: string | null
          fulfilled_external_listing_id: string | null
          fulfilled_property_id: string | null
          id: string
          lead_id: string
          scrape_attempts: number
          scraped_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidates_count?: number
          contacted_lead?: boolean
          conversation_id?: string | null
          created_at?: string
          expired_at?: string
          filters: Json
          fulfilled_at?: string | null
          fulfilled_external_listing_id?: string | null
          fulfilled_property_id?: string | null
          id?: string
          lead_id: string
          scrape_attempts?: number
          scraped_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidates_count?: number
          contacted_lead?: boolean
          conversation_id?: string | null
          created_at?: string
          expired_at?: string
          filters?: Json
          fulfilled_at?: string | null
          fulfilled_external_listing_id?: string | null
          fulfilled_property_id?: string | null
          id?: string
          lead_id?: string
          scrape_attempts?: number
          scraped_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_requests_fulfilled_external_listing_id_fkey"
            columns: ["fulfilled_external_listing_id"]
            isOneToOne: false
            referencedRelation: "external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_requests_fulfilled_property_id_fkey"
            columns: ["fulfilled_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_requests_fulfilled_property_id_fkey"
            columns: ["fulfilled_property_id"]
            isOneToOne: false
            referencedRelation: "v_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_requests_fulfilled_property_id_fkey"
            columns: ["fulfilled_property_id"]
            isOneToOne: false
            referencedRelation: "v_properties_anonymous"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_marketplace: {
        Row: {
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          display_address: string | null
          display_lat: number | null
          display_lng: number | null
          floor: number | null
          id: string | null
          is_featured: boolean | null
          is_furnished: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type"] | null
          price: number | null
          project_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          slug: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          title: string | null
        }
        Insert: {
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_address?: string | null
          display_lat?: number | null
          display_lng?: number | null
          floor?: number | null
          id?: string | null
          is_featured?: boolean | null
          is_furnished?: boolean | null
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          price?: number | null
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          slug?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string | null
        }
        Update: {
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_address?: string | null
          display_lat?: number | null
          display_lng?: number | null
          floor?: number | null
          id?: string | null
          is_featured?: boolean | null
          is_furnished?: boolean | null
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          price?: number | null
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          slug?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_properties_anonymous: {
        Row: {
          amenities: string[] | null
          anonymous_slug: string | null
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          display_address: string | null
          display_lat: number | null
          display_lng: number | null
          floor: number | null
          id: string | null
          is_furnished: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type"] | null
          location_mode: Database["public"]["Enums"]["location_mode"] | null
          parking_spaces: number | null
          price: number | null
          project_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          status: Database["public"]["Enums"]["property_status"] | null
          title: string | null
          total_floors: number | null
        }
        Insert: {
          amenities?: string[] | null
          anonymous_slug?: string | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_address?: string | null
          display_lat?: number | null
          display_lng?: number | null
          floor?: number | null
          id?: string | null
          is_furnished?: boolean | null
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          location_mode?: Database["public"]["Enums"]["location_mode"] | null
          parking_spaces?: number | null
          price?: number | null
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string | null
          total_floors?: number | null
        }
        Update: {
          amenities?: string[] | null
          anonymous_slug?: string | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_address?: string | null
          display_lat?: number | null
          display_lng?: number | null
          floor?: number | null
          id?: string | null
          is_furnished?: boolean | null
          listing_type?: Database["public"]["Enums"]["listing_type"] | null
          location_mode?: Database["public"]["Enums"]["location_mode"] | null
          parking_spaces?: number | null
          price?: number | null
          project_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string | null
          total_floors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_agent_profile_properties: {
        Args: { p_agent_id: string }
        Returns: {
          area_sqm: number
          bathrooms: number
          bedrooms: number
          contact_user_id: string
          cover_url: string
          currency: string
          description: string
          display_address: string
          display_lat: number
          display_lng: number
          floor: number
          is_furnished: boolean
          is_own: boolean
          listing_type: Database["public"]["Enums"]["listing_type"]
          price: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          title: string
        }[]
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_public_market_report: { Args: { p_token: string }; Returns: Json }
      get_public_property_performance_report: {
        Args: { p_token: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_ancestor_creator: {
        Args: { candidate: string; p_project_id: string }
        Returns: boolean
      }
      is_in_my_network: { Args: { other_id: string }; Returns: boolean }
      is_owner_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_has_forked: { Args: { p_project_id: string }; Returns: boolean }
      user_has_share: { Args: { p_project_id: string }; Returns: boolean }
      user_owns_non_template: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      user_owns_project: { Args: { p_project_id: string }; Returns: boolean }
    }
    Enums: {
      blog_post_status: "draft" | "published" | "archived"
      commission_type: "percentage" | "fixed"
      contract_status:
        | "draft"
        | "sent"
        | "signed"
        | "voided"
        | "ready_for_review"
        | "finalized"
        | "archived"
      conversation_status: "open" | "closed" | "pending"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      lead_appointment_status:
        | "scheduled"
        | "completed"
        | "no_show"
        | "cancelled"
        | "pending"
      lead_budget_range:
        | "under_1000"
        | "between_1000_1500"
        | "between_1500_2000"
        | "between_2000_3000"
        | "above_3000"
      lead_contact_channel:
        | "whatsapp"
        | "phone"
        | "email"
        | "in_person"
        | "other"
      lead_inquiry_type: "availability" | "visit" | "info"
      lead_interest_level: "low" | "medium" | "high"
      lead_lost_reason:
        | "price_too_high"
        | "location_not_fit"
        | "pets_not_allowed"
        | "insufficient_parking"
        | "move_in_date_mismatch"
        | "budget_too_low"
        | "rented_or_bought_elsewhere"
        | "unresponsive"
        | "not_qualified"
        | "other"
      lead_move_in_window:
        | "immediate"
        | "one_month"
        | "one_to_three_months"
        | "three_to_six_months"
        | "browsing"
      lead_pets_status: "none" | "small_dog" | "large_dog" | "cat" | "multiple"
      lead_source:
        | "marketplace"
        | "agent_profile"
        | "project_page"
        | "anonymous_link"
        | "whatsapp"
        | "direct"
        | "referral"
      lead_stage:
        | "new"
        | "contacted"
        | "interested"
        | "visit_scheduled"
        | "negotiating"
        | "contract_requested"
        | "closed"
        | "lost"
      listing_type: "sale" | "rent"
      location_mode: "exact" | "approximate"
      market_report_status: "draft" | "processing" | "completed" | "failed"
      market_report_type: "sale" | "rent"
      market_source_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "unsupported"
      market_source_type:
        | "listing_page"
        | "property_detail_page"
        | "unsupported"
      message_direction: "inbound" | "outbound"
      owner_lead_intent: "sale" | "rent" | "both"
      owner_lead_status:
        | "new"
        | "contacted"
        | "valuation_scheduled"
        | "listed"
        | "declined"
        | "nurturing"
      perf_health_status:
        | "strong"
        | "healthy"
        | "needs_attention"
        | "low_activity"
      perf_report_status:
        | "draft"
        | "processing"
        | "active"
        | "archived"
        | "failed"
      project_photo_type: "hero" | "gallery" | "amenity"
      project_status:
        | "pre_launch"
        | "under_construction"
        | "completed"
        | "on_hold"
      property_event_type:
        | "property_viewed"
        | "property_unique_viewed"
        | "whatsapp_clicked"
        | "call_clicked"
        | "email_clicked"
        | "contact_form_started"
        | "contact_form_submitted"
        | "favorite_added"
        | "share_clicked"
        | "gallery_opened"
        | "map_opened"
        | "video_tour_opened"
        | "pdf_downloaded"
        | "deep_engagement"
        | "anonymous_link_viewed"
        | "lead_created"
        | "lead_contacted"
        | "appointment_scheduled"
        | "appointment_completed"
        | "appointment_cancelled"
        | "appointment_no_show"
        | "offer_received"
        | "price_changed"
        | "owner_report_viewed"
        | "owner_report_pdf_downloaded"
      property_status: "available" | "reserved" | "sold" | "off_market"
      property_type:
        | "apartment"
        | "house"
        | "land"
        | "commercial"
        | "office"
        | "warehouse"
      share_status: "pending" | "approved" | "rejected" | "revoked"
      user_role: "owner_admin" | "agent" | "super_admin"
      user_status: "active" | "inactive" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      blog_post_status: ["draft", "published", "archived"],
      commission_type: ["percentage", "fixed"],
      contract_status: [
        "draft",
        "sent",
        "signed",
        "voided",
        "ready_for_review",
        "finalized",
        "archived",
      ],
      conversation_status: ["open", "closed", "pending"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      lead_appointment_status: [
        "scheduled",
        "completed",
        "no_show",
        "cancelled",
        "pending",
      ],
      lead_budget_range: [
        "under_1000",
        "between_1000_1500",
        "between_1500_2000",
        "between_2000_3000",
        "above_3000",
      ],
      lead_contact_channel: [
        "whatsapp",
        "phone",
        "email",
        "in_person",
        "other",
      ],
      lead_inquiry_type: ["availability", "visit", "info"],
      lead_interest_level: ["low", "medium", "high"],
      lead_lost_reason: [
        "price_too_high",
        "location_not_fit",
        "pets_not_allowed",
        "insufficient_parking",
        "move_in_date_mismatch",
        "budget_too_low",
        "rented_or_bought_elsewhere",
        "unresponsive",
        "not_qualified",
        "other",
      ],
      lead_move_in_window: [
        "immediate",
        "one_month",
        "one_to_three_months",
        "three_to_six_months",
        "browsing",
      ],
      lead_pets_status: ["none", "small_dog", "large_dog", "cat", "multiple"],
      lead_source: [
        "marketplace",
        "agent_profile",
        "project_page",
        "anonymous_link",
        "whatsapp",
        "direct",
        "referral",
      ],
      lead_stage: [
        "new",
        "contacted",
        "interested",
        "visit_scheduled",
        "negotiating",
        "contract_requested",
        "closed",
        "lost",
      ],
      listing_type: ["sale", "rent"],
      location_mode: ["exact", "approximate"],
      market_report_status: ["draft", "processing", "completed", "failed"],
      market_report_type: ["sale", "rent"],
      market_source_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "unsupported",
      ],
      market_source_type: [
        "listing_page",
        "property_detail_page",
        "unsupported",
      ],
      message_direction: ["inbound", "outbound"],
      owner_lead_intent: ["sale", "rent", "both"],
      owner_lead_status: [
        "new",
        "contacted",
        "valuation_scheduled",
        "listed",
        "declined",
        "nurturing",
      ],
      perf_health_status: [
        "strong",
        "healthy",
        "needs_attention",
        "low_activity",
      ],
      perf_report_status: [
        "draft",
        "processing",
        "active",
        "archived",
        "failed",
      ],
      project_photo_type: ["hero", "gallery", "amenity"],
      project_status: [
        "pre_launch",
        "under_construction",
        "completed",
        "on_hold",
      ],
      property_event_type: [
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
      ],
      property_status: ["available", "reserved", "sold", "off_market"],
      property_type: [
        "apartment",
        "house",
        "land",
        "commercial",
        "office",
        "warehouse",
      ],
      share_status: ["pending", "approved", "rejected", "revoked"],
      user_role: ["owner_admin", "agent", "super_admin"],
      user_status: ["active", "inactive", "suspended"],
    },
  },
} as const

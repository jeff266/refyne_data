export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      compliance_alerts: {
        Row: {
          created_at: string | null
          harmony_threshold: number | null
          id: string
          notify_email: boolean | null
          notify_slack_webhook: string | null
          org_id: string
          score_threshold: number | null
          unprocessed_threshold: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          harmony_threshold?: number | null
          id?: string
          notify_email?: boolean | null
          notify_slack_webhook?: string | null
          org_id: string
          score_threshold?: number | null
          unprocessed_threshold?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          harmony_threshold?: number | null
          id?: string
          notify_email?: boolean | null
          notify_slack_webhook?: string | null
          org_id?: string
          score_threshold?: number | null
          unprocessed_threshold?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_insights: {
        Row: {
          created_at: string | null
          dismissed_at: string | null
          field: string | null
          harmony_id: string | null
          id: string
          insight_type: string
          message: string
          org_id: string
          record_count: number
          sample_values: Json | null
        }
        Insert: {
          created_at?: string | null
          dismissed_at?: string | null
          field?: string | null
          harmony_id?: string | null
          id?: string
          insight_type: string
          message: string
          org_id: string
          record_count: number
          sample_values?: Json | null
        }
        Update: {
          created_at?: string | null
          dismissed_at?: string | null
          field?: string | null
          harmony_id?: string | null
          id?: string
          insight_type?: string
          message?: string
          org_id?: string
          record_count?: number
          sample_values?: Json | null
        }
        Relationships: []
      }
      compliance_score_history: {
        Row: {
          compliant: number
          computed_at: string
          id: string
          org_id: string
          score: number
          stale: number
          total: number
          unprocessed: number
        }
        Insert: {
          compliant: number
          computed_at?: string
          id?: string
          org_id: string
          score: number
          stale: number
          total: number
          unprocessed: number
        }
        Update: {
          compliant?: number
          computed_at?: string
          id?: string
          org_id?: string
          score?: number
          stale?: number
          total?: number
          unprocessed?: number
        }
        Relationships: []
      }
      dedup_config: {
        Row: {
          archive_losing_record: boolean
          auto_merge_grade: string
          auto_merge_threshold: number
          bulk_survivorship: string
          core_display_fields: string[]
          created_at: string
          name_divergence_floor: number
          name_divergence_guard: boolean
          name_levenshtein_floor: number
          notify_on_auto_merge: boolean
          org_id: string
          parent_different_score: number
          parent_direct_action: string
          parent_one_multiplier: number
          parent_same_action: string
          review_floor_threshold: number
          rollback_window_hours: number
          scan_trigger: string
          signal_address_weight: number
          signal_name_weight: number
          signal_phone_weight: number
          stopwords: string[]
          survivorship_default: string
          transfer_associations: boolean
          updated_at: string
        }
        Insert: {
          archive_losing_record?: boolean
          auto_merge_grade?: string
          auto_merge_threshold?: number
          bulk_survivorship?: string
          core_display_fields?: string[]
          created_at?: string
          name_divergence_floor?: number
          name_divergence_guard?: boolean
          name_levenshtein_floor?: number
          notify_on_auto_merge?: boolean
          org_id: string
          parent_different_score?: number
          parent_direct_action?: string
          parent_one_multiplier?: number
          parent_same_action?: string
          review_floor_threshold?: number
          rollback_window_hours?: number
          scan_trigger?: string
          signal_address_weight?: number
          signal_name_weight?: number
          signal_phone_weight?: number
          stopwords?: string[]
          survivorship_default?: string
          transfer_associations?: boolean
          updated_at?: string
        }
        Update: {
          archive_losing_record?: boolean
          auto_merge_grade?: string
          auto_merge_threshold?: number
          bulk_survivorship?: string
          core_display_fields?: string[]
          created_at?: string
          name_divergence_floor?: number
          name_divergence_guard?: boolean
          name_levenshtein_floor?: number
          notify_on_auto_merge?: boolean
          org_id?: string
          parent_different_score?: number
          parent_direct_action?: string
          parent_one_multiplier?: number
          parent_same_action?: string
          review_floor_threshold?: number
          rollback_window_hours?: number
          scan_trigger?: string
          signal_address_weight?: number
          signal_name_weight?: number
          signal_phone_weight?: number
          stopwords?: string[]
          survivorship_default?: string
          transfer_associations?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      dedup_pairs: {
        Row: {
          confidence: number
          detected_at: string
          field_selections: Json | null
          grade: string
          id: string
          merged_at: string | null
          merged_by: string | null
          name_similarity: number | null
          org_id: string
          record_a_id: string
          record_b_id: string
          signals_fired: Json
          status: string
          suppression_rule_id: string | null
          surviving_record_id: string | null
          updated_at: string
        }
        Insert: {
          confidence: number
          detected_at?: string
          field_selections?: Json | null
          grade: string
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          name_similarity?: number | null
          org_id: string
          record_a_id: string
          record_b_id: string
          signals_fired?: Json
          status?: string
          suppression_rule_id?: string | null
          surviving_record_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number
          detected_at?: string
          field_selections?: Json | null
          grade?: string
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          name_similarity?: number | null
          org_id?: string
          record_a_id?: string
          record_b_id?: string
          signals_fired?: Json
          status?: string
          suppression_rule_id?: string | null
          surviving_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedup_pairs_suppression_rule_id_fkey"
            columns: ["suppression_rule_id"]
            isOneToOne: false
            referencedRelation: "dedup_suppression_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      dedup_suppression_rules: {
        Row: {
          action: string
          approver_user_id: string | null
          condition_operator: string
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          org_id: string
          priority: number
          suppressed_count: number
          ui_note: string | null
          updated_at: string
        }
        Insert: {
          action: string
          approver_user_id?: string | null
          condition_operator?: string
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          org_id: string
          priority: number
          suppressed_count?: number
          ui_note?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          approver_user_id?: string | null
          condition_operator?: string
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          org_id?: string
          priority?: number
          suppressed_count?: number
          ui_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      field_mappings: {
        Row: {
          canonical_field: string
          created_at: string | null
          direction: string
          hubspot_property: string
          id: string
          is_active: boolean | null
          org_id: string
          updated_at: string | null
          valid_values: Json | null
          write_policy: string
        }
        Insert: {
          canonical_field: string
          created_at?: string | null
          direction?: string
          hubspot_property: string
          id?: string
          is_active?: boolean | null
          org_id: string
          updated_at?: string | null
          valid_values?: Json | null
          write_policy?: string
        }
        Update: {
          canonical_field?: string
          created_at?: string | null
          direction?: string
          hubspot_property?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          updated_at?: string | null
          valid_values?: Json | null
          write_policy?: string
        }
        Relationships: []
      }
      hubspot_connections: {
        Row: {
          created_at: string | null
          encrypted_token: string
          has_export_scope: boolean
          id: string
          org_id: string
          portal_id: string
          rate_limit_per_10s: number | null
          scopes: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_token: string
          has_export_scope?: boolean
          id?: string
          org_id: string
          portal_id: string
          rate_limit_per_10s?: number | null
          scopes: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_token?: string
          has_export_scope?: boolean
          id?: string
          org_id?: string
          portal_id?: string
          rate_limit_per_10s?: number | null
          scopes?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      normalization_settings: {
        Row: {
          mode: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          mode?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          mode?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      normalized_records: {
        Row: {
          created_at: string | null
          field: string
          harmony_id: string | null
          harmony_version: string | null
          id: string
          normalized_at: string | null
          normalized_value: string | null
          org_id: string
          raw_value: string | null
          record_id: string
          record_type: string
          source: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          field: string
          harmony_id?: string | null
          harmony_version?: string | null
          id?: string
          normalized_at?: string | null
          normalized_value?: string | null
          org_id: string
          raw_value?: string | null
          record_id: string
          record_type: string
          source?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          field?: string
          harmony_id?: string | null
          harmony_version?: string | null
          id?: string
          normalized_at?: string | null
          normalized_value?: string | null
          org_id?: string
          raw_value?: string | null
          record_id?: string
          record_type?: string
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pipelines: {
        Row: {
          created_at: string | null
          harmony_ids: string[]
          id: string
          is_default: boolean | null
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string | null
          harmony_ids: string[]
          id?: string
          is_default?: boolean | null
          name: string
          org_id: string
        }
        Update: {
          created_at?: string | null
          harmony_ids?: string[]
          id?: string
          is_default?: boolean | null
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      provider_entity_cache: {
        Row: {
          canonical_data: Json
          created_at: string | null
          domain: string | null
          email: string | null
          entity_type: string
          hit_count: number
          id: string
          org_id: string
          provider: string
          provider_id: string
          raw_response: Json | null
          retrieved_at: string
          ttl_expires_at: string
        }
        Insert: {
          canonical_data: Json
          created_at?: string | null
          domain?: string | null
          email?: string | null
          entity_type: string
          hit_count?: number
          id?: string
          org_id: string
          provider: string
          provider_id: string
          raw_response?: Json | null
          retrieved_at?: string
          ttl_expires_at: string
        }
        Update: {
          canonical_data?: Json
          created_at?: string | null
          domain?: string | null
          email?: string | null
          entity_type?: string
          hit_count?: number
          id?: string
          org_id?: string
          provider?: string
          provider_id?: string
          raw_response?: Json | null
          retrieved_at?: string
          ttl_expires_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempt_number: number
          error_message: string | null
          event_type: string
          hubspot_event_id: string
          id: string
          object_id: string
          org_id: string
          portal_id: string
          processed_at: string | null
          property_name: string | null
          property_value: string | null
          received_at: string
          status: string
        }
        Insert: {
          attempt_number?: number
          error_message?: string | null
          event_type: string
          hubspot_event_id: string
          id?: string
          object_id: string
          org_id: string
          portal_id: string
          processed_at?: string | null
          property_name?: string | null
          property_value?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          attempt_number?: number
          error_message?: string | null
          event_type?: string
          hubspot_event_id?: string
          id?: string
          object_id?: string
          org_id?: string
          portal_id?: string
          processed_at?: string | null
          property_name?: string | null
          property_value?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_default_field_mappings: {
        Args: { p_org_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

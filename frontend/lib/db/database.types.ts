export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      normalization_runs: {
        Row: {
          completed_at: string | null
          connection_id: string
          error_message: string | null
          harmonies_applied: Json
          id: string
          initiated_by: string
          org_id: string
          records_changed: number
          records_failed: number
          records_scanned: number
          rollback_available: boolean
          rollback_expires_at: string
          rolled_back_at: string | null
          rolled_back_by: string | null
          scope: Json
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          error_message?: string | null
          harmonies_applied: Json
          id?: string
          initiated_by: string
          org_id: string
          records_changed?: number
          records_failed?: number
          records_scanned?: number
          rollback_available?: boolean
          rollback_expires_at: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          scope: Json
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          error_message?: string | null
          harmonies_applied?: Json
          id?: string
          initiated_by?: string
          org_id?: string
          records_changed?: number
          records_failed?: number
          records_scanned?: number
          rollback_available?: boolean
          rollback_expires_at?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          scope?: Json
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "normalization_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "hubspot_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      normalization_changes: {
        Row: {
          applied_at: string
          field_name: string
          harmony_id: string | null
          harmony_name: string | null
          hubspot_company_id: string
          id: string
          org_id: string
          rolled_back_at: string | null
          run_id: string
          status: string
          value_after: string | null
          value_before: string | null
        }
        Insert: {
          applied_at?: string
          field_name: string
          harmony_id?: string | null
          harmony_name?: string | null
          hubspot_company_id: string
          id?: string
          org_id: string
          rolled_back_at?: string | null
          run_id: string
          status?: string
          value_after?: string | null
          value_before?: string | null
        }
        Update: {
          applied_at?: string
          field_name?: string
          harmony_id?: string | null
          harmony_name?: string | null
          hubspot_company_id?: string
          id?: string
          org_id?: string
          rolled_back_at?: string | null
          run_id?: string
          status?: string
          value_after?: string | null
          value_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "normalization_changes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "normalization_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          org_id: string
          connected_hubspot: boolean
          viewed_dashboard: boolean
          viewed_dedup: boolean
          applied_harmony: boolean
          ran_normalize: boolean
          completed_at: string | null
          dismissed_at: string | null
          created_at: string
        }
        Insert: {
          org_id: string
          connected_hubspot?: boolean
          viewed_dashboard?: boolean
          viewed_dedup?: boolean
          applied_harmony?: boolean
          ran_normalize?: boolean
          completed_at?: string | null
          dismissed_at?: string | null
          created_at?: string
        }
        Update: {
          org_id?: string
          connected_hubspot?: boolean
          viewed_dashboard?: boolean
          viewed_dedup?: boolean
          applied_harmony?: boolean
          ran_normalize?: boolean
          completed_at?: string | null
          dismissed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      // ... other tables omitted for brevity
    }
    Functions: {
      expire_rollback_windows: { Args: never; Returns: undefined }
    }
  }
}

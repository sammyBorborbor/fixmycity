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
      crews: {
        Row: {
          available: boolean
          created_at: string
          department: Database["public"]["Enums"]["crew_department"]
          id: string
          lead_name: string
          member_count: number
          name: string
          phone: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          department: Database["public"]["Enums"]["crew_department"]
          id?: string
          lead_name?: string
          member_count?: number
          name: string
          phone?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["crew_department"]
          id?: string
          lead_name?: string
          member_count?: number
          name?: string
          phone?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: number
          read: boolean
          report_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: never
          read?: boolean
          report_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: never
          read?: boolean
          report_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          console_role: string | null
          created_at: string
          crew_id: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          settings: Json
          status: Database["public"]["Enums"]["profile_status"]
          unit: string | null
        }
        Insert: {
          console_role?: string | null
          created_at?: string
          crew_id?: string | null
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          unit?: string | null
        }
        Update: {
          console_role?: string | null
          created_at?: string
          crew_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_confidence: number | null
          ai_suggested_category:
            | Database["public"]["Enums"]["report_category"]
            | null
          assigned_crew_id: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          description: string
          detected_objects: Json | null
          duplicate_status: string | null
          embedding: string | null
          external_report_id: number | null
          id: string
          lat: number
          lng: number
          location: unknown
          location_name: string
          perceptual_hash: string | null
          photo_urls: string[]
          reference: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          ai_confidence?: number | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["report_category"]
            | null
          assigned_crew_id?: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at?: string
          description?: string
          detected_objects?: Json | null
          duplicate_status?: string | null
          embedding?: string | null
          external_report_id?: number | null
          id?: string
          lat?: number
          lng?: number
          location: unknown
          location_name: string
          perceptual_hash?: string | null
          photo_urls?: string[]
          reference?: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          ai_confidence?: number | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["report_category"]
            | null
          assigned_crew_id?: string | null
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          description?: string
          detected_objects?: Json | null
          duplicate_status?: string | null
          embedding?: string | null
          external_report_id?: number | null
          id?: string
          lat?: number
          lng?: number
          location?: unknown
          location_name?: string
          perceptual_hash?: string | null
          photo_urls?: string[]
          reference?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_crew_id_fkey"
            columns: ["assigned_crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_transitions: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          duplicate_of_report_id: string | null
          from_status: Database["public"]["Enums"]["report_status"] | null
          id: number
          note: string | null
          report_id: string
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          duplicate_of_report_id?: string | null
          from_status?: Database["public"]["Enums"]["report_status"] | null
          id?: never
          note?: string | null
          report_id: string
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          duplicate_of_report_id?: string | null
          from_status?: Database["public"]["Enums"]["report_status"] | null
          id?: never
          note?: string | null
          report_id?: string
          to_status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_transitions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_duplicate_of_report_id_fkey"
            columns: ["duplicate_of_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_duplicate_candidates: {
        Args: {
          p_days?: number
          p_limit?: number
          p_radius_m?: number
          p_report_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          distance_m: number
          id: string
          location_name: string
          photo_path: string
          reference: string
          similarity: number
          status: Database["public"]["Enums"]["report_status"]
        }[]
      }
    }
    Enums: {
      crew_department: "sanitation" | "drainage" | "electrical"
      profile_status: "active" | "suspended"
      report_category: "dumping" | "drain" | "streetlight"
      report_status:
        | "submitted"
        | "acknowledged"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "rejected"
        | "reopened"
      user_role: "citizen" | "officer" | "crew" | "admin"
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
      crew_department: ["sanitation", "drainage", "electrical"],
      profile_status: ["active", "suspended"],
      report_category: ["dumping", "drain", "streetlight"],
      report_status: [
        "submitted",
        "acknowledged",
        "assigned",
        "in_progress",
        "resolved",
        "rejected",
        "reopened",
      ],
      user_role: ["citizen", "officer", "crew", "admin"],
    },
  },
} as const

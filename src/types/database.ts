export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cert_types: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          cert_type_id: string | null
          cost: number | null
          created_at: string
          est_hours: number | null
          id: string
          level: string | null
          name: string
          provider_id: string | null
          refundable: boolean
          updated_at: string
          url: string | null
          validity_months: number | null
        }
        Insert: {
          cert_type_id?: string | null
          cost?: number | null
          created_at?: string
          est_hours?: number | null
          id?: string
          level?: string | null
          name: string
          provider_id?: string | null
          refundable?: boolean
          updated_at?: string
          url?: string | null
          validity_months?: number | null
        }
        Update: {
          cert_type_id?: string | null
          cost?: number | null
          created_at?: string
          est_hours?: number | null
          id?: string
          level?: string | null
          name?: string
          provider_id?: string | null
          refundable?: boolean
          updated_at?: string
          url?: string | null
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_cert_type_id_fkey"
            columns: ["cert_type_id"]
            isOneToOne: false
            referencedRelation: "cert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          committed_at: string | null
          created_at: string
          created_by: string | null
          expected_rows: number
          file_name: string
          id: string
          notes: Json
          sheet_name: string | null
          status: Database["public"]["Enums"]["import_batch_status"]
          summary: Json | null
          updated_at: string
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_rows: number
          file_name: string
          id?: string
          notes?: Json
          sheet_name?: string | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          summary?: Json | null
          updated_at?: string
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_rows?: number
          file_name?: string
          id?: string
          notes?: Json
          sheet_name?: string | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          summary?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          action: Database["public"]["Enums"]["import_action"]
          batch_id: string
          errors: Json
          id: string
          normalized: Json | null
          raw: Json
          row_no: number
          warnings: Json
        }
        Insert: {
          action: Database["public"]["Enums"]["import_action"]
          batch_id: string
          errors?: Json
          id?: string
          normalized?: Json | null
          raw: Json
          row_no: number
          warnings?: Json
        }
        Update: {
          action?: Database["public"]["Enums"]["import_action"]
          batch_id?: string
          errors?: Json
          id?: string
          normalized?: Json | null
          raw?: Json
          row_no?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          code: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          team_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          member_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          dc_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dc_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dc_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_dc_id_fkey"
            columns: ["dc_id"]
            isOneToOne: false
            referencedRelation: "dcs"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_managers: {
        Row: {
          team_id: string
          user_id: string
        }
        Insert: {
          team_id: string
          user_id: string
        }
        Update: {
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_managers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          certificate_url: string | null
          course_id: string
          created_at: string
          created_by: string | null
          evidence_path: string | null
          id: string
          issued_date: string | null
          member_id: string
          notes: string | null
          planned_exam_date: string | null
          progress: number
          progress_updated_at: string
          refund_status: Database["public"]["Enums"]["refund_status"]
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          via_company: boolean
        }
        Insert: {
          certificate_url?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          evidence_path?: string | null
          id?: string
          issued_date?: string | null
          member_id: string
          notes?: string | null
          planned_exam_date?: string | null
          progress?: number
          progress_updated_at?: string
          refund_status?: Database["public"]["Enums"]["refund_status"]
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          via_company?: boolean
        }
        Update: {
          certificate_url?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          evidence_path?: string | null
          id?: string
          issued_date?: string | null
          member_id?: string
          notes?: string | null
          planned_exam_date?: string | null
          progress?: number
          progress_updated_at?: string
          refund_status?: Database["public"]["Enums"]["refund_status"]
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          via_company?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "training_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_training_records: {
        Row: {
          cert_type_id: string | null
          cert_type_name: string | null
          certificate_url: string | null
          course_id: string | null
          course_name: string | null
          created_at: string | null
          created_by: string | null
          days_to_expiry: number | null
          evidence_path: string | null
          expiry_date: string | null
          expiry_status: string | null
          id: string | null
          issued_date: string | null
          member_code: string | null
          member_email: string | null
          member_id: string | null
          member_name: string | null
          notes: string | null
          planned_exam_date: string | null
          progress: number | null
          progress_updated_at: string | null
          provider_id: string | null
          provider_name: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          status: Database["public"]["Enums"]["record_status"] | null
          team_id: string | null
          team_name: string | null
          updated_at: string | null
          validity_months: number | null
          via_company: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_cert_type_id_fkey"
            columns: ["cert_type_id"]
            isOneToOne: false
            referencedRelation: "cert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      can_access_evidence: { Args: { object_name: string }; Returns: boolean }
      commit_import: { Args: { p_batch_id: string }; Returns: Json }
      expiry_status: {
        Args: { p_issued: string; p_today: string; p_validity_months: number }
        Returns: string
      }
      format_member_code: { Args: { n: number }; Returns: string }
      managed_member_ids: { Args: never; Returns: string[] }
      managed_team_ids: { Args: never; Returns: string[] }
      my_member_id: { Args: never; Returns: string }
      next_member_code: { Args: never; Returns: string }
      vn_today: { Args: never; Returns: string }
    }
    Enums: {
      import_action: "create" | "update" | "skip"
      import_batch_status: "parsed" | "committed" | "discarded"
      record_status: "not_started" | "in_progress" | "done"
      refund_status: "n_a" | "pending" | "approved" | "rejected" | "paid"
      user_role: "admin" | "manager" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      import_action: ["create", "update", "skip"],
      import_batch_status: ["parsed", "committed", "discarded"],
      record_status: ["not_started", "in_progress", "done"],
      refund_status: ["n_a", "pending", "approved", "rejected", "paid"],
      user_role: ["admin", "manager", "member"],
    },
  },
} as const


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
      catalog_stats: {
        Row: {
          by_cat: Json
          by_country: Json
          by_src: Json
          count: number
          featured: number
          generated_at: string
          id: boolean
          series_count: number
          top_tags: Json
        }
        Insert: {
          by_cat?: Json
          by_country?: Json
          by_src?: Json
          count?: number
          featured?: number
          generated_at?: string
          id?: boolean
          series_count?: number
          top_tags?: Json
        }
        Update: {
          by_cat?: Json
          by_country?: Json
          by_src?: Json
          count?: number
          featured?: number
          generated_at?: string
          id?: boolean
          series_count?: number
          top_tags?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          blurb: string
          enabled: boolean
          label: string
          slug: string
          sort: number
        }
        Insert: {
          blurb?: string
          enabled?: boolean
          label: string
          slug: string
          sort?: number
        }
        Update: {
          blurb?: string
          enabled?: boolean
          label?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      enrichment_jobs: {
        Row: {
          attempts: number
          event_id: string
          id: number
          kind: string
          last_error: string | null
          next_attempt_at: string
          status: string
        }
        Insert: {
          attempts?: number
          event_id: string
          id?: never
          kind: string
          last_error?: string | null
          next_attempt_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          event_id?: string
          id?: never
          kind?: string
          last_error?: string | null
          next_attempt_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slugs: {
        Row: {
          created_at: string
          event_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          event_id: string
          slug: string
        }
        Update: {
          created_at?: string
          event_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_slugs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_slugs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          content_hash: string
          event_id: string
          first_seen_at: string
          last_seen_at: string
          raw: Json | null
          source: string
          source_key: string
          source_url: string | null
        }
        Insert: {
          content_hash: string
          event_id: string
          first_seen_at?: string
          last_seen_at?: string
          raw?: Json | null
          source: string
          source_key: string
          source_url?: string | null
        }
        Update: {
          content_hash?: string
          event_id?: string
          first_seen_at?: string
          last_seen_at?: string
          raw?: Json | null
          source?: string
          source_key?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          category: string
          confidence: number
          content_hash: string | null
          date: string
          date_history: Json
          date_precision: string
          description: string
          end_date: string | null
          external_ids: Json
          featured: boolean
          first_seen_at: string
          id: string
          image_candidate_meta: Json | null
          image_candidate_url: string | null
          image_id: string | null
          image_status: string
          indexable: boolean
          jsonld_eligible: boolean
          last_seen_at: string
          location: Json | null
          period_end: string
          popularity: number
          published: boolean
          regions: string[]
          search: unknown
          series_slug: string | null
          slug: string
          sort_at: string
          source: string
          source_key: string
          source_url: string | null
          starts_at: string
          starts_on: string
          status: string
          summary: string | null
          tags: string[]
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          category: string
          confidence?: number
          content_hash?: string | null
          date: string
          date_history?: Json
          date_precision?: string
          description?: string
          end_date?: string | null
          external_ids?: Json
          featured?: boolean
          first_seen_at?: string
          id: string
          image_candidate_meta?: Json | null
          image_candidate_url?: string | null
          image_id?: string | null
          image_status?: string
          indexable?: boolean
          jsonld_eligible?: boolean
          last_seen_at?: string
          location?: Json | null
          period_end: string
          popularity?: number
          published?: boolean
          regions?: string[]
          search?: unknown
          series_slug?: string | null
          slug: string
          sort_at: string
          source: string
          source_key: string
          source_url?: string | null
          starts_at: string
          starts_on: string
          status?: string
          summary?: string | null
          tags?: string[]
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          category?: string
          confidence?: number
          content_hash?: string | null
          date?: string
          date_history?: Json
          date_precision?: string
          description?: string
          end_date?: string | null
          external_ids?: Json
          featured?: boolean
          first_seen_at?: string
          id?: string
          image_candidate_meta?: Json | null
          image_candidate_url?: string | null
          image_id?: string | null
          image_status?: string
          indexable?: boolean
          jsonld_eligible?: boolean
          last_seen_at?: string
          location?: Json | null
          period_end?: string
          popularity?: number
          published?: boolean
          regions?: string[]
          search?: unknown
          series_slug?: string | null
          slug?: string
          sort_at?: string
          source?: string
          source_key?: string
          source_url?: string | null
          starts_at?: string
          starts_on?: string
          status?: string
          summary?: string | null
          tags?: string[]
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_slug_fkey"
            columns: ["series_slug"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_series_slug_fkey"
            columns: ["series_slug"]
            isOneToOne: false
            referencedRelation: "series_next"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          attribution_required: boolean
          author: string | null
          created_at: string
          credit: string
          dominant_color: string | null
          height: number
          id: string
          last_checked_at: string | null
          license: string
          license_url: string | null
          origin_page: string | null
          origin_url: string
          provider: string
          public_url: string
          sha256: string
          storage_path: string
          thumbhash: string | null
          width: number
        }
        Insert: {
          attribution_required?: boolean
          author?: string | null
          created_at?: string
          credit: string
          dominant_color?: string | null
          height: number
          id?: string
          last_checked_at?: string | null
          license: string
          license_url?: string | null
          origin_page?: string | null
          origin_url: string
          provider: string
          public_url: string
          sha256: string
          storage_path: string
          thumbhash?: string | null
          width: number
        }
        Update: {
          attribution_required?: boolean
          author?: string | null
          created_at?: string
          credit?: string
          dominant_color?: string | null
          height?: number
          id?: string
          last_checked_at?: string | null
          license?: string
          license_url?: string | null
          origin_page?: string | null
          origin_url?: string
          provider?: string
          public_url?: string
          sha256?: string
          storage_path?: string
          thumbhash?: string | null
          width?: number
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          cursor_out: Json | null
          drifted: number
          duration_ms: number | null
          errors: Json
          fetched: number
          finished_at: string | null
          id: number
          inserted: number
          source: string
          started_at: string
          status: string
          trigger: string
          unchanged: number
          updated: number
        }
        Insert: {
          cursor_out?: Json | null
          drifted?: number
          duration_ms?: number | null
          errors?: Json
          fetched?: number
          finished_at?: string | null
          id?: never
          inserted?: number
          source: string
          started_at?: string
          status?: string
          trigger?: string
          unchanged?: number
          updated?: number
        }
        Update: {
          cursor_out?: Json | null
          drifted?: number
          duration_ms?: number | null
          errors?: Json
          fetched?: number
          finished_at?: string | null
          id?: never
          inserted?: number
          source?: string
          started_at?: string
          status?: string
          trigger?: string
          unchanged?: number
          updated?: number
        }
        Relationships: []
      }
      ingest_state: {
        Row: {
          backoff_until: string | null
          consecutive_failures: number
          cursor: Json | null
          last_success_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          pass_started_at: string | null
          source: string
          updated_at: string
        }
        Insert: {
          backoff_until?: string | null
          consecutive_failures?: number
          cursor?: Json | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          pass_started_at?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          backoff_until?: string | null
          consecutive_failures?: number
          cursor?: Json | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          pass_started_at?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_log: {
        Row: {
          at: string
          id: number
          q: string
          results: number
        }
        Insert: {
          at?: string
          id?: never
          q: string
          results: number
        }
        Update: {
          at?: string
          id?: never
          q?: string
          results?: number
        }
        Relationships: []
      }
      series: {
        Row: {
          category: string
          created_at: string
          description: string
          faq: Json
          featured: boolean
          image_id: string | null
          popularity: number
          published: boolean
          recurrence: Json | null
          regions: string[]
          slug: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          wikidata_qid: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          faq?: Json
          featured?: boolean
          image_id?: string | null
          popularity?: number
          published?: boolean
          recurrence?: Json | null
          regions?: string[]
          slug: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          wikidata_qid?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          faq?: Json
          featured?: boolean
          image_id?: string | null
          popularity?: number
          published?: boolean
          recurrence?: Json | null
          regions?: string[]
          slug?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          wikidata_qid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "series_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      series_aliases: {
        Row: {
          alias: string
          series_slug: string
        }
        Insert: {
          alias: string
          series_slug: string
        }
        Update: {
          alias?: string
          series_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_aliases_series_slug_fkey"
            columns: ["series_slug"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "series_aliases_series_slug_fkey"
            columns: ["series_slug"]
            isOneToOne: false
            referencedRelation: "series_next"
            referencedColumns: ["slug"]
          },
        ]
      }
      sources: {
        Row: {
          attribution: string | null
          enabled: boolean
          homepage: string | null
          id: string
          label: string
          license: string | null
          rank: number
        }
        Insert: {
          attribution?: string | null
          enabled?: boolean
          homepage?: string | null
          id: string
          label: string
          license?: string | null
          rank?: number
        }
        Update: {
          attribution?: string | null
          enabled?: boolean
          homepage?: string | null
          id?: string
          label?: string
          license?: string | null
          rank?: number
        }
        Relationships: []
      }
    }
    Views: {
      events_public: {
        Row: {
          all_day: boolean | null
          category: string | null
          date: string | null
          date_history: Json | null
          date_precision: string | null
          days_until: number | null
          description: string | null
          end_date: string | null
          external_ids: Json | null
          featured: boolean | null
          id: string | null
          image: Json | null
          indexable: boolean | null
          jsonld_eligible: boolean | null
          last_seen_at: string | null
          location: Json | null
          period_end: string | null
          popularity: number | null
          regions: string[] | null
          series_slug: string | null
          series_title: string | null
          slug: string | null
          sort_at: string | null
          source: string | null
          source_label: string | null
          source_url: string | null
          starts_at: string | null
          starts_on: string | null
          status: string | null
          summary: string | null
          tags: string[] | null
          timezone: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_series_slug_fkey"
            columns: ["series_slug"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_series_slug_fkey"
            columns: ["series_slug"]
            isOneToOne: false
            referencedRelation: "series_next"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      series_next: {
        Row: {
          category: string | null
          created_at: string | null
          days_until: number | null
          description: string | null
          faq: Json | null
          featured: boolean | null
          image_id: string | null
          next_all_day: boolean | null
          next_date: string | null
          next_precision: string | null
          next_slug: string | null
          popularity: number | null
          published: boolean | null
          recurrence: Json | null
          regions: string[] | null
          slug: string | null
          summary: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          wikidata_qid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "series_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_source_lease: {
        Args: { p_source: string; p_ttl?: string }
        Returns: string
      }
      category_counts: {
        Args: never
        Returns: {
          category: string
          n: number
        }[]
      }
      claim_enrichment_jobs: {
        Args: { p_kind: string; p_limit?: number }
        Returns: {
          attempts: number
          event_id: string
          id: number
          kind: string
          last_error: string | null
          next_attempt_at: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "enrichment_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      featured_upcoming: {
        Args: { p_limit?: number }
        Returns: {
          all_day: boolean | null
          category: string | null
          date: string | null
          date_history: Json | null
          date_precision: string | null
          days_until: number | null
          description: string | null
          end_date: string | null
          external_ids: Json | null
          featured: boolean | null
          id: string | null
          image: Json | null
          indexable: boolean | null
          jsonld_eligible: boolean | null
          last_seen_at: string | null
          location: Json | null
          period_end: string | null
          popularity: number | null
          regions: string[] | null
          series_slug: string | null
          series_title: string | null
          slug: string | null
          sort_at: string | null
          source: string | null
          source_label: string | null
          source_url: string | null
          starts_at: string | null
          starts_on: string | null
          status: string | null
          summary: string | null
          tags: string[] | null
          timezone: string | null
          title: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "events_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finalize_catalog: { Args: never; Returns: undefined }
      log_search: {
        Args: { p_q: string; p_results: number }
        Returns: undefined
      }
      mark_stale_records: {
        Args: { p_pass_started: string; p_source: string }
        Returns: number
      }
      period_end_for: {
        Args: { p_end_date: string; p_precision: string; p_starts_on: string }
        Returns: string
      }
      popular_tags: {
        Args: { p_limit?: number }
        Returns: {
          n: number
          tag: string
        }[]
      }
      related_events: {
        Args: { p_id: string; p_limit?: number }
        Returns: {
          all_day: boolean | null
          category: string | null
          date: string | null
          date_history: Json | null
          date_precision: string | null
          days_until: number | null
          description: string | null
          end_date: string | null
          external_ids: Json | null
          featured: boolean | null
          id: string | null
          image: Json | null
          indexable: boolean | null
          jsonld_eligible: boolean | null
          last_seen_at: string | null
          location: Json | null
          period_end: string | null
          popularity: number | null
          regions: string[] | null
          series_slug: string | null
          series_title: string | null
          slug: string | null
          sort_at: string | null
          source: string | null
          source_label: string | null
          source_url: string | null
          starts_at: string | null
          starts_on: string | null
          status: string | null
          summary: string | null
          tags: string[] | null
          timezone: string | null
          title: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "events_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      release_source_lease: {
        Args: { p_source: string; p_token: string }
        Returns: undefined
      }
      search_events: {
        Args: {
          p_category?: string
          p_featured?: boolean
          p_min_popularity?: number
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_region?: string
          p_region_codes?: string[]
          p_sort?: string
          p_tag?: string
        }
        Returns: {
          event: Json
          score: number
          total: number
        }[]
      }
      soonest_upcoming: {
        Args: { p_limit?: number }
        Returns: {
          all_day: boolean | null
          category: string | null
          date: string | null
          date_history: Json | null
          date_precision: string | null
          days_until: number | null
          description: string | null
          end_date: string | null
          external_ids: Json | null
          featured: boolean | null
          id: string | null
          image: Json | null
          indexable: boolean | null
          jsonld_eligible: boolean | null
          last_seen_at: string | null
          location: Json | null
          period_end: string | null
          popularity: number | null
          regions: string[] | null
          series_slug: string | null
          series_title: string | null
          slug: string | null
          sort_at: string | null
          source: string | null
          source_label: string | null
          source_url: string | null
          starts_at: string | null
          starts_on: string | null
          status: string | null
          summary: string | null
          tags: string[] | null
          timezone: string | null
          title: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "events_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      source_rank: { Args: { p_source: string }; Returns: number }
      tags_text: { Args: { p: string[] }; Returns: string }
      top_slugs: {
        Args: { p_limit?: number }
        Returns: {
          slug: string
        }[]
      }
      upsert_events: {
        Args: { p_rows: Json }
        Returns: {
          drifted: number
          inserted: number
          unchanged: number
          updated: number
        }[]
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
    Enums: {},
  },
} as const

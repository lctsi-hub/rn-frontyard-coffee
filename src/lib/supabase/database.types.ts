// Types for supabase/migrations/20261005120000_phase5a_orders.sql, written by hand
// in the same shape `supabase gen types typescript` produces. Once the migration
// is applied, regenerate this file from the real database and replace it.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type OrderType = "dine_in" | "take_out" | "delivery";
type OrderStatus = "received" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled";
type PaymentMethod = "cash" | "gcash" | "counter";

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: { user_id: string; display_name: string; created_at: string };
        Insert: { user_id: string; display_name: string; created_at?: string };
        Update: { user_id?: string; display_name?: string; created_at?: string };
        Relationships: [];
      };
      store_settings: {
        Row: {
          id: boolean;
          ordering_enabled: boolean;
          delivery_enabled: boolean;
          delivery_min_order: number;
          free_delivery_from: number | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          ordering_enabled?: boolean;
          delivery_enabled?: boolean;
          delivery_min_order?: number;
          free_delivery_from?: number | null;
          updated_at?: string;
        };
        Update: {
          ordering_enabled?: boolean;
          delivery_enabled?: boolean;
          delivery_min_order?: number;
          free_delivery_from?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_areas: {
        Row: {
          id: string;
          name: string;
          fee: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          fee: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          fee?: number;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_seq: number;
          order_number: string;
          tracking_token: string;
          client_request_id: string | null;
          order_type: OrderType;
          status: OrderStatus;
          customer_name: string;
          customer_phone: string | null;
          table_number: number | null;
          delivery_area_id: string | null;
          delivery_area_name: string | null;
          delivery_address: string | null;
          delivery_landmark: string | null;
          delivery_instructions: string | null;
          payment_method: PaymentMethod;
          notes: string;
          subtotal: number;
          delivery_fee: number;
          total: number;
          created_at: string;
          updated_at: string;
        };
        // Orders are only created through create_order(); kept for completeness.
        Insert: never;
        // Admins may change the status only.
        Update: { status?: OrderStatus };
        Relationships: [
          {
            foreignKeyName: "orders_delivery_area_id_fkey";
            columns: ["delivery_area_id"];
            isOneToOne: false;
            referencedRelation: "delivery_areas";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          line_number: number;
          product_key: string;
          product_name: string;
          category_name: string | null;
          size_name: string | null;
          base_price: number;
          options: Json;
          addons: Json;
          unit_price: number;
          quantity: number;
          notes: string;
          line_total: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          id: number;
          order_id: string;
          from_status: OrderStatus | null;
          to_status: OrderStatus;
          changed_at: string;
          changed_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order: {
        Args: { p_order: Json; p_items: Json };
        Returns: { order_id: string; order_number: string; tracking_token: string }[];
      };
      get_order_tracking: {
        Args: { p_token: string };
        Returns: Json;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      order_type: OrderType;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
};

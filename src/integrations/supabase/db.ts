import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { Database as BaseDatabase } from "./types";

/**
 * Os tipos gerados (`types.ts`) ficam atrás do schema real do banco.
 * Aqui declaramos as colunas/tabelas/funções extras já existentes no banco
 * e exportamos `db`: o MESMO cliente do `supabase`, apenas com tipagem completa.
 */

type Base = BaseDatabase["public"];

type WithExtra<T extends { Row: unknown; Insert: unknown; Update: unknown }, E> = Omit<
  T,
  "Row" | "Insert" | "Update"
> & {
  Row: T["Row"] & E;
  Insert: T["Insert"] & Partial<E>;
  Update: T["Update"] & Partial<E>;
};

export type AppointmentExtra = {
  category: string | null;
  custom_category: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
};

export type ProfileExtra = {
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  custom_category: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  appointment_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

type NotificationsTable = {
  Row: NotificationRow;
  Insert: Omit<NotificationRow, "id" | "created_at" | "read_at" | "type"> & {
    id?: string;
    created_at?: string;
    read_at?: string | null;
    type?: string;
  };
  Update: Partial<NotificationRow>;
  Relationships: [];
};

export type ExtendedDatabase = Omit<BaseDatabase, "public"> & {
  public: Omit<Base, "Tables" | "Functions"> & {
    Tables: Omit<Base["Tables"], "appointments" | "profiles"> & {
      appointments: WithExtra<Base["Tables"]["appointments"], AppointmentExtra>;
      profiles: WithExtra<Base["Tables"]["profiles"], ProfileExtra>;
      notifications: NotificationsTable;
    };
    Functions: {
      request_appointment: {
        Args: {
          p_company_id: string;
          p_service_id: string;
          p_starts_at: string;
          p_notes?: string | null;
          p_category?: string | null;
          p_custom_category?: string | null;
        };
        Returns: WithExtra<Base["Tables"]["appointments"], AppointmentExtra>["Row"];
      };
      recovery_question: { Args: { p_email: string }; Returns: string };
      recovery_reset: {
        Args: { p_email: string; p_answer_hash: string; p_password: string };
        Returns: undefined;
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
    };
  };
};

export const db = supabase as unknown as SupabaseClient<ExtendedDatabase>;
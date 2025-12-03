import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create the Supabase client if env vars are present; otherwise export null
export const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-client": "freedom-server" } },
    })
  : null;

export default supabase;

// Helper: convert snake_case keys to camelCase recursively for simple objects/arrays
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_m, p1) => p1.toUpperCase());
}

export function camelizeRow<T>(row: any): T {
  if (!row || typeof row !== 'object') return row as T;
  if (Array.isArray(row)) return row.map((r) => camelizeRow(r)) as unknown as T;
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    const key = toCamelCase(k);
    // Preserve Date objects as-is when camelizing
    if (v instanceof Date) {
      out[key] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[key] = camelizeRow(v);
    } else if (Array.isArray(v)) {
      out[key] = v.map((el) => (typeof el === 'object' ? camelizeRow(el) : el));
    } else {
      out[key] = v;
    }
  }
  return out as T;
}

export function camelizeRows<T>(rows: any[] | null): T[] {
  if (!rows) return [];
  return rows.map((r) => camelizeRow<T>(r));
}

// Helper: convert camelCase keys to snake_case recursively for simple objects/arrays
function toSnakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function snakeifyRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map((r) => snakeifyRow(r));
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    const key = toSnakeCase(k);
    // Preserve Date objects as-is when snakeifying
    if (v instanceof Date) {
      out[key] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[key] = snakeifyRow(v);
    } else if (Array.isArray(v)) {
      out[key] = v.map((el) => (typeof el === 'object' ? snakeifyRow(el) : el));
    } else {
      out[key] = v;
    }
  }
  return out;
}

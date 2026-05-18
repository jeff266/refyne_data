// Database types placeholder
// Run: npx supabase gen types typescript --project-id iidsiejbhdpzzmbotybw > lib/db/database.types.ts
// after authenticating with: supabase login

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      [key: string]: any
    }
  }
}

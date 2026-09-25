import { createClient } from '@supabase/supabase-js'

// Grab the environment variables you defined in your .env.local file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Initialize and export the Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://haaxnjudbfqbpnqnlwvc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYXhuanVkYmZxYnBucW5sd3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzY4NTIsImV4cCI6MjA3Nzg1Mjg1Mn0.bF1Alde0bQKKEXhB6zDqz9uN7XAhdpdq-YIzlZn49e0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Database = any; // TODO: Generate types from Supabase schema

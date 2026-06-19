import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rxlnwmxtxousxyxdqkuw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bG53bXh0eG91c3h5eGRxa3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzMxNjUsImV4cCI6MjA4OTQ0OTE2NX0.VBFQlEfvI7RsumwchQ3r5cqfsb0QF9LL1zsK2CVZab8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

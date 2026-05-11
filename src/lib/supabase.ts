import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jdhkylxedoisddbzofmx.supabase.co'
const supabaseAnonKey = 'sb_publishable_y_L_GbaBTc60DS_uFCeF9A_9j2mZ6m8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
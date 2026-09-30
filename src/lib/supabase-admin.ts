import {createClient} from '@supabase/supabase-js'

const url=process.env.SUPABASE_URL
const key=process.env.SUPABASE_SECRET_KEY

if(!url||!key){
  throw new Error('Supabase storage is not configured.')
}

export const supabaseAdmin=createClient(url,key,{
  auth:{
    autoRefreshToken:false,
    persistSession:false
  }
})

export const supabaseBucket=process.env.SUPABASE_STORAGE_BUCKET||'books'

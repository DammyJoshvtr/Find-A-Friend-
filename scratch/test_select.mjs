import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')

// parse .env manually
const env = fs.readFileSync(envPath, 'utf8')
const matches = env.matchAll(/^([^=]+)=(.*)$/gm)
for (const match of matches) {
  process.env[match[1].trim()] = match[2].trim()
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSelect(selectStr) {
  const { data, error } = await supabase
    .from('posts')
    .select(selectStr)
    .not('repost_of', 'is', null)
    .limit(1)

  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Success! original_post details:', JSON.stringify(data[0].original_post, null, 2))
  }
}

async function run() {
  await testSelect(`
    id,
    repost_of,
    original_post:repost_of(
      *,
      profiles!author_id(id, full_name, department, level, avatar_url),
      post_likes(count),
      post_comments(count),
      reposts(count)
    )
  `)
}

run()

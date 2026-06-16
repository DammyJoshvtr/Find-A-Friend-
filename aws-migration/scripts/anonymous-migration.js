/**
 * anonymous-migration.js
 * Temporary VPC Lambda to run the database migration for the
 * Anonymous Confession Board Admin enhancements on AWS RDS.
 */

const { Client } = require('pg');

exports.handler = async function(event, context) {
  const client = new Client({
    host: process.env.RDS_HOST,
    port: 5432,
    database: 'faf_db',
    user: 'postgres',
    password: process.env.RDS_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  const results = [];

  try {
    await client.connect();
    console.log('Connected to RDS. Running anonymous dashboard migration...');

    const queries = [
      // 1. Add is_anonymous_linked column to events
      `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_anonymous_linked BOOLEAN DEFAULT false;`,

      // 2. Update posts deletion policy to allow admins to delete posts
      `DROP POLICY IF EXISTS "posts: delete own" ON public.posts;`,
      `CREATE POLICY "posts: delete own" ON public.posts
        FOR DELETE USING (
          auth.uid() = author_id OR 
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );`,

      // 3. Update events insert, update, delete policies to allow admins
      `DROP POLICY IF EXISTS "events: organizer insert" ON public.events;`,
      `CREATE POLICY "events: organizer insert" ON public.events
        FOR INSERT WITH CHECK (
          auth.uid() = organizer_id OR
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );`,

      `DROP POLICY IF EXISTS "events: organizer update" ON public.events;`,
      `CREATE POLICY "events: organizer update" ON public.events
        FOR UPDATE USING (
          auth.uid() = organizer_id OR
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );`,

      `DROP POLICY IF EXISTS "events: organizer delete" ON public.events;`,
      `CREATE POLICY "events: organizer delete" ON public.events
        FOR DELETE USING (
          auth.uid() = organizer_id OR
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );`,

      // 4. Enable RLS on system_settings and add policies if not present
      `ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;`,

      `DROP POLICY IF EXISTS "system_settings: read all" ON public.system_settings;`,
      `CREATE POLICY "system_settings: read all" ON public.system_settings
        FOR SELECT USING (true);`,

      `DROP POLICY IF EXISTS "system_settings: admin write" ON public.system_settings;`,
      `CREATE POLICY "system_settings: admin write" ON public.system_settings
        FOR ALL USING (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );`
    ];

    for (const q of queries) {
      console.log(`Running: ${q}`);
      await client.query(q);
      results.push({ query: q, status: 'OK' });
    }

    console.log('Migration ran successfully.');
    return { statusCode: 200, message: 'Migration ran successfully', results };
  } catch (err) {
    console.error('Error running migration:', err);
    return { statusCode: 500, message: err.message, results };
  } finally {
    await client.end();
  }
};

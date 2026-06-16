/**
 * fix-rds-schema.js
 * Temporary VPC Lambda that connects to AWS RDS to:
 * 1. Redefine public.trg_fn_push_notification() as a no-op to remove the pg_net / net schema dependency.
 * 2. Run the Anonymous Board Admin Enhancements (is_anonymous_linked column, policies).
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
    console.log('Connected to RDS. Running database fixes...');

    const queries = [
      // 1. Redefine trg_fn_push_notification to be a no-op (no pg_net)
      {
        label: 'Redefine public.trg_fn_push_notification to no-op',
        sql: `
          CREATE OR REPLACE FUNCTION public.trg_fn_push_notification()
          RETURNS TRIGGER AS $$
          BEGIN
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },

      // 2. Add is_anonymous_linked column to events
      {
        label: 'Add is_anonymous_linked to events',
        sql: `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_anonymous_linked BOOLEAN DEFAULT false;`
      },

      // 3. Update posts deletion policy to allow admins
      {
        label: 'Recreate posts: delete own policy',
        sql: `
          DROP POLICY IF EXISTS "posts: delete own" ON public.posts;
          CREATE POLICY "posts: delete own" ON public.posts
            FOR DELETE USING (
              auth.uid() = author_id OR 
              EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
        `
      },

      // 4. Update events insert, update, delete policies to allow admins
      {
        label: 'Recreate events: organizer insert policy',
        sql: `
          DROP POLICY IF EXISTS "events: organizer insert" ON public.events;
          CREATE POLICY "events: organizer insert" ON public.events
            FOR INSERT WITH CHECK (
              auth.uid() = organizer_id OR
              EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
        `
      },
      {
        label: 'Recreate events: organizer update policy',
        sql: `
          DROP POLICY IF EXISTS "events: organizer update" ON public.events;
          CREATE POLICY "events: organizer update" ON public.events
            FOR UPDATE USING (
              auth.uid() = organizer_id OR
              EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
        `
      },
      {
        label: 'Recreate events: organizer delete policy',
        sql: `
          DROP POLICY IF EXISTS "events: organizer delete" ON public.events;
          CREATE POLICY "events: organizer delete" ON public.events
            FOR DELETE USING (
              auth.uid() = organizer_id OR
              EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
        `
      },

      // 5. Enable RLS on system_settings and add policies
      {
        label: 'Enable RLS on system_settings',
        sql: `ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;`
      },
      {
        label: 'Recreate system_settings: read all policy',
        sql: `
          DROP POLICY IF EXISTS "system_settings: read all" ON public.system_settings;
          CREATE POLICY "system_settings: read all" ON public.system_settings
            FOR SELECT USING (true);
        `
      },
      {
        label: 'Recreate system_settings: admin write policy',
        sql: `
          DROP POLICY IF EXISTS "system_settings: admin write" ON public.system_settings;
          CREATE POLICY "system_settings: admin write" ON public.system_settings
            FOR ALL USING (
              EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
        `
      }
    ];

    for (const item of queries) {
      console.log(`Running: ${item.label}`);
      await client.query(item.sql);
      results.push({ label: item.label, status: 'OK' });
    }

    console.log('Database fixes applied successfully.');
    return { statusCode: 200, message: 'Database fixes applied successfully', results };
  } catch (err) {
    console.error('Error applying database fixes:', err);
    return { statusCode: 500, error: err.message, results };
  } finally {
    await client.end();
  }
};

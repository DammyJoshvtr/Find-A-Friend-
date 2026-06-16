/**
 * sync_admin_role.js
 * Temporary VPC Lambda that connects to AWS RDS to:
 * 1. Create a trigger that auto-elevates role to 'admin' when badge_type is 'admin'.
 * 2. Backfill existing profile roles for users with 'admin' badges.
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
    console.log('Connected to RDS. Creating admin badge role sync trigger...');

    const queries = [
      {
        label: 'Create sync_profile_admin_role trigger function',
        sql: `
          CREATE OR REPLACE FUNCTION public.sync_profile_admin_role()
          RETURNS TRIGGER AS $$
          BEGIN
            IF NEW.badge_type = 'admin' THEN
              NEW.role := 'admin';
            ELSIF (OLD.badge_type = 'admin' OR OLD.role = 'admin') AND (NEW.badge_type IS DISTINCT FROM 'admin') THEN
              IF NEW.role = 'admin' THEN
                NEW.role := 'student';
              END IF;
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        label: 'Create BEFORE INSERT OR UPDATE trigger on profiles',
        sql: `
          DROP TRIGGER IF EXISTS trg_sync_profile_admin_role ON public.profiles;
          CREATE TRIGGER trg_sync_profile_admin_role
            BEFORE INSERT OR UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.sync_profile_admin_role();
        `
      },
      {
        label: 'One-off backfill existing profiles with admin badge to admin role',
        sql: `
          UPDATE public.profiles
          SET role = 'admin'
          WHERE badge_type = 'admin';
        `
      }
    ];

    for (const item of queries) {
      console.log(`Running: ${item.label}`);
      await client.query(item.sql);
      results.push({ label: item.label, status: 'OK' });
    }

    console.log('Admin role sync trigger applied and existing profiles backfilled.');
    return { statusCode: 200, message: 'Database admin sync applied successfully', results };
  } catch (err) {
    console.error('Error applying database updates:', err);
    return { statusCode: 500, error: err.message, results };
  } finally {
    await client.end();
  }
};

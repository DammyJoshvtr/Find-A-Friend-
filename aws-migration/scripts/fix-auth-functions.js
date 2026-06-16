/**
 * fix-auth-functions.js
 * VPC Lambda that fixes auth helper functions in AWS RDS so PostgREST
 * correctly extracts the user ID from Cognito JWTs.
 *
 * Problems fixed:
 * 1. auth.uid() was hardcoded to return NULL - updated to read from JWT claims
 * 2. auth.jwt() was missing - creates it to expose the JWT payload
 * 3. auth.role() was hardcoded to 'authenticated' - updated to read from JWT
 *
 * The Cognito IdToken has:
 *   - sub:                the Cognito user ID (NOT the DB user ID)
 *   - custom:legacy_id:   the original Supabase/DB user UUID
 *   - custom:legacy_email: the original user email
 *
 * So auth.uid() should return custom:legacy_id if available, else sub.
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
    console.log('Connected to RDS. Fixing auth functions...');

    // Step 1: Create auth.jwt() to expose raw JWT payload from PostgREST
    // PostgREST sets the request.jwt.claims setting with the decoded JWT payload
    const createJwtFn = `
      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS jsonb
      LANGUAGE sql
      STABLE
      AS $$
        SELECT
          COALESCE(
            current_setting('request.jwt.claims', true)::jsonb,
            '{}'::jsonb
          )
      $$;
    `;

    // Step 2: Fix auth.uid() to return the legacy DB user ID from the Cognito JWT
    // Cognito JWT has custom:legacy_id which is the original Supabase UUID
    // Falls back to 'sub' if custom:legacy_id is not present (new users)
    const fixUidFn = `
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$
        SELECT COALESCE(
          auth.jwt()->>'custom:legacy_id',
          auth.jwt()->>'sub'
        )::uuid
      $$;
    `;

    // Step 3: Fix auth.role() to return the actual role from JWT claims
    // Must DROP first because the original was RETURNS VARCHAR (different from text in PG).
    const fixRoleFn = `
      DROP FUNCTION IF EXISTS auth.role() CASCADE;
      CREATE FUNCTION auth.role()
      RETURNS text
      LANGUAGE sql
      STABLE
      AS $$
        SELECT COALESCE(
          current_setting('request.jwt.claim.role', true),
          'anon'
        )
      $$;
    `;

    // Step 4: Grant execute on auth functions to all roles
    const grantFns = `
      GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
    `;

    const queries = [
      { label: 'Create auth.jwt()', sql: createJwtFn },
      { label: 'Fix auth.uid()', sql: fixUidFn },
      { label: 'Fix auth.role()', sql: fixRoleFn },
      { label: 'Grant execute on auth functions', sql: grantFns },
    ];

    for (const { label, sql } of queries) {
      console.log(`Running: ${label}`);
      await client.query(sql);
      results.push({ label, status: 'OK' });
    }

    // Step 5: Verify the functions
    const testRes = await client.query(`SELECT auth.jwt(), auth.uid(), auth.role()`);
    const testRow = testRes.rows[0];
    console.log('Test result (no JWT context, should return defaults):', testRow);
    results.push({ label: 'Verify functions', result: testRow, status: 'OK' });

    console.log('All auth functions fixed successfully.');
    return { statusCode: 200, message: 'Auth functions fixed', results };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, message: err.message, results };
  } finally {
    await client.end();
  }
};

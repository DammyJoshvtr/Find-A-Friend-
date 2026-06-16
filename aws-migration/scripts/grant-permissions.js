/**
 * grant-permissions.js
 * Temporary VPC Lambda to grant PostgreSQL table permissions
 * to the anon, authenticated, and service_role roles on AWS RDS.
 *
 * Deployed temporarily inside the VPC to bypass private subnet restrictions.
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
    console.log('Connected to RDS. Granting permissions...');

    const queries = [
      // Schema USAGE
      `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;`,
      `GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;`,

      // Public tables, sequences, and functions - existing objects
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;`,

      // Storage tables - existing objects
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;`,
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role;`,

      // Default privileges for future objects
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`
    ];

    for (const q of queries) {
      console.log(`Running: ${q}`);
      await client.query(q);
      results.push({ query: q, status: 'OK' });
    }

    console.log('All permissions granted successfully.');
    return { statusCode: 200, message: 'Permissions granted successfully', results };
  } catch (err) {
    console.error('Error granting permissions:', err);
    return { statusCode: 500, message: err.message, results };
  } finally {
    await client.end();
  }
};

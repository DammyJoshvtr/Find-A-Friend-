const { Client } = require('pg');

const RDS_CONFIG = {
  host: 'faf-infra-prod-v2-rdsinstance-jmrivbavtegl.csr8okcacgur.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'faf_db',
  user: 'postgres',
  password: process.env.RDS_PASSWORD || 'wG9cTdjIGynxAStS',
  ssl: {
    rejectUnauthorized: false
  }
};

async function main() {
  console.log('Connecting to AWS RDS...');
  const client = new Client(RDS_CONFIG);
  try {
    await client.connect();
    console.log('Connected. Granting permissions...');

    const queries = [
      // Schema USAGE
      `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;`,
      `GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;`,

      // Public tables, sequences, and functions
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;`,

      // Storage tables and sequences (if any)
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;`,
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role;`,

      // Default privileges for new objects created in the future
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`
    ];

    for (const q of queries) {
      console.log(`Running: ${q}`);
      await client.query(q);
    }

    console.log('Permissions granted successfully!');
  } catch (err) {
    console.error('Error granting permissions:', err);
  } finally {
    await client.end();
  }
}

main();

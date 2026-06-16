/**
 * check-user-role.js
 * Temporary VPC Lambda to check a user's role in the database.
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

  try {
    await client.connect();
    console.log('Connected to RDS. Querying user...');

    const res = await client.query("SELECT id, email, full_name, role FROM public.profiles WHERE email = 'olugbodi13123@run.edu.ng'");
    console.log('User query result:', res.rows);
    return { statusCode: 200, user: res.rows[0] || null };
  } catch (err) {
    console.error('Error querying user:', err);
    return { statusCode: 500, error: err.message };
  } finally {
    await client.end();
  }
};

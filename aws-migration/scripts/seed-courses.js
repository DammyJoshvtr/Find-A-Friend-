/**
 * seed-courses.js
 * VPC Lambda that seeds the courses table with default course items.
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
    console.log('Connected to RDS. Seeding courses...');

    const seedSql = `
      INSERT INTO courses (id, code, name, department, level, semester)
      VALUES
      (
        'd0000000-0000-0000-0000-000000000001', 'CSC 201', 'Data Structures & Algorithms',
        'Computer Science', '200L', 'First'
      ),
      (
        'd0000000-0000-0000-0000-000000000002', 'CSC 401', 'Advanced Algorithms',
        'Computer Science', '400L', 'First'
      ),
      (
        'd0000000-0000-0000-0000-000000000003', 'ENG 301', 'Circuit Theory & Electronics',
        'Engineering', '300L', 'Second'
      ),
      (
        'd0000000-0000-0000-0000-000000000004', 'MED 201', 'Human Anatomy',
        'Medicine', '200L', 'First'
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('Running courses seed query...');
    await client.query(seedSql);
    console.log('Seeded successfully.');
    results.push({ status: 'OK', message: 'Seeded courses table.' });

    return { statusCode: 200, message: 'Courses seeded successfully', results };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, message: err.message, results };
  } finally {
    await client.end();
  }
};

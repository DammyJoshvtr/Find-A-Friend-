/**
 * backfill.js
 * Database Backfill Script (Recalculate follower, RSVP, and club member counts)
 *
 * This script runs inside the VPC via a temporary Lambda function.
 * It updates the denormalized counts in the profiles, events, and clubs tables.
 */

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

async function backfill() {
  console.log('Connecting to AWS RDS...');
  const client = new Client(RDS_CONFIG);
  try {
    await client.connect();
    console.log('Connected to RDS. Running backfills...');

    // 1. Backfill profiles follower_count and following_count
    console.log('Backfilling profiles follower_count and following_count...');
    const profilesRes = await client.query(`
      UPDATE public.profiles p
      SET 
        follower_count = (SELECT COUNT(*) FROM public.follows f WHERE f.following_id = p.id),
        following_count = (SELECT COUNT(*) FROM public.follows f WHERE f.follower_id = p.id)
      RETURNING id;
    `);
    console.log(`Updated ${profilesRes.rowCount} profiles.`);

    // 2. Backfill events rsvp_count
    console.log('Backfilling events rsvp_count...');
    const eventsRes = await client.query(`
      UPDATE public.events e
      SET 
        rsvp_count = (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'going')
      RETURNING id;
    `);
    console.log(`Updated ${eventsRes.rowCount} events.`);

    // 3. Backfill clubs member_count
    console.log('Backfilling clubs member_count...');
    const clubsRes = await client.query(`
      UPDATE public.clubs c
      SET 
        member_count = (SELECT COUNT(*) FROM public.club_members m WHERE m.club_id = c.id)
      RETURNING id;
    `);
    console.log(`Updated ${clubsRes.rowCount} clubs.`);

    console.log('All counts backfilled successfully!');
  } catch (err) {
    console.error('Backfill failed with error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

exports.handler = async (event) => {
  console.log('Running VPC Database Backfill...');
  await backfill();
  return { statusCode: 200, body: 'Backfill completed successfully!' };
};

if (require.main === module) {
  backfill();
}

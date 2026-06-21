/**
 * AWS Lambda Trigger: Cognito User Migration (Lazy Migration)
 * File: aws-migration/lambda/cognito-lazy-migration.js
 *
 * This function is triggered by AWS Cognito during sign-in or forgot password
 * when a user is not found in the Cognito User Pool. It verifies their credentials
 * against the legacy database (copied from Supabase auth.users) and automatically
 * provisions them in the Cognito User Pool if verification succeeds.
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Fetch database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false // Required for Aurora PostgreSQL connection
  }
};

exports.handler = async (event) => {
  console.log('Cognito Migration Trigger Event:', JSON.stringify(event, null, 2));

  // We only support user authentication and forgot password triggers
  if (event.triggerSource !== 'UserMigration_Authentication' && event.triggerSource !== 'UserMigration_ForgotPassword') {
    throw new Error(`Unsupported trigger source: ${event.triggerSource}`);
  }

  const username = event.userName; // Typically email in our Cognito config
  const password = event.request.password;

  if (event.triggerSource === 'UserMigration_Authentication') {
    if (!password) {
      throw new Error('Password is required for user migration authentication');
    }

    // Connect to database to check credentials
    const client = new Client(dbConfig);
    try {
      await client.connect();

      // Query the legacy credentials table
      const res = await client.query(
        'SELECT id, email, encrypted_password, full_name FROM public.legacy_auth_credentials WHERE email = $1 LIMIT 1',
        [username.toLowerCase().trim()]
      );

      if (res.rows.length === 0) {
        console.log(`User ${username} not found in legacy database.`);
        throw new Error('User not found');
      }

      const legacyUser = res.rows[0];

      console.log(`User found. Hash prefix: ${legacyUser.encrypted_password ? legacyUser.encrypted_password.substring(0, 10) : 'null'}`);
      
      // Compare password with bcrypt hash from Supabase (convert $2y$ to $2a$ for bcryptjs compatibility)
      let hash = legacyUser.encrypted_password;
      if (hash && hash.startsWith('$2y$')) {
        hash = hash.replace('$2y$', '$2a$');
      }
      const match = await bcrypt.compare(password, hash);
      if (!match) {
        console.log(`Incorrect password for user ${username}.`);
        throw new Error('Invalid credentials');
      }

      console.log(`Successful migration validation for user: ${username}`);

      // Set user attributes and status to migrate into Cognito
      event.response.userAttributes = {
        email: legacyUser.email,
        email_verified: 'true',
        name: legacyUser.full_name || '',
        'custom:legacy_id': legacyUser.id
      };
      
      // Tell Cognito to set user status as confirmed
      event.response.finalUserStatus = 'CONFIRMED';
      event.response.messageAction = 'SUPPRESS';

      // Clean up legacy credential so they don't get checked against DB next time
      try {
        await client.query('DELETE FROM public.legacy_auth_credentials WHERE id = $1', [legacyUser.id]);
        console.log(`Removed legacy migration credential record for user ID: ${legacyUser.id}`);
      } catch (dbErr) {
        console.error('Failed to clean up legacy credential row:', dbErr);
        // Do not fail the lambda execution if the delete fails, the user is already authenticated
      }

      return event;

    } catch (err) {
      console.error('Database/Migration error:', err);
      throw new Error('Authentication failed during legacy migration');
    } finally {
      await client.end();
    }
  }

  if (event.triggerSource === 'UserMigration_ForgotPassword') {
    // For forgot password, we check if user exists in the legacy DB.
    // If they do, we initiate Cognito's forgot password flow and notify Cognito that we know this user.
    const client = new Client(dbConfig);
    try {
      await client.connect();

      const res = await client.query(
        'SELECT id, email, full_name FROM public.legacy_auth_credentials WHERE email = $1 LIMIT 1',
        [username.toLowerCase().trim()]
      );

      if (res.rows.length === 0) {
        console.log(`User ${username} not found in legacy database for forgot password.`);
        throw new Error('User not found');
      }

      const legacyUser = res.rows[0];

      event.response.userAttributes = {
        email: legacyUser.email,
        email_verified: 'true',
        name: legacyUser.full_name || '',
        'custom:legacy_id': legacyUser.id
      };
      event.response.messageAction = 'SUPPRESS';

      // We do not delete from legacy_auth_credentials yet, because they haven't authenticated.
      // Once they perform resetPassword, they will create a new password inside Cognito.

      return event;
    } catch (err) {
      console.error('Forgot password migration check error:', err);
      throw new Error('User not found in legacy database');
    } finally {
      await client.end();
    }
  }

  return event;
};

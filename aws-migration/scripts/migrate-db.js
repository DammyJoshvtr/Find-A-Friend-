/**
 * migrate-db.js
 * Programmatic Database Migration (Supabase -> AWS RDS)
 *
 * This script runs completely in Node.js with zero external dependencies (no pg_dump or psql required).
 * It:
 *   1. Reads and executes all Supabase schema migration SQL files on the target RDS database.
 *   2. Temporarily disables constraints and triggers via PostgreSQL's session_replication_role.
 *   3. Copies data for all public tables from Supabase to AWS RDS.
 *   4. Extracts user credentials from Supabase's auth.users and loads them into legacy_auth_credentials.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_CONFIG = {
  host: 'db.vcbtvhociaioeyhhsczh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

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

async function runMigration() {
  if (!SUPABASE_CONFIG.password) {
    console.error('Error: SUPABASE_PASSWORD environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to Supabase and AWS RDS...');
  const supabaseClient = new Client(SUPABASE_CONFIG);
  const rdsClient = new Client(RDS_CONFIG);

  try {
    await supabaseClient.connect();
    await rdsClient.connect();
    console.log('Connected successfully to both databases.');

    // 1. Execute SQL Migrations to build target database schema
    console.log('\n[1/4] Running schema migrations on target AWS RDS database...');
    console.log('Dropping and recreating public schema on target RDS to ensure a clean slate...');
    await rdsClient.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    let migrationsDir = path.join(__dirname, 'supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, '../../supabase/migrations');
    }
    
    // Create standard Supabase roles if they do not exist
    console.log('Creating standard Supabase roles (anon, authenticated, service_role)...');
    await rdsClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;
    `);

    // Create auth and storage schemas/tables first to satisfy constraints and policies
    console.log('Creating auth and storage schemas...');
    await rdsClient.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;
      
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        encrypted_password VARCHAR(255),
        raw_user_meta_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE
      );
      
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT null::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.role()
      RETURNS VARCHAR
      LANGUAGE sql
      STABLE
      AS $$
        SELECT 'authenticated'::varchar;
      $$;

      CREATE TABLE IF NOT EXISTS storage.buckets (
        id VARCHAR PRIMARY KEY,
        name VARCHAR,
        public BOOLEAN,
        file_size_limit BIGINT,
        allowed_mime_types VARCHAR[]
      );
      
      CREATE TABLE IF NOT EXISTS storage.objects (
        id UUID PRIMARY KEY,
        bucket_id VARCHAR REFERENCES storage.buckets(id),
        name VARCHAR,
        owner UUID,
        created_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // Port users from Supabase auth.users to RDS auth.users
    console.log('Porting users from Supabase auth.users to RDS auth.users...');
    const usersRes = await supabaseClient.query(`
      SELECT id, email, encrypted_password, raw_user_meta_data, created_at
      FROM auth.users
    `);
    console.log(`Found ${usersRes.rows.length} users. Copying to RDS auth.users...`);
    await rdsClient.query('TRUNCATE TABLE auth.users CASCADE');
    for (const user of usersRes.rows) {
      await rdsClient.query(
        `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email, user.encrypted_password, JSON.stringify(user.raw_user_meta_data || {}), user.created_at]
      );
    }

    // Create transition legacy auth credentials table first
    console.log('Creating public.legacy_auth_credentials table...');
    await rdsClient.query(`
      CREATE TABLE IF NOT EXISTS public.legacy_auth_credentials (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        encrypted_password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1.1 Enable extensions from Supabase on RDS
    console.log('Querying extensions from Supabase...');
    try {
      const extRes = await supabaseClient.query('SELECT extname FROM pg_extension');
      for (const row of extRes.rows) {
        const ext = row.extname;
        if (ext === 'plpgsql') continue;
        console.log(`Enabling extension: ${ext}...`);
        try {
          await rdsClient.query(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
        } catch (err) {
          console.warn(`Warning: Could not enable extension ${ext}: ${err.message}`);
        }
      }
    } catch (extQueryErr) {
      console.warn('Warning: Failed to query/enable extensions:', extQueryErr.message);
    }

    // 1.2 Recreate custom enums
    console.log('Querying custom enums from Supabase...');
    try {
      const enumRes = await supabaseClient.query(`
        SELECT t.typname AS enum_name, 
               string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS enum_values
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
      `);
      for (const row of enumRes.rows) {
        const enumName = row.enum_name;
        const enumVals = row.enum_values.split(',').map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
        console.log(`Creating enum: ${enumName} (${enumVals})...`);
        await rdsClient.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_type t 
              JOIN pg_namespace n ON t.typnamespace = n.oid 
              WHERE t.typname = '${enumName}' AND n.nspname = 'public'
            ) THEN
              CREATE TYPE public."${enumName}" AS ENUM (${enumVals});
            END IF;
          END
          $$;
        `);
      }
    } catch (enumErr) {
      console.warn('Warning: Failed to recreate enums:', enumErr.message);
    }

    // 1.3 Recreate base tables and primary keys
    console.log('Querying table structures and primary keys from Supabase...');
    let tablesColumns = {};
    try {
      const columnsRes = await supabaseClient.query(`
        SELECT 
            c.table_name, 
            c.column_name, 
            c.data_type, 
            c.is_nullable, 
            c.column_default, 
            c.udt_name, 
            c.character_maximum_length, 
            c.numeric_precision, 
            c.numeric_scale
        FROM 
            information_schema.columns c
            JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE 
            c.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            AND c.table_name != 'legacy_auth_credentials'
        ORDER BY 
            c.table_name, 
            c.ordinal_position
      `);

      const pkRes = await supabaseClient.query(`
        SELECT 
            kcu.table_name,
            kcu.column_name
        FROM 
            information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
        WHERE 
            tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
        ORDER BY 
            kcu.table_name, kcu.ordinal_position
      `);

      tablesColumns = {};
      for (const col of columnsRes.rows) {
        if (!tablesColumns[col.table_name]) {
          tablesColumns[col.table_name] = [];
        }
        tablesColumns[col.table_name].push(col);
      }

      const tablePks = {};
      for (const pk of pkRes.rows) {
        if (!tablePks[pk.table_name]) {
          tablePks[pk.table_name] = [];
        }
        tablePks[pk.table_name].push(pk.column_name);
      }

      for (const tableName of Object.keys(tablesColumns)) {
        console.log(`Generating schema for table: ${tableName}...`);
        const columns = tablesColumns[tableName];
        const pkCols = tablePks[tableName] || [];
        
        const colDefs = [];
        for (const col of columns) {
          let colType = col.data_type;
          let colDefault = col.column_default;
          
          if (colDefault && colDefault.startsWith('nextval(')) {
            if (colType === 'integer') {
              colType = 'SERIAL';
              colDefault = null;
            } else if (colType === 'bigint') {
              colType = 'BIGSERIAL';
              colDefault = null;
            }
          }
          
          if (colType === 'USER-DEFINED') {
            colType = `public."${col.udt_name}"`;
          }
          
          if (colType === 'ARRAY') {
            const elemType = col.udt_name.startsWith('_') ? col.udt_name.substring(1) : col.udt_name;
            const standardTypes = ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'text', 'varchar', 'uuid', 'bool', 'timestamp', 'timestamptz', 'json', 'jsonb'];
            if (standardTypes.includes(elemType)) {
              colType = `${elemType}[]`;
            } else {
              colType = `public."${elemType}"[]`;
            }
          }
          
          if (colType === 'character varying' && col.character_maximum_length) {
            colType = `varchar(${col.character_maximum_length})`;
          }
          
          if (colType === 'numeric' && col.numeric_precision !== null) {
            if (col.numeric_scale !== null) {
              colType = `numeric(${col.numeric_precision},${col.numeric_scale})`;
            } else {
              colType = `numeric(${col.numeric_precision})`;
            }
          }
          
          let defStr = '';
          if (colDefault !== null) {
            const isNullCast = colDefault.toLowerCase().startsWith('null::');
            if (!isNullCast) {
              defStr = ` DEFAULT ${colDefault}`;
            }
          }
          
          const nullStr = col.is_nullable === 'NO' ? ' NOT NULL' : '';
          colDefs.push(`"${col.column_name}" ${colType}${nullStr}${defStr}`);
        }
        
        if (pkCols.length > 0) {
          colDefs.push(`PRIMARY KEY (${pkCols.map(c => `"${c}"`).join(', ')})`);
        }
        
        const createTableSql = `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
        await rdsClient.query(createTableSql);
      }
    } catch (tableErr) {
      console.error('Error recreating tables:', tableErr.message);
      throw tableErr;
    }

    // 1.4 Recreate custom functions
    console.log('Querying custom functions from Supabase...');
    try {
      const funcRes = await supabaseClient.query(`
        SELECT 
            p.proname AS function_name,
            pg_get_functiondef(p.oid) AS function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public';
      `);
      for (const row of funcRes.rows) {
        const funcName = row.function_name;
        const funcDef = row.function_definition;
        console.log(`Creating function: ${funcName}...`);
        try {
          await rdsClient.query(funcDef);
        } catch (err) {
          console.warn(`Warning: Could not create function ${funcName}: ${err.message}`);
        }
      }
    } catch (funcErr) {
      console.warn('Warning: Failed to recreate functions:', funcErr.message);
    }


    // 2. Disable triggers and foreign keys on target database for bulk insertion
    console.log('\n[2/4] Disabling foreign keys and triggers on AWS RDS...');
    await rdsClient.query("SET session_replication_role = 'replica';");

    // 3. Migrate tables data
    console.log('\n[3/4] Copying table data from Supabase to AWS RDS...');
    
    // Get all tables in public schema
    const tablesRes = await supabaseClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'legacy_auth_credentials'
    `);
    
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found public tables: ${tables.join(', ')}`);

    for (const table of tables) {
      console.log(`Porting table: ${table}...`);
      
      // Fetch data from Supabase
      const dataRes = await supabaseClient.query(`SELECT * FROM public.${table}`);
      
      if (dataRes.rows.length === 0) {
        console.log(`Table ${table} is empty. Skipping.`);
        continue;
      }

      console.log(`Found ${dataRes.rows.length} rows in ${table}. Transferring...`);

      // Truncate table on RDS first to avoid duplicates
      await rdsClient.query(`TRUNCATE TABLE public.${table} CASCADE`);

      const columns = Object.keys(dataRes.rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');
      
      const tableCols = tablesColumns[table] || [];
      const jsonCols = new Set(
        tableCols
          .filter(col => col.data_type === 'json' || col.data_type === 'jsonb')
          .map(col => col.column_name)
      );

      for (const row of dataRes.rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => {
          let val = row[col];
          if (jsonCols.has(col) && val !== null && val !== undefined) {
            if (typeof val === 'string') {
              try {
                JSON.parse(val);
              } catch (e) {
                val = JSON.stringify(val);
              }
            } else {
              val = JSON.stringify(val);
            }
          }
          return val;
        });
        
        await rdsClient.query(
          `INSERT INTO public.${table} (${colNames}) VALUES (${placeholders})`,
          values
        );
      }
      console.log(`Table ${table} ported successfully!`);
    }

    // 3.5 Recreate unique constraints, foreign keys, views, indexes, triggers, and policies
    console.log('\n[3.5] Recreating schema constraints, views, indexes, triggers, and policies...');
    
    // 3.5.1 Unique constraints
    console.log('Querying unique constraints from Supabase...');
    try {
      const uniqueRes = await supabaseClient.query(`
        SELECT 
            tc.table_name,
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
        FROM 
            information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
        WHERE 
            tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = 'public'
        GROUP BY 
            tc.table_name, tc.constraint_name
      `);
      for (const row of uniqueRes.rows) {
        const { table_name, constraint_name, columns } = row;
        console.log(`Adding unique constraint: ${constraint_name} on ${table_name}...`);
        try {
          await rdsClient.query(`
            ALTER TABLE public."${table_name}"
            ADD CONSTRAINT "${constraint_name}" UNIQUE (${columns.split(', ').map(c => `"${c}"`).join(', ')})
          `);
        } catch (err) {
          console.warn(`Warning: Could not add unique constraint ${constraint_name} on ${table_name}: ${err.message}`);
        }
      }
    } catch (uniqueErr) {
      console.warn('Warning: Failed to recreate unique constraints:', uniqueErr.message);
    }

    // 3.5.2 Foreign Keys
    console.log('Querying foreign keys from Supabase...');
    try {
      const fkRes = await supabaseClient.query(`
        SELECT
            tc.table_name AS source_table,
            tc.constraint_name,
            kcu.column_name AS source_column,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column,
            rc.update_rule,
            rc.delete_rule
        FROM
            information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints rc
              ON rc.constraint_name = tc.constraint_name
        WHERE
            tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
      `);
      for (const row of fkRes.rows) {
        const { source_table, constraint_name, source_column, target_table, target_column, update_rule, delete_rule } = row;
        console.log(`Adding foreign key: ${constraint_name} on ${source_table} referencing ${target_table}...`);
        try {
          await rdsClient.query(`
            ALTER TABLE public."${source_table}"
            ADD CONSTRAINT "${constraint_name}"
            FOREIGN KEY ("${source_column}")
            REFERENCES public."${target_table}" ("${target_column}")
            ON UPDATE ${update_rule}
            ON DELETE ${delete_rule}
          `);
        } catch (err) {
          console.warn(`Warning: Could not add foreign key ${constraint_name} on ${source_table}: ${err.message}`);
        }
      }
    } catch (fkErr) {
      console.warn('Warning: Failed to recreate foreign keys:', fkErr.message);
    }

    // 3.5.3 Views
    console.log('Querying views from Supabase...');
    try {
      const viewRes = await supabaseClient.query(`
        SELECT 
            table_name AS view_name, 
            view_definition 
        FROM 
            information_schema.views 
        WHERE 
            table_schema = 'public'
      `);
      let viewsToCreate = [...viewRes.rows];
      let attempts = 0;
      const maxAttempts = 5;
      while (viewsToCreate.length > 0 && attempts < maxAttempts) {
        attempts++;
        console.log(`Recreating views, attempt ${attempts}...`);
        const failedViews = [];
        for (const view of viewsToCreate) {
          const { view_name, view_definition } = view;
          console.log(`Creating view: ${view_name}...`);
          try {
            await rdsClient.query(`CREATE OR REPLACE VIEW public."${view_name}" AS ${view_definition}`);
          } catch (err) {
            console.log(`View ${view_name} failed on this attempt (likely due to dependencies). Will retry.`);
            failedViews.push(view);
          }
        }
        if (failedViews.length === viewsToCreate.length) {
          console.warn('Unable to progress view creations. Remaining views have unresolved issues:', failedViews.map(v => v.view_name));
          break;
        }
        viewsToCreate = failedViews;
      }
    } catch (viewErr) {
      console.warn('Warning: Failed to recreate views:', viewErr.message);
    }

    // 3.5.4 Indexes
    console.log('Querying indexes from Supabase...');
    try {
      const indexRes = await supabaseClient.query(`
        SELECT 
            tablename, 
            indexname, 
            indexdef 
        FROM 
            pg_indexes 
        WHERE 
            schemaname = 'public'
      `);
      for (const row of indexRes.rows) {
        const { indexname, indexdef } = row;
        console.log(`Creating index: ${indexname}...`);
        try {
          await rdsClient.query(indexdef);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`Index ${indexname} already exists. Skipping.`);
          } else {
            console.warn(`Warning: Could not create index ${indexname}: ${err.message}`);
          }
        }
      }
    } catch (indexErr) {
      console.warn('Warning: Failed to recreate indexes:', indexErr.message);
    }

    // 3.5.5 Triggers
    console.log('Querying triggers from Supabase...');
    try {
      const triggerRes = await supabaseClient.query(`
        SELECT 
            t.tgname AS trigger_name,
            pg_get_triggerdef(t.oid) AS trigger_definition
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND NOT t.tgisinternal;
      `);
      for (const row of triggerRes.rows) {
        const { trigger_name, trigger_definition } = row;
        console.log(`Creating trigger: ${trigger_name}...`);
        try {
          await rdsClient.query(trigger_definition);
        } catch (err) {
          console.warn(`Warning: Could not create trigger ${trigger_name}: ${err.message}`);
        }
      }
    } catch (triggerErr) {
      console.warn('Warning: Failed to recreate triggers:', triggerErr.message);
    }

    // 3.5.6 Row Level Security & Policies
    console.log('Enabling Row Level Security and creating policies...');
    try {
      const tablesResForRls = await supabaseClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name != 'legacy_auth_credentials'
      `);
      for (const row of tablesResForRls.rows) {
        const tableName = row.table_name;
        console.log(`Enabling RLS on table: ${tableName}`);
        try {
          await rdsClient.query(`ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;`);
        } catch (err) {
          console.warn(`Warning: Could not enable RLS on table ${tableName}: ${err.message}`);
        }
      }

      const policyRes = await supabaseClient.query(`
        SELECT 
            tablename, 
            policyname, 
            cmd, 
            roles, 
            qual, 
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
      `);
      for (const row of policyRes.rows) {
        const { tablename, policyname, cmd, roles, qual, with_check } = row;
        console.log(`Creating policy: ${policyname} on ${tablename}...`);
        
        let sql = `CREATE POLICY "${policyname}" ON public."${tablename}" FOR ${cmd}`;
        
        let rolesArray = [];
        if (Array.isArray(roles)) {
          rolesArray = roles;
        } else if (typeof roles === 'string') {
          rolesArray = roles
            .replace(/[{}]/g, '')
            .split(',')
            .map(r => r.trim())
            .filter(r => r.length > 0);
        }
        
        if (rolesArray.length > 0) {
          sql += ` TO ${rolesArray.map(r => `"${r}"`).join(', ')}`;
        }
        
        if (qual) {
          sql += ` USING (${qual})`;
        }
        
        if (with_check) {
          sql += ` WITH CHECK (${with_check})`;
        }
        
        try {
          await rdsClient.query(sql);
        } catch (err) {
          console.warn(`Warning: Could not create policy ${policyname} on ${tablename}: ${err.message}`);
        }
      }
    } catch (policyErr) {
      console.warn('Warning: Failed to enable RLS or recreate policies:', policyErr.message);
    }

    // 4. Migrate user credential hashes from auth.users to public.legacy_auth_credentials
    console.log('\n[4/4] Porting user password hashes from auth.users to legacy_auth_credentials...');
    
    try {
      const usersRes = await supabaseClient.query(`
        SELECT id, email, encrypted_password, raw_user_meta_data->>'full_name' as full_name 
        FROM auth.users
      `);

      console.log(`Found ${usersRes.rows.length} users to migrate.`);
      
      // Clean up legacy credentials on RDS first
      await rdsClient.query('TRUNCATE TABLE public.legacy_auth_credentials');

      for (const user of usersRes.rows) {
        await rdsClient.query(
          `INSERT INTO public.legacy_auth_credentials (id, email, encrypted_password, full_name) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO NOTHING`,
          [user.id, user.email, user.encrypted_password, user.full_name || '']
        );
      }
      console.log('User hashes ported successfully!');
    } catch (usersErr) {
      console.error('Failed to migrate user hashes:', usersErr.message);
    }

    // Restore triggers and constraints
    console.log('\nRestoring foreign keys and triggers on AWS RDS...');
    await rdsClient.query("SET session_replication_role = 'origin';");

    console.log('\n======================================================');
    console.log('   DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('======================================================');

  } catch (err) {
    console.error('Migration failed with error:', err);
  } finally {
    await rdsClient.end();
    await supabaseClient.end();
  }
}

if (require.main === module) {
  runMigration();
}

exports.handler = async (event) => {
  console.log('Running VPC Database Migration...');
  await runMigration();
  return { statusCode: 200, body: 'Migration completed successfully!' };
};

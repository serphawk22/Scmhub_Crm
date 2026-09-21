const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Connecting to Neon PostgreSQL database...');
    const testRes = await client.query('SELECT NOW() as current_time, current_database() as db_name;');
    console.log(`Connected successfully to database "${testRes.rows[0].db_name}" at ${testRes.rows[0].current_time}`);

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS metrics (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        label VARCHAR(100) NOT NULL,
        value VARCHAR(100) NOT NULL,
        subtext VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tier VARCHAR(100) NOT NULL DEFAULT 'Enterprise',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        time_ago VARCHAR(50) DEFAULT 'just now',
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        initial CHAR(1) NOT NULL,
        role VARCHAR(100) NOT NULL,
        tasks INTEGER NOT NULL DEFAULT 0,
        completion_rate INTEGER NOT NULL DEFAULT 80,
        meetings INTEGER NOT NULL DEFAULT 0,
        calls INTEGER NOT NULL DEFAULT 0,
        projects INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'Administrator',
        last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_agent_logs (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'dispatched',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed metrics if empty
    const metricsCount = await client.query('SELECT COUNT(*) FROM metrics;');
    if (parseInt(metricsCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO metrics (key, label, value, subtext) VALUES
        ('revenue', 'Revenue', '₹48,250', '+12.4% vs last period'),
        ('active_leads', 'Active Leads', '126', '8 pending review'),
        ('open_projects', 'Open Projects', '18', '100% on schedule'),
        ('meetings_today', 'Today''s Meetings', '6', '2 completed');
      `);
      console.log('Seeded initial metrics into Neon database.');
    }

    // Seed leads if empty
    const leadsCount = await client.query('SELECT COUNT(*) FROM leads;');
    if (parseInt(leadsCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO leads (name, tier, status) VALUES
        ('Acme Solutions', 'Enterprise', 'active'),
        ('TechNova', 'Mid-Market', 'active'),
        ('Bright Systems', 'Growth', 'active'),
        ('Global Connect', 'Enterprise', 'active');
      `);
      console.log('Seeded initial leads into Neon database.');
    }

    // Seed activities if empty
    const activitiesCount = await client.query('SELECT COUNT(*) FROM activities;');
    if (parseInt(activitiesCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO activities (description, time_ago) VALUES
        ('Follow-up email sent', '2m'),
        ('Project updated', '14m'),
        ('Meeting scheduled', '32m'),
        ('New lead added', '1h');
      `);
      console.log('Seeded initial activities into Neon database.');
    }

    // Seed team members if empty
    const teamCount = await client.query('SELECT COUNT(*) FROM team_members;');
    if (parseInt(teamCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO team_members (name, initial, role, tasks, completion_rate, meetings, calls, projects) VALUES
        ('Anjali', 'A', 'Account Lead', 24, 85, 5, 14, 6),
        ('Rahul', 'R', 'Sales Director', 18, 90, 4, 12, 4),
        ('Priya', 'P', 'Customer Success', 21, 78, 3, 10, 5),
        ('Vamshi', 'V', 'Operations Associate', 16, 80, 2, 6, 3);
      `);
      console.log('Seeded initial team members into Neon database.');
    }

    // Seed default admin user if empty
    const usersCount = await client.query('SELECT COUNT(*) FROM users;');
    if (parseInt(usersCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO users (email, role) VALUES
        ('user@organization.com', 'Enterprise Administrator')
        ON CONFLICT (email) DO NOTHING;
      `);
      console.log('Seeded default user into Neon database.');
    }

    console.log('Neon database tables verified and ready.');
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb
};

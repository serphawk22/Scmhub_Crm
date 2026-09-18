const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as db_time, current_database() as db_name');
    res.json({
      status: 'healthy',
      database: result.rows[0].db_name,
      db_time: result.rows[0].db_time
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET /api/dashboard - retrieve real-time metrics, leads, and recent activities
app.get('/api/dashboard', async (req, res) => {
  try {
    const [metricsRes, leadsRes, activitiesRes] = await Promise.all([
      pool.query('SELECT * FROM metrics ORDER BY id ASC;'),
      pool.query('SELECT * FROM leads ORDER BY id DESC LIMIT 6;'),
      pool.query('SELECT * FROM activities ORDER BY id DESC LIMIT 6;')
    ]);

    res.json({
      success: true,
      metrics: metricsRes.rows,
      leads: leadsRes.rows,
      activities: activitiesRes.rows
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// GET /api/team - retrieve team members & tasks from Neon PostgreSQL
app.get('/api/team', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM team_members ORDER BY tasks DESC;');
    res.json({
      success: true,
      team: result.rows
    });
  } catch (err) {
    console.error('Error fetching team members:', err);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// POST /api/leads - add a new lead to Neon PostgreSQL
app.post('/api/leads', async (req, res) => {
  const { name, tier = 'Enterprise' } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Lead name is required' });
  }

  try {
    const leadInsert = await pool.query(
      'INSERT INTO leads (name, tier, status) VALUES ($1, $2, $3) RETURNING *;',
      [name, tier, 'active']
    );

    // Also record an activity
    await pool.query(
      'INSERT INTO activities (description, time_ago, lead_id) VALUES ($1, $2, $3);',
      [`New lead added: ${name}`, 'Just now', leadInsert.rows[0].id]
    );

    res.status(201).json({
      success: true,
      lead: leadInsert.rows[0]
    });
  } catch (err) {
    console.error('Error creating lead:', err);
    res.status(500).json({ success: false, error: 'Failed to insert lead' });
  }
});

// POST /api/ai-agent/dispatch - store dispatched email in ai_agent_logs & activities
app.post('/api/ai-agent/dispatch', async (req, res) => {
  const { recipient, subject, content } = req.body;

  try {
    const agentRes = await pool.query(
      'INSERT INTO ai_agent_logs (recipient, subject, content, status) VALUES ($1, $2, $3, $4) RETURNING *;',
      [
        recipient || 'marcus@acmesolutions.com',
        subject || 'Updated Proposal & Implementation Roadmap — Acme Solutions',
        content || 'Updated proposal follow-up dispatched via SCM HUB AI Agent',
        'dispatched'
      ]
    );

    // Insert corresponding activity record in PostgreSQL
    const activityRes = await pool.query(
      'INSERT INTO activities (description, time_ago) VALUES ($1, $2) RETURNING *;',
      ['Follow-up email sent via AI Agent', 'Just now']
    );

    res.json({
      success: true,
      message: 'Dispatched and logged to Neon PostgreSQL successfully.',
      log: agentRes.rows[0],
      newActivity: activityRes.rows[0]
    });
  } catch (err) {
    console.error('Error logging AI dispatch:', err);
    res.status(500).json({ success: false, error: 'Failed to record AI dispatch' });
  }
});

// POST /api/auth/signin - authenticate and record session in users table
app.post('/api/auth/signin', async (req, res) => {
  const { email } = req.body;
  const userEmail = (email || 'user@organization.com').trim().toLowerCase();

  try {
    const result = await pool.query(`
      INSERT INTO users (email, last_login)
      VALUES ($1, CURRENT_TIMESTAMP)
      ON CONFLICT (email)
      DO UPDATE SET last_login = CURRENT_TIMESTAMP
      RETURNING *;
    `, [userEmail]);

    res.json({
      success: true,
      message: 'Workspace authenticated via Neon PostgreSQL.',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error during user sign in:', err);
    res.status(500).json({ success: false, error: 'Authentication query failed' });
  }
});

// Guard route for direct /signup requests
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

// Start Server after initializing Database
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`SCM HUB CRM Server running at http://localhost:${PORT}`);
      console.log(`Connected to Neon PostgreSQL database: ${process.env.DATABASE_URL ? 'OK' : 'MISSING'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

const { Pool, types } = require('pg');
types.setTypeParser(1082, val => val); // date → string YYYY-MM-DD
 
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  max:      10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});
 
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});
 
module.exports = pool;
 

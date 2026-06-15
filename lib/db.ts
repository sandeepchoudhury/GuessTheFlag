import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Transaction pooler (port 6543) does not support prepared statements.
const sql = postgres(connectionString, { prepare: false });

export default sql;

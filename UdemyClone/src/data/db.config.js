import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'udemy_clone',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Test the database connection.
 * Call this once at startup to verify connectivity.
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('  ✔  Connected to MySQL database successfully.');
    connection.release();
    return true;
  } catch (err) {
    console.error('  ✖  Failed to connect to MySQL:', err.message);
    return false;
  }
}

export default pool;

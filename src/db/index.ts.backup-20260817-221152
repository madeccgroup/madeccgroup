import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';

// Function to create a new connection pool.
export const createPool = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('========================================================================');
    console.error('FATAL CONFIGURATION ERROR: DATABASE_URL environment variable is missing.');
    console.error('Please configure your PostgreSQL database connection string in your .env');
    console.error('or cloud platform secrets manager.');
    console.error('========================================================================');
    throw new Error('DATABASE_URL environment variable is required.');
  }
  
  // Check explicit query parameters
  const hasForceDisable = connectionString.includes('sslmode=disable');
  const hasForceEnable = connectionString.includes('sslmode=require');
  
  // Detect standard local addresses
  const isLocalHost = connectionString.includes('localhost') || 
                      connectionString.includes('127.0.0.1');
  
  // Enable SSL for remote database connections unless explicitly disabled or connecting to localhost.
  const needsSsl = hasForceEnable || (!isLocalHost && !hasForceDisable);

  return new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    max: process.env.NETLIFY ? 2 : 10, // Optimize pool size for serverless environments
    idleTimeoutMillis: 30000,
    ssl: needsSsl ? { rejectUnauthorized: false } : false
  });
};

// Create a pool instance.
let pool: any;
try {
  pool = createPool();
} catch (err) {
  console.warn('Database connection pool could not be initialized at module startup:', err);
}

// Prevent unhandled pool-level errors from crashing the application
if (pool) {
  pool.on('error', (err: any) => {
    console.error('Unexpected error on idle SQL pool client:', err);
  });
}

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfig } from '../config/AppConfig';
import { IDatabaseConfig } from '../config/IConfig';
import { drizzleSchema } from '../db/drizzleSchema';

/**
 * Single Responsibility: manages ONLY PostgreSQL pg.Pool & Drizzle ORM lifecycle.
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  public readonly pool: Pool;
  public readonly db: NodePgDatabase<typeof drizzleSchema>;

  private constructor(config: IDatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 2500,
      max: 10,
    });
    this.pool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning]', err.message);
    });
    this.db = drizzle(this.pool, { schema: drizzleSchema });
  }

  public static getInstance(
    config: IDatabaseConfig = AppConfig.getInstance()
  ): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  public async testConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

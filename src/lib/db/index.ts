import { sql } from '@vercel/postgres';

export { sql };

/** Execute raw SQL query with logging */
export async function query<T>(sqlQuery: string, values?: unknown[]): Promise<T[]> {
  const result = await sql.query(sqlQuery, values);
  return result.rows as T[];
}

/** Check database connection health */
export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

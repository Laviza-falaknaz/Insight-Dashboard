import sql from "mssql";

// Strip tcp: prefix if present (Azure connection strings sometimes include this)
const serverName = (process.env.SQL_SERVER || "").replace(/^tcp:/i, "");

const config: sql.config = {
  server: serverName,
  database: process.env.SQL_DATABASE || "",
  user: process.env.SQL_USERNAME || "",
  password: process.env.SQL_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(config);
    console.log("Connected to SQL Server");
  }
  return pool;
}

export async function query<T>(queryString: string): Promise<T[]> {
  const poolConnection = await getPool();
  const result = await poolConnection.request().query(queryString);
  return result.recordset as T[];
}

export async function queryWithParams<T>(
  queryString: string,
  params: Record<string, { type: sql.ISqlType; value: unknown }>
): Promise<T[]> {
  const poolConnection = await getPool();
  const request = poolConnection.request();
  
  for (const [name, param] of Object.entries(params)) {
    request.input(name, param.type, param.value);
  }
  
  const result = await request.query(queryString);
  return result.recordset as T[];
}

export { sql };

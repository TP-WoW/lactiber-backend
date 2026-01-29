
require('dotenv').config();
const sql = require('mssql');

const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  server: process.env.SQL_SERVER,
  port: parseInt(process.env.SQL_PORT, 10) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig);
  }
  return poolPromise;
}

async function testSqlConnection() {
  try {
    const pool = await getPool();
    await pool.connect();
    return `Conexión exitosa a SQL Server: ${sqlConfig.server}, Base de datos: ${sqlConfig.database}`;
  } catch (err) {
    return 'Error de conexión: ' + err.message;
  }
}

module.exports = {
  sqlConfig,
  testSqlConnection,
  getPool,
  sql,
  testSqlConnection
};

const { sql, getPool } = require('../database');

async function login(req, res) {
    console.log('Login - Payload:', req.body);
  try {
    const { email, password } = req.body;    
    const pool = await getPool();
    const result = await pool.request()
      .input('Email', sql.NVarChar(256), email)
      .input('Password', sql.NVarChar(256), password)      
      .execute('usp_I_Login');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error al logarse:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  login
};

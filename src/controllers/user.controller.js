
const { sql, getPool } = require("../database");

async function getAllUsers(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().execute("usp_S_Users_GetAll");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .execute("usp_S_Users_GetById");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password } = req.body;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Name", sql.NVarChar(100), name)
      .input("Email", sql.NVarChar(256), email)
      .input("Password", sql.NVarChar(256), password)
      .input("ReturnInserted", sql.Bit, 1)
      .execute("usp_I_User");
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .input("Name", sql.NVarChar(100), name)
      .input("Email", sql.NVarChar(256), email)
      .input("Password", sql.NVarChar(256), password)
      .execute("usp_U_User");
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool
      .request()

      .input("Id", sql.UniqueIdentifier, id)
      .execute("usp_D_User");
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};

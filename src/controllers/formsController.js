const { sql, getPool } = require('../database');

// Obtener todos los formularios
async function getForms(req, res) {
  try {
    const {
      search = null,
      status = null,
      createdBy = null,
      fromUtc = null,
      toUtc = null,
      orderBy = 'CreatedAt',
      orderDir = 'DESC',
      pageNumber = 1,
      pageSize = 50
    } = req.query;

    const pool = await getPool();
    const result = await pool.request()
      .input('Search', sql.NVarChar(200), search)
      .input('Status', sql.NVarChar(20), status)
      .input('CreatedBy', sql.NVarChar(100), createdBy)
      .input('FromUtc', sql.DateTime2(3), fromUtc)
      .input('ToUtc', sql.DateTime2(3), toUtc)
      .input('OrderBy', sql.NVarChar(30), orderBy)
      .input('OrderDir', sql.NVarChar(4), orderDir)
      .input('PageNumber', sql.Int, pageNumber)
      .input('PageSize', sql.Int, pageSize)
      .execute('usp_S_Forms_List');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Obtener un formulario por ID
async function getFormById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .execute('usp_S_Forms_GetById');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Crear un nuevo formulario
async function createForm(req, res) {
  try {
    const { title, description, createdBy, status } = req.body;    
    const pool = await getPool();
    const result = await pool.request()
      .input('Title', sql.NVarChar(200), title)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('CreatedBy', sql.NVarChar(100), createdBy)
      .input('Status', sql.NVarChar(20), status)
      .input('ReturnInserted', sql.Bit, 1)
      .execute('usp_I_Forms');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Actualizar un formulario
async function updateForm(req, res) {
  try {
    const { id } = req.params;
    const { title, description, status, correlationId } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .input('Title', sql.NVarChar(200), title)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('Status', sql.NVarChar(20), status)
      .input('CorrelationId', sql.UniqueIdentifier, correlationId)
      .execute('usp_U_Forms_Update');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Eliminar un formulario
async function deleteForm(req, res) {
  try {
    const { id } = req.params;
    const { correlationId } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .input('CorrelationId', sql.UniqueIdentifier, correlationId)
      .execute('usp_D_Forms_Delete');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm
};

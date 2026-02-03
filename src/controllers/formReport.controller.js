const { MAX } = require('mssql');
const { sql, getPool } = require('../database');

// Obtener todos los formularios
async function getAll(req, res) {
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
      .execute('usp_S_FormReports_List');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Obtener un formulario por ID y sus atributos
async function getOne(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .execute('usp_S_FormReports_GetById');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Crear un nuevo formulario
async function add(req, res) {
    console.log('Crear un nuevo formulario - Payload:', req.body);
  try {
    const { name, formId, description, createdBy, status = 'new' } = req.body;    
    const pool = await getPool();
    const result = await pool.request()
      .input('Name', sql.NVarChar(200), name)
      .input('FormId', sql.UniqueIdentifier, formId)
      .input('Description', sql.NVarChar(MAX), description)
      .input('CreatedBy', sql.NVarChar(100), createdBy)
      .input('Status', sql.NVarChar(20), status)
      .input('ReturnInserted', sql.Bit, 1)
      .execute('usp_I_FormReport');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error al crear un nuevo formulario:', err);
    res.status(500).json({ error: err.message });
  }
}

// Crear un nuevo formulario
async function submit(req, res) {
    console.log('submit form:', req.body);
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Json', sql.NVarChar(MAX), JSON.stringify(req.body))
      .execute('usp_I_FormReportResults');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error al enviar un formulario:', err);
    res.status(500).json({ error: err.message });
  }
}

// Actualizar un formulario
async function update(req, res) {
  try {
    console.log('Update form - Payload:', req.body);
    const { id } = req.params;
    const { description, status, optionsJson, assignedTo, reviewer } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('Status', sql.NVarChar(20), status)
      .input('OptionsJson', sql.NVarChar(sql.MAX), optionsJson)
      .input('AssignedTo', sql.NVarChar(100), assignedTo)
      .input('Reviewer', sql.NVarChar(100), reviewer)
      .execute('usp_U_FormReports_Update');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Eliminar un formulario
async function remove(req, res) {
  try {
    const { id } = req.params;
    const { correlationId } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .input('CorrelationId', sql.UniqueIdentifier, correlationId)
      .execute('usp_D_FormReports_Delete');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAll,
  getOne,
  add,
  submit,
  update,
  remove
};

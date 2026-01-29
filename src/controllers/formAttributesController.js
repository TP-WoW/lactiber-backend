const { sql, getPool } = require("../database");

// Obtener todos los formularios
async function getFormAttributes(req, res) {
  try {
    const { formId } = req.query;
    if (!formId) {
      return res
        .status(400)
        .json({ error: "El parámetro formId es requerido" });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("FormId", sql.UniqueIdentifier, formId)
      .execute("usp_SA_Form_Attributes");

    // Función para convertir PascalCase a camelCase
    function toCamelCase(str) {
      return str.charAt(0).toLowerCase() + str.slice(1);
    }

    // Convertir todas las claves de los objetos del recordset a camelCase
    const camelCased = result.recordset.map((row) => {
      const newRow = {};
      for (const key in row) {
        newRow[toCamelCase(key)] = row[key];
      }
      return newRow;
    });
    res.json(camelCased);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Obtener un formulario por ID
async function getAttributeById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .execute("usp_S_Form_Attribute");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Atributo no encontrado" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Crear un nuevo formulario
async function addFormAttribute(req, res) {
  try {
    const { items } = req.body; // items debe ser un array de objetos con la estructura de FormAttributeInsertType
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "El parámetro items es requerido y debe ser un array no vacío",
      });
    }
    const pool = await getPool();
    // Crear un objeto Table para el TVP con el esquema real
    const tvp = new sql.Table("FormAttributeInsertType");
    tvp.columns.add("Id", sql.UniqueIdentifier, { nullable: true });
    tvp.columns.add("FormId", sql.UniqueIdentifier, { nullable: false });
    tvp.columns.add("PanelId", sql.UniqueIdentifier, { nullable: true });
    tvp.columns.add("Name", sql.NVarChar(200), { nullable: false });
    tvp.columns.add("Label", sql.NVarChar(400), { nullable: false });
    tvp.columns.add("DataType", sql.NVarChar(60), { nullable: false });
    tvp.columns.add("Description", sql.NVarChar(1000), { nullable: true });
    tvp.columns.add("MaxLength", sql.Int, { nullable: true });
    tvp.columns.add("MinLength", sql.Int, { nullable: true });
    tvp.columns.add("Max", sql.Decimal(18, 6), { nullable: true });
    tvp.columns.add("Min", sql.Decimal(18, 6), { nullable: true });
    tvp.columns.add("IsRequired", sql.Bit, { nullable: false });
    tvp.columns.add("DefaultValue", sql.NVarChar(50), { nullable: true });
    tvp.columns.add("OrderIndex", sql.Int, { nullable: false });
    tvp.columns.add("CreatedAt", sql.DateTime2(3), { nullable: true });
    tvp.columns.add("CreatedBy", sql.NVarChar(100), { nullable: true });
    tvp.columns.add("OptionsJson", sql.NVarChar(sql.MAX), { nullable: true });

    items.forEach((item, idx) => {
      tvp.rows.add(
        item.id ?? null,
        item.formId,
        item.panelId ?? null,
        item.name,
        item.label,
        item.dataType,
        item.description ?? null,
        item.maxLength ?? null,
        item.minLength ?? null,
        item.max ?? null,
        item.min ?? null,
        item.isRequired ? 1 : 0,
        item.defaultValue ?? null,
        item.orderIndex,
        item.createdAt ?? null,
        item.createdBy ?? null,
        item.optionsJson ?? null,
      );
    });

    const result = await pool
      .request()
      .input("Items", tvp)
      .input("ReturnInserted", sql.Bit, 1)
      .execute("usp_I_Form_Attributes");
    res.status(201).json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Actualizar un formulario
async function updateFormAttribute(req, res) {
  try {
    const { items, updatedBy } = req.body; // items debe ser un array de objetos con la estructura de FormAttributeUpdateType
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "El parámetro items es requerido y debe ser un array no vacío",
      });
    }
    if (!updatedBy) {
      return res
        .status(400)
        .json({ error: "El parámetro updatedBy es requerido" });
    }
    const pool = await getPool();
    // Crear un objeto Table para el TVP con el esquema real
    const tvp = new sql.Table("FormAttributeUpdateType");
    tvp.columns.add("Id", sql.UniqueIdentifier, { nullable: true });
    tvp.columns.add("FormId", sql.UniqueIdentifier, { nullable: false });
    tvp.columns.add("PanelId", sql.UniqueIdentifier, { nullable: true });
    tvp.columns.add("Name", sql.NVarChar(100), { nullable: false });
    tvp.columns.add("Label", sql.NVarChar(200), { nullable: false });
    tvp.columns.add("DataType", sql.NVarChar(30), { nullable: false });
    tvp.columns.add("Description", sql.NVarChar(500), { nullable: true });
    tvp.columns.add("MaxLength", sql.Int, { nullable: true });
    tvp.columns.add("MinLength", sql.Int, { nullable: true });
    tvp.columns.add("Max", sql.Decimal(18, 6), { nullable: true });
    tvp.columns.add("Min", sql.Decimal(18, 6), { nullable: true });
    tvp.columns.add("IsRequired", sql.Bit, { nullable: false });
    tvp.columns.add("DefaultValue", sql.NVarChar(50), { nullable: true });
    tvp.columns.add("OrderIndex", sql.Int, { nullable: false });
    tvp.columns.add("OptionsJson", sql.NVarChar(sql.MAX), { nullable: true });

    items.forEach((item) => {
      tvp.rows.add(
        item.Id ?? null,
        item.FormId,
        item.PanelId ?? null,
        item.Name,
        item.Label,
        item.DataType,
        item.Description ?? null,
        item.MaxLength ?? null,
        item.MinLength ?? null,
        item.Max ?? null,
        item.Min ?? null,
        item.IsRequired,
        item.DefaultValue ?? null,
        item.OrderIndex,
        item.OptionsJson ?? null,
      );
    });

    const result = await pool
      .request()
      .input("Items", tvp)
      .input("UpdatedBy", sql.NVarChar(100), updatedBy)
      .input("ReturnUpdated", sql.Bit, 1)
      .execute("usp_U_Form_Attributes");
    res.status(200).json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Eliminar un formulario
async function deleteFormAttribute(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .execute("usp_D_Form_Attribute");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Atributo no encontrado" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getFormAttributes,
  getAttributeById,
  addFormAttribute,
  updateFormAttribute,
  deleteFormAttribute,
};

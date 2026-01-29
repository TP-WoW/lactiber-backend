require('dotenv').config();
const express = require('express');
const cors = require('cors');
const formsRoutes = require('./routes/forms');
const formAttributesRoutes = require('./routes/formAttributes');
const { testSqlConnection } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/forms', formsRoutes);
app.use('/api/form-attributes', formAttributesRoutes);
app.get('/api/dbtest', async (req, res) => {
	const resultado = await testSqlConnection();
	res.json({ resultado });
});
// Ejemplo de uso de variables de entorno
// console.log(process.env.SQL_SERVER, process.env.SQL_DATABASE);
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
	res.send('API funcionando');
});

app.get('/api/ejemplo', (req, res) => {
	res.json({ mensaje: 'Este es un endpoint de ejemplo', fecha: new Date() });
});

app.listen(PORT, async () => {
	console.log(`Servidor escuchando en http://localhost:${PORT}`);
    console.log(await testSqlConnection());
});

// Incluir el servicio de evento periódico
require('./services/eventTrigger');

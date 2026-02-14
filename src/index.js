require('dotenv').config();
const express = require('express');
const cors = require('cors');
const formsRoutes = require('./routes/forms.route');
const formAttributesRoutes = require('./routes/formAttributes.route');
const formReportsRoutes = require('./routes/formReport.route');
const loginRoutes = require('./routes/login.route');
const userRoutes = require('./routes/user.route');
const { testSqlConnection } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/forms', formsRoutes);
app.use('/api/form-attributes', formAttributesRoutes);
app.use('/api/form-reports', formReportsRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/users', userRoutes);
app.get('/api/dbtest', async (req, res) => {
	const resultado = await testSqlConnection();
	res.json({ resultado });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
	console.log(`Servidor escuchando en http://localhost:${PORT}`);
    console.log(await testSqlConnection());
});

// Incluir el servicio de evento periódico
// require('./services/eventTrigger');
require('./services/worker');

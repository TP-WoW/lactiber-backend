// src/services/eventTrigger.js
require('dotenv').config();

function triggerEvent() {
  // Lógica del evento periódico
  console.log('Evento ejecutado:', new Date());
  // ...tu código aquí...
}

// Ejecutar cada x minutos (x * 60000 ms)
const intervalMinutes = parseInt(process.env.TRIGGER_INTERVAL_MINUTES, 10) || 5;
setInterval(triggerEvent, intervalMinutes * 60 * 1000);

// Si quieres que se ejecute también al iniciar:
triggerEvent();
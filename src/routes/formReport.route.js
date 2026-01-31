const express = require('express');
const router = express.Router();
const formsController = require('../controllers/formReport.controller');

router.get('/', formsController.getAll);
router.get('/:id', formsController.getOne);
router.post('/', formsController.add);
router.post('/submit', formsController.submit);
router.put('/:id', formsController.update);
router.delete('/:id', formsController.remove);

module.exports = router;

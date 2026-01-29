const express = require('express');
const router = express.Router();
const formsController = require('../controllers/formsController');

router.get('/', formsController.getForms);
router.get('/:id', formsController.getFormById);
router.post('/', formsController.createForm);
router.put('/:id', formsController.updateForm);
router.delete('/:id', formsController.deleteForm);

module.exports = router;

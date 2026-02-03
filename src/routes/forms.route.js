const express = require('express');
const router = express.Router();
const formsController = require('../controllers/forms.controller');

router.get('/', formsController.getForms);
router.get('/:id', formsController.getFormById);
router.post('/', formsController.createForm);
router.put('/:id', formsController.updateForm);
router.put('/publish/:id', formsController.publishForm);
router.delete('/:id', formsController.deleteForm);

module.exports = router;

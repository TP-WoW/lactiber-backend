const express = require('express');
const router = express.Router();
const formAttributesController = require('../controllers/formAttributes.controller');

router.get('/', formAttributesController.getFormAttributes);
router.get('/:id', formAttributesController.getAttributeById);
router.post('/', formAttributesController.addFormAttribute);
router.put('/:id', formAttributesController.updateFormAttribute);
router.delete('/:id', formAttributesController.deleteFormAttribute);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getApuntes,
  getApunteById,
  addApunte,
  deleteApunte    // importa el nuevo handler
} = require('../controllers/apuntesController');

router.get('/', getApuntes);
router.get('/:id', getApunteById);
router.post('/', addApunte);
router.delete('/:id', deleteApunte);   // registra la ruta DELETE

module.exports = router;

// routes/apuntes.js
const router = require('express').Router();
const { getApuntes, getApunte, crearApunte, borrarApunte } = require('../controllers/apuntesController');

router.get('/', getApuntes);
router.get('/:id', getApunte);
router.post('/', crearApunte);
router.delete('/:id', borrarApunte);

module.exports = router;

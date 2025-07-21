const express = require('express');
const router = express.Router();
const { getApuntes, addApunte } = require('../controllers/apuntesController');

router.get('/', getApuntes);
router.post('/', addApunte);

module.exports = router;

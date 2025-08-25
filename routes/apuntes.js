const express = require('express');
const router = express.Router();
const {
  getApuntes,
  getApunteById,
  addApunte,
  deleteApunte    // importa el nuevo handler
} = require('../controllers/apuntesController');
/**
 * @openapi
 * /apuntes:
 *   get:
 *     summary: Obtener todos los apuntes
 *     responses:
 *       200:
 *         description: Lista de apuntes
 */
router.get('/', getApuntes);
/**
 * @openapi
 * /apuntes/{id}:
 *   get:
 *     summary: Obtener un apunte por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del apunte
 *     responses:
 *       200:
 *         description: Detalles del apunte
 *       404:
 *         description: Apunte no encontrado
 */
router.get('/:id', getApunteById);
router.post('/', addApunte);
router.delete('/:id', deleteApunte);   // registra la ruta DELETE

module.exports = router;

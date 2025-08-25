const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/Auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *         password:
 *           type: string
 *       required:
 *         - email
 *         - password
 */
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       400:
 *         description: Invalid credentials
 */
router.post('/login', (req, res) => {
  // Handle login logic
  res.send('Login successful');
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid user data
 */
router.post('/register', (req, res) => {
  // Handle registration logic
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout a user
 *     responses:
 *       200:
 *         description: User logged out successfully
 *       400:
 *         description: Invalid request
 */
router.post('/logout', (req, res) => {
  // Handle logout logic
});


/**
 * @swagger
 * /auth/protected:
 *   post:
 *     summary: Protected route
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       403:
 *         description: Access denied
 */
router.post('/auth', authenticateToken, (req, res) => {
  res.send('Esta es una ruta protegida');
});

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh user token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       400:
 *         description: Invalid request
 */
router.post('/refresh-token', (req, res) => {
  // Handle token refresh logic
});

module.exports = router;
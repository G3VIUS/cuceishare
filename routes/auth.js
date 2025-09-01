const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const { v4: uuidv4} = require('uuid');
const bcrypt = require("bcryptjs");
require('dotenv').config();
const {
  registUser,
  findById,
  findByUsername
} = require('../controllers/AuthController')
const authenticateToken = require('../middleware/Auth')

const SECRET_SIGN =  process.env.JWT_ACCESS_SECRET;
const SECRET_REFRESH_SIGN =  process.env.JWT_REFRESH_SECRET;

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
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
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!password || !username) {
    return res.status(400).json({ message: "Debes enviar password y email" });
  }
  const user = await findByUsername(username)
  if(!user){
    res.status(404).json({message:"usuario no encontrado"})
  }
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid){
    res.send("credenciles invalidas")
  }
  const AccessToken = jwt.sign({ id: user.id },SECRET_SIGN, { expiresIn: "6h" });
  const RefreshToken = jwt.sign({ id: user.id},SECRET_REFRESH_SIGN, { expiresIn: "20d" });
  const response = {
    AccessToken:AccessToken,
    RefreshToken:RefreshToken
  }
  res.json(response);
});


/**
 * @swagger
 * /auth/test-token:
 *   post:
 *     summary: Verifica un token JWT y devuelve la información del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token válido, retorna la información del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token válido
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: juan123
 *       401:
 *         description: Token faltante, expirado o usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token requerido
 *       403:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token inválido
 */
router.post('/test-token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  try {
    const payload = jwt.verify(token, SECRET_SIGN);
    if (!payload) return res.status(401).json({ message: "token expirado" });
    const userId = payload.id;
    const user = await findById(userId);
    if (!user) return res.status(401).json({ message: "usuario no encontrado" });
    return res.json({ message: 'Token válido', user });
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido' });
  }
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
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "jair123"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MiPassSegura123"
 *               role:
 *                 type: string
 *                 example: "user"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid user data
 */
router.post('/register', async (req, res) => {
  // Handle registration logic
  const{username, password ,role} = req.body;
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const hoy = new Date();
  const fechaSimple = hoy.toISOString().split('T')[0];
  const id = uuidv4();
  console.log(fechaSimple);
  const usuarioTosave = {
    id:id,
    username:username,
    hash:hash,
    role:role,
    createAt:fechaSimple,
    lastlogin:fechaSimple
  }
  result = await registUser(usuarioTosave)
  res.send(result)
});


/**
 * /**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout a user
 *     security:
 *       - bearerAuth: []   # Esto indica que requiere token
 *     responses:
 *       200:
 *         description: User logged out successfully
 *       401:
 *         description: Token requerido o inválido
 */
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'User logged out successfully', user: req.user });
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresca el access token usando un refresh token válido
 *     description: Devuelve un nuevo access token si el refresh token es válido.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI...
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI...
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Token inválido o expirado
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Token requerido' });

  try {
    const payload = jwt.verify(refreshToken, SECRET_REFRESH_SIGN);
    if (!payload) return res.status(401).json({ message: 'Token expirado' });

    // Obtener usuario usando el id del payload del refresh token
    const user = await findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    // Generar nuevo access token
    const accessToken = jwt.sign({ id: user.id }, SECRET_SIGN, { expiresIn: '6h' });

    return res.json({
      message: 'Token refrescado correctamente',
      accessToken,
      refreshToken,
      user
    });
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido' });
  }
});



module.exports = router;
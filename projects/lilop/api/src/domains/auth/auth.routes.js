const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const UsuarioRepository = require('./UsuarioRepository');
const { AuthService } = require('./AuthService');
const AuthController = require('./AuthController');

/**
 * Composition root del dominio: aquí, y SOLO aquí, se instancian las
 * clases concretas con el pool real de Postgres y bcrypt/jwt reales.
 * Reemplaza a controllers/auth.js + routes/auth.js (versión
 * funcional) — mismas rutas, mismo middleware por ruta, sin cambios
 * de contrato. El middleware `auth` (verificación de JWT) se mantiene
 * tal cual en middleware/auth.js: es infraestructura transversal
 * usada por todos los dominios, no lógica de negocio de este dominio.
 */
const usuarioRepository = new UsuarioRepository(pool);
const authService = new AuthService(
  { usuarios: usuarioRepository },
  { bcrypt, jwt, jwtSecret: process.env.JWT_SECRET }
);
const authController = new AuthController(authService);

const router = express.Router();

router.post('/login', authController.login);
router.get('/vendedores', auth, authController.vendedores);

module.exports = router;

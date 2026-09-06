const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../config/db');
const { auth, soloAdmin } = require('../../middleware/auth');

const UsuarioRepository = require('./UsuarioRepository');
const { UsuarioService } = require('./UsuarioService');
const UsuarioController = require('./UsuarioController');

/**
 * Composition root del dominio: instancia las clases con el pool y
 * bcrypt reales. Reemplaza a controllers/usuarios.js + routes/usuarios.js
 * (versión funcional) — mismas rutas, mismo middleware, sin cambios de
 * contrato.
 */
const usuarioRepository = new UsuarioRepository(pool);
const usuarioService = new UsuarioService({ usuarios: usuarioRepository }, { bcrypt });
const usuarioController = new UsuarioController(usuarioService);

const router = express.Router();
router.get('/',                auth, soloAdmin, usuarioController.listar);
router.get('/:id',             auth, soloAdmin, usuarioController.obtener);
router.post('/',               auth, soloAdmin, usuarioController.crear);
router.put('/:id',             auth, soloAdmin, usuarioController.actualizar);
router.patch('/:id/password',  auth, soloAdmin, usuarioController.cambiarPassword);
router.delete('/:id',          auth, soloAdmin, usuarioController.eliminar);

module.exports = router;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = result.rows[0];
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      usuario: {
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol,
      },
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const vendedores = async (req, res) => {
  const { rol } = req.query;
  try {
    const result = rol
      ? await pool.query('SELECT id, nombre FROM usuarios WHERE activo = true AND rol = $1 ORDER BY nombre', [rol])
      : await pool.query('SELECT id, nombre FROM usuarios WHERE activo = true ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar vendedores:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, vendedores };

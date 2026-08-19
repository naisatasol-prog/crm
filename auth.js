// routes/auth.js
const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const Usuario  = require('../models/Usuario');
const { verificarToken } = require('../middleware/auth');

const generarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '8h' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });

    const usuario = await Usuario.findOne({ email }).populate('clienteId');
    if (!usuario || !(await usuario.compararPassword(password)))
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });

    if (!usuario.activo)
      return res.status(403).json({ ok: false, error: 'Cuenta inactiva' });

    const token = generarToken(usuario._id);
    res.json({
      ok: true,
      token,
      usuario: {
        id:       usuario._id,
        nombre:   usuario.nombre,
        email:    usuario.email,
        rol:      usuario.rol,
        avatar:   usuario.avatar,
        cliente:  usuario.clienteId,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', verificarToken, async (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
});

// POST /api/auth/registro-admin  (crear primer admin)
router.post('/registro-admin', async (req, res) => {
  try {
    const { nombre, email, password, secretKey } = req.body;
    if (secretKey !== process.env.JWT_SECRET)
      return res.status(403).json({ ok: false, error: 'Clave secreta incorrecta' });

    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(400).json({ ok: false, error: 'Email ya registrado' });

    const admin = await Usuario.create({ nombre, email, password, rol: 'admin' });
    const token = generarToken(admin._id);
    res.status(201).json({ ok: true, token, usuario: { id: admin._id, nombre: admin.nombre, rol: admin.rol } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

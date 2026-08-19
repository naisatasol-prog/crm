// middleware/auth.js
const jwt     = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

exports.verificarToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ ok: false, error: 'Token requerido' });

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario   = await Usuario.findById(decoded.id).select('-password');
    if (!req.usuario) return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
};

exports.soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin')
    return res.status(403).json({ ok: false, error: 'Acceso denegado — solo administradores' });
  next();
};

exports.soloCliente = (req, res, next) => {
  if (req.usuario.rol !== 'cliente')
    return res.status(403).json({ ok: false, error: 'Acceso denegado — solo clientes' });
  next();
};

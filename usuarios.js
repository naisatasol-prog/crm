// routes/usuarios.js
const router  = require('express').Router();
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const Ticket  = require('../models/Ticket');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// KPIs del dashboard admin
router.get('/stats/dashboard', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [totalClientes, totalTickets, ticketsAbiertos, ticketsEnProceso] = await Promise.all([
      Cliente.countDocuments({ estado: 'activo' }),
      Ticket.countDocuments(),
      Ticket.countDocuments({ estado: 'abierto' }),
      Ticket.countDocuments({ estado: 'en_proceso' }),
    ]);
    // Tickets por mes (últimos 6 meses)
    const seisMeses = new Date();
    seisMeses.setMonth(seisMeses.getMonth() - 6);
    const ticketsPorMes = await Ticket.aggregate([
      { $match: { createdAt: { $gte: seisMeses } } },
      { $group: { _id: { mes: { $month: '$createdAt' }, año: { $year: '$createdAt' } }, total: { $sum: 1 } } },
      { $sort: { '_id.año': 1, '_id.mes': 1 } }
    ]);
    res.json({ ok: true, totalClientes, totalTickets, ticketsAbiertos, ticketsEnProceso, ticketsPorMes });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Listar usuarios (solo admin)
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-password').populate('clienteId', 'empresa').lean();
    res.json({ ok: true, usuarios });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Actualizar usuario
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, rest, { new: true }).select('-password');
    res.json({ ok: true, usuario });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Desactivar usuario
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await Usuario.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ ok: true, mensaje: 'Usuario desactivado' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

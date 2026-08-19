// routes/tickets.js
const router  = require('express').Router();
const Ticket  = require('../models/Ticket');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Todos los tickets (admin) o los del cliente (cliente)
router.get('/', verificarToken, async (req, res) => {
  try {
    const filtro = req.usuario.rol === 'admin'
      ? {}
      : { cliente: req.usuario.clienteId };
    const tickets = await Ticket.find(filtro)
      .populate('cliente', 'empresa')
      .populate('asignadoA', 'nombre')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, tickets });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Detalle
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('cliente', 'empresa email')
      .populate('asignadoA', 'nombre email');
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });
    res.json({ ok: true, ticket });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Crear ticket (cliente o admin)
router.post('/', verificarToken, async (req, res) => {
  try {
    const clienteId = req.usuario.rol === 'cliente'
      ? req.usuario.clienteId
      : req.body.cliente;
    const ticket = await Ticket.create({ ...req.body, cliente: clienteId });
    res.status(201).json({ ok: true, ticket });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Actualizar estado / asignación (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ok: true, ticket });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Agregar mensaje al hilo
router.post('/:id/mensaje', verificarToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });
    ticket.mensajes.push({
      autor:   req.usuario.nombre,
      mensaje: req.body.mensaje,
      rol:     req.usuario.rol,
    });
    await ticket.save();
    res.json({ ok: true, ticket });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Eliminar (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Ticket eliminado' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

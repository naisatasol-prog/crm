// routes/cotizaciones.js
const router      = require('express').Router();
const Cotizacion  = require('../models/Cotizacion');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const calcularTotales = (partidas = []) => {
  const subtotal = partidas.reduce((s, p) => s + (p.cantidad * p.precioUnit), 0);
  const iva      = parseFloat((subtotal * 0.16).toFixed(2));
  const total    = parseFloat((subtotal + iva).toFixed(2));
  return { subtotal, iva, total };
};

// Listar
router.get('/', verificarToken, async (req, res) => {
  try {
    const filtro = req.usuario.rol === 'admin'
      ? {}
      : { cliente: req.usuario.clienteId };
    const cotizaciones = await Cotizacion.find(filtro)
      .populate('cliente', 'empresa')
      .populate('creadoPor', 'nombre')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, cotizaciones });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Detalle
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const cot = await Cotizacion.findById(req.params.id)
      .populate('cliente', 'empresa email rfc telefono direccion')
      .populate('creadoPor', 'nombre email');
    if (!cot) return res.status(404).json({ ok: false, error: 'Cotización no encontrada' });
    res.json({ ok: true, cotizacion: cot });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Crear (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const totales = calcularTotales(req.body.partidas);
    const cot = await Cotizacion.create({
      ...req.body,
      ...totales,
      creadoPor: req.usuario._id,
    });
    res.status(201).json({ ok: true, cotizacion: cot });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Actualizar (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    if (req.body.partidas) {
      const totales = calcularTotales(req.body.partidas);
      Object.assign(req.body, totales);
    }
    const cot = await Cotizacion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cot) return res.status(404).json({ ok: false, error: 'Cotización no encontrada' });
    res.json({ ok: true, cotizacion: cot });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Eliminar (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await Cotizacion.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Cotización eliminada' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Estadísticas KPIs (solo admin)
router.get('/stats/resumen', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [total, aprobadas, pendientes] = await Promise.all([
      Cotizacion.countDocuments(),
      Cotizacion.countDocuments({ estado: 'aprobada' }),
      Cotizacion.countDocuments({ estado: 'enviada' }),
    ]);
    const ingresos = await Cotizacion.aggregate([
      { $match: { estado: 'aprobada' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    res.json({ ok: true, total, aprobadas, pendientes, ingresos: ingresos[0]?.total || 0 });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

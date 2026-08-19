// routes/clientes.js
const router   = require('express').Router();
const Cliente  = require('../models/Cliente');
const Usuario  = require('../models/Usuario');
const Sitio    = require('../models/Sitio');
const Area     = require('../models/Area');
const Equipo   = require('../models/Equipo');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// GET /api/clientes — listar (solo admin)
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ createdAt: -1 }).lean();
    res.json({ ok: true, clientes });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/clientes/:id — detalle
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id).lean();
    if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    res.json({ ok: true, cliente });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/clientes — crear (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.create(req.body);
    res.status(201).json({ ok: true, cliente });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/clientes/:id — actualizar (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    res.json({ ok: true, cliente });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/clientes/:id — eliminar (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const clienteId = req.params.id;

    // Buscar sitios y areas en paralelo donde sea posible
    const sitios = await Sitio.find({ cliente: clienteId }).select('_id').lean();
    const sitioIds = sitios.map(s => s._id);
    const areas = await Area.find({ sitio: { $in: sitioIds } }).select('_id').lean();
    const areaIds = areas.map(a => a._id);

    // Eliminar en paralelo donde no haya dependencias
    await Promise.all([
      Equipo.deleteMany({ area: { $in: areaIds } }),
      Usuario.deleteMany({ clienteId: clienteId }),
    ]);
    await Promise.all([
      Area.deleteMany({ sitio: { $in: sitioIds } }),
      Sitio.deleteMany({ cliente: clienteId }),
    ]);
    await Cliente.findByIdAndDelete(clienteId);

    res.json({ ok: true, mensaje: 'Cliente y toda su topología eliminados correctamente' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/clientes/:id/usuario — crear usuario para el cliente
router.post('/:id/usuario', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(400).json({ ok: false, error: 'Email ya registrado' });

    const usuario = await Usuario.create({
      nombre, email, password,
      rol: 'cliente',
      clienteId: req.params.id,
    });
    res.status(201).json({ ok: true, usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email } });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

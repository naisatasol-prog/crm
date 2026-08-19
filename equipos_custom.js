// routes/equipos_custom.js
const router = require('express').Router();
const CatalogoCustom = require('../models/CatalogoCustom');
const { verificarToken } = require('../middleware/auth');

// GET /api/custom-devices — Listar todos los equipos personalizados
router.get('/', verificarToken, async (req, res) => {
  try {
    const dispositivos = await CatalogoCustom.find().sort({ createdAt: -1 }).lean();
    res.json({ ok: true, dispositivos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/custom-devices — Crear nuevo equipo personalizado
router.post('/', verificarToken, async (req, res) => {
  try {
    const dispositivo = await CatalogoCustom.create(req.body);
    res.status(201).json({ ok: true, dispositivo });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// PUT /api/custom-devices/:id — Editar equipo personalizado
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const dispositivo = await CatalogoCustom.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dispositivo) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, dispositivo });
  } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
});

// DELETE /api/custom-devices/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await CatalogoCustom.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

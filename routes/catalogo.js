const express = require('express');
const router = express.Router();
const CatalogoEquipo = require('../models/CatalogoEquipo');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '../../administracion/public/uploads/equipos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'cat_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// GET /api/catalogo
router.get('/', verificarToken, async (req, res) => {
  try {
    const equipos = await CatalogoEquipo.find().sort({ nombre: 1 }).lean();
    res.json({ ok: true, equipos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/catalogo
router.post('/', verificarToken, soloAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, tipo, num_puertos, capacidad_puertos, rack_unidades, es_rackeable } = req.body;
    let imagen_url = '';
    if (req.file) {
      imagen_url = 'uploads/equipos/' + req.file.filename;
    }
    const nuevoEquipo = await CatalogoEquipo.create({
      nombre, tipo, imagen_url,
      num_puertos: parseInt(num_puertos) || 0,
      capacidad_puertos: capacidad_puertos || '1G',
      rack_unidades: rack_unidades ? parseInt(rack_unidades) : 1,
      es_rackeable: es_rackeable === undefined ? true : (es_rackeable === 'true' || es_rackeable === true)
    });
    res.status(201).json({ ok: true, equipo: nuevoEquipo });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/catalogo/:id
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await CatalogoEquipo.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const Plano = require('../models/Plano');
const MarcadorPlano = require('../models/MarcadorPlano');

// Configuración de Multer para planos y marcadores
const uploadDirPlanos = path.join(__dirname, '../../administracion/public/uploads/planos');
if (!fs.existsSync(uploadDirPlanos)) fs.mkdirSync(uploadDirPlanos, { recursive: true });

const uploadDirMarcadores = path.join(__dirname, '../../administracion/public/uploads/marcadores');
if (!fs.existsSync(uploadDirMarcadores)) fs.mkdirSync(uploadDirMarcadores, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'imagen_plano') cb(null, uploadDirPlanos);
    else if (file.fieldname === 'foto_marcador') cb(null, uploadDirMarcadores);
    else cb(null, uploadDirPlanos);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ── RUTAS DE PLANOS ──

// GET /api/planos/area/:areaId
router.get('/area/:areaId', verificarToken, async (req, res) => {
  try {
    const planos = await Plano.find({ area: req.params.areaId }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, planos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/planos/:sitioId
router.get('/:sitioId', verificarToken, async (req, res) => {
  try {
    const planos = await Plano.find({ sitio: req.params.sitioId }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, planos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/planos
router.post('/', verificarToken, soloAdmin, upload.single('imagen_plano'), async (req, res) => {
  try {
    const { sitio, area, nombre } = req.body;
    if (!req.file) return res.status(400).json({ ok: false, error: 'Se requiere una imagen del plano' });
    
    const planoData = {
      nombre: nombre || 'Plano General',
      imagen_url: 'uploads/planos/' + req.file.filename
    };
    if (sitio) planoData.sitio = sitio;
    if (area) planoData.area = area;

    const plano = await Plano.create(planoData);
    res.status(201).json({ ok: true, plano });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/planos/:id
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const planoId = req.params.id;
    await MarcadorPlano.deleteMany({ plano: planoId });
    await Plano.findByIdAndDelete(planoId);
    res.json({ ok: true, mensaje: 'Plano y marcadores eliminados' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── RUTAS DE MARCADORES ──

// GET /api/planos/marcadores/:planoId
router.get('/marcadores/:planoId', verificarToken, async (req, res) => {
  try {
    const marcadores = await MarcadorPlano.find({ plano: req.params.planoId }).lean();
    res.json({ ok: true, marcadores });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/planos/marcadores
router.post('/marcadores', verificarToken, soloAdmin, upload.single('foto_marcador'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      const originalPath = req.file.path;
      const webpFilename = `${req.file.filename.split('.')[0]}.webp`;
      const webpPath = path.join(uploadDirMarcadores, webpFilename);
      
      await sharp(originalPath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(webpPath);
        
      fs.unlinkSync(originalPath); // Eliminar original
      data.foto_url = 'uploads/marcadores/' + webpFilename;
    }
    const marcador = await MarcadorPlano.create(data);
    res.status(201).json({ ok: true, marcador });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/planos/marcadores/:id
router.put('/marcadores/:id', verificarToken, soloAdmin, upload.single('foto_marcador'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      const originalPath = req.file.path;
      const webpFilename = `${req.file.filename.split('.')[0]}.webp`;
      const webpPath = path.join(uploadDirMarcadores, webpFilename);
      
      await sharp(originalPath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(webpPath);
        
      fs.unlinkSync(originalPath); // Eliminar original
      data.foto_url = 'uploads/marcadores/' + webpFilename;
    }
    const marcador = await MarcadorPlano.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ ok: true, marcador });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/planos/marcadores/:id
router.delete('/marcadores/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await MarcadorPlano.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Marcador eliminado' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

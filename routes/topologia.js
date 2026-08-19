// routes/topologia.js
const router  = require('express').Router();
const Sitio   = require('../models/Sitio');
const Area    = require('../models/Area');
const Cliente = require('../models/Cliente');
const Vlan    = require('../models/Vlan');
const Equipo  = require('../models/Equipo');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload dirs exist
const uploadDirEquipos = path.join(__dirname, '../../administracion/public/uploads/equipos');
if (!fs.existsSync(uploadDirEquipos)) fs.mkdirSync(uploadDirEquipos, { recursive: true });

const uploadDirAreas = path.join(__dirname, '../../administracion/public/uploads/areas');
if (!fs.existsSync(uploadDirAreas)) fs.mkdirSync(uploadDirAreas, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'foto') {
      cb(null, uploadDirAreas);
    } else {
      cb(null, uploadDirEquipos);
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// GET /api/topologia/arbol/:clienteId  (Admin y Cliente)
// Retorna la estructura jerárquica
router.get('/arbol/:clienteId?', verificarToken, async (req, res) => {
  try {
    let clienteId = req.usuario.rol === 'cliente' ? req.usuario.clienteId : req.params.clienteId;
    
    // Si es admin y no manda clienteId (por ejemplo, desde el dashboard de clientes), devolvemos el primer cliente o un error manejado
    if (!clienteId && req.usuario.rol === 'admin') {
      const primerCliente = await Cliente.findOne().select('_id');
      if (primerCliente) {
        clienteId = primerCliente._id;
      } else {
        return res.json({ ok: true, arbol: { organizacion: { empresa: 'Vista Global (Admin)' }, sitios: [] } });
      }
    } else if (!clienteId) {
      return res.status(400).json({ ok: false, error: 'Se requiere ID de Organización (Cliente)' });
    }

    // Cargar organizacion, sitios y areas en paralelo (1 round-trip menos a Atlas)
    const [organizacion, sitios] = await Promise.all([
      Cliente.findById(clienteId).select('empresa').lean(),
      Sitio.find({ cliente: clienteId }).lean()
    ]);
    if (!organizacion) return res.status(404).json({ ok: false, error: 'Organización no encontrada' });

    const sitioIds = sitios.map(s => s._id);
    const areas = await Area.find({ sitio: { $in: sitioIds } }).select('-simulador_data').lean();

    // Ensamblar árbol
    const sitiosConAreas = sitios.map(sitio => ({
      ...sitio,
      areas: areas.filter(a => a.sitio.toString() === sitio._id.toString())
    }));

    res.json({
      ok: true,
      arbol: {
        organizacion,
        sitios: sitiosConAreas
      }
    });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── RUTAS SOLO ADMIN (Creación y Edición) ──

// POST /api/topologia/sitios
router.post('/sitios', verificarToken, soloAdmin, async (req, res) => {
  try {
    const sitio = await Sitio.create(req.body);
    res.status(201).json({ ok: true, sitio });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/topologia/sitios/:id
router.put('/sitios/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const sitio = await Sitio.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ok: true, sitio });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/topologia/sitios/:id (Cascada)
router.delete('/sitios/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const sitioId = req.params.id;
    const areas = await Area.find({ sitio: sitioId }).lean();
    const areaIds = areas.map(a => a._id);
    await Equipo.deleteMany({ area: { $in: areaIds } });
    await Area.deleteMany({ sitio: sitioId });
    await Sitio.findByIdAndDelete(sitioId);
    
    res.json({ ok: true, mensaje: 'Sitio y su topología eliminados' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/topologia/areas
router.post('/areas', verificarToken, soloAdmin, upload.single('foto'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.foto_url = 'uploads/areas/' + req.file.filename;
    }
    const area = await Area.create(data);
    res.status(201).json({ ok: true, area });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/topologia/areas/:id
router.put('/areas/:id', verificarToken, soloAdmin, upload.single('foto'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.foto_url = 'uploads/areas/' + req.file.filename;
    }
    const area = await Area.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ ok: true, area });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/topologia/areas/:id (Cascada)
router.delete('/areas/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const areaId = req.params.id;
    await Equipo.deleteMany({ area: areaId });
    await Area.findByIdAndDelete(areaId);
    res.json({ ok: true, mensaje: 'Área y sus equipos eliminados' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/topologia/areas/:id/simulador
router.get('/areas/:id/simulador', verificarToken, async (req, res) => {
  try {
    const area = await Area.findById(req.params.id).select('simulador_data').lean();
    if (!area) return res.status(404).json({ ok: false, error: 'Área no encontrada' });
    res.json({ ok: true, simulador_data: area.simulador_data });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/topologia/areas/:id/simulador
router.put('/areas/:id/simulador', verificarToken, async (req, res) => {
  try {
    const { simulador_data } = req.body;
    await Area.findByIdAndUpdate(req.params.id, { simulador_data: simulador_data || '{}' });
    res.json({ ok: true, mensaje: 'Acomodo del simulador guardado exitosamente' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// (Multer setup moved to top)

// GET /api/topologia/equipos/:areaId
router.get('/equipos/:areaId', verificarToken, async (req, res) => {
  try {
    const equipos = await Equipo.find({ area: req.params.areaId }).lean();
    res.json({ ok: true, equipos });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/topologia/equipos
router.post('/equipos', verificarToken, soloAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, tipo, area, padre, padres_adicionales, imagen_url: bodyImageUrl, rack_posicion } = req.body;
    let imagen_url = bodyImageUrl || '';
    if (req.file) {
      imagen_url = 'uploads/equipos/' + req.file.filename;
    }
    // padres_adicionales puede venir como JSON string
    let padresArr = [];
    if (padres_adicionales) {
      try { padresArr = JSON.parse(padres_adicionales); } catch { padresArr = []; }
      padresArr = padresArr.filter(p => p && p !== 'null');
    }
    const nuevoEquipo = await Equipo.create({
      nombre, tipo, area,
      padre: padre && padre !== 'null' && padre !== '' ? padre : null,
      padres_adicionales: padresArr,
      rack_posicion: rack_posicion ? Number(rack_posicion) : null,
      imagen_url
    });
    res.status(201).json({ ok: true, equipo: nuevoEquipo });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/topologia/equipos/:id (editar nombre/padre/padres_adicionales)
router.put('/equipos/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, padre, padres_adicionales } = req.body;
    let padresArr = [];
    if (Array.isArray(padres_adicionales)) {
      padresArr = padres_adicionales.filter(p => p && p !== 'null');
    }
    const updateData = {
      nombre,
      padre: padre && padre !== 'null' && padre !== '' ? padre : null,
      padres_adicionales: padresArr
    };
    const equipo = await Equipo.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!equipo) return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
    res.json({ ok: true, equipo });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/topologia/equipos/:id/posicion — guardar posición manual del canvas o rack
router.patch('/equipos/:id/posicion', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { posicion_x, posicion_y, rack_posicion } = req.body;
    const update = {};
    if (posicion_x !== undefined) update.posicion_x = posicion_x;
    if (posicion_y !== undefined) update.posicion_y = posicion_y;
    if (rack_posicion !== undefined) update.rack_posicion = rack_posicion;

    await Equipo.findByIdAndUpdate(req.params.id, update);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/topologia/equipos/:id/padre — guardar solo el padre del equipo (para re-enlaces con Patch Panels)
router.patch('/equipos/:id/padre', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { padre } = req.body;
    const newPadre = (padre && padre !== 'null' && padre !== '') ? padre : null;
    await Equipo.findByIdAndUpdate(req.params.id, { padre: newPadre });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/topologia/equipos/:id (Opción A: Cascada recursiva a hijos)
router.delete('/equipos/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const equipoId = req.params.id;
    
    // Función recursiva para buscar hijos y eliminarlos
    async function eliminarHijos(padreId) {
      const hijos = await Equipo.find({ padre: padreId });
      for (let hijo of hijos) {
        await eliminarHijos(hijo._id);
        await Equipo.findByIdAndDelete(hijo._id);
      }
    }
    
    await eliminarHijos(equipoId); // Eliminar descendencia
    await Equipo.findByIdAndDelete(equipoId); // Eliminar padre principal
    
    res.json({ ok: true, mensaje: 'Equipo y su descendencia eliminados' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/topologia/equipos/:id/puertos
router.put('/equipos/:id/puertos', verificarToken, soloAdmin, async (req, res) => {
  try {
    const equipo = await Equipo.findByIdAndUpdate(req.params.id, { puertos: req.body.puertos }, { new: true });
    res.json({ ok: true, equipo });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── RUTAS CATÁLOGO DE VLANs ──────────────────────────────────

// GET /api/topologia/vlans
router.get('/vlans', verificarToken, async (req, res) => {
  try {
    const vlans = await Vlan.find().sort({ id_vlan: 1 }).lean();
    res.json({ ok: true, vlans });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/topologia/vlans
router.post('/vlans', verificarToken, soloAdmin, async (req, res) => {
  try {
    const vlan = await Vlan.create(req.body);
    res.status(201).json({ ok: true, vlan });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/topologia/vlans/:id
router.put('/vlans/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const vlan = await Vlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ok: true, vlan });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/topologia/vlans/:id
router.delete('/vlans/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await Vlan.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;

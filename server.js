// ============================================================
//   server.js â€” Servidor Unificado Plataforma GestiÃ³n Tech
// ============================================================
require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const morgan       = require('morgan');
const path         = require('path');
const compression  = require('compression');

const app  = express();
const PORT = process.env.PORT || 3009;

// â”€â”€ Middleware de CompresiÃ³n (Gzip) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Comprime todas las respuestas > 1KB. Ahorra hasta 70% de ancho de banda.
app.use(compression({ level: 6 }));

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
// Morgan solo en desarrollo para no gastar CPU en producciÃ³n
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ——— Archivos estáticos con caché agresiva ———————————————————
// Imágenes y uploads: cache 7 días en el navegador (inmutable para uploads)
app.use('/uploads', express.static(path.join(__dirname, '../administracion/public/uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// Servir los portales estáticos (Frontend)
app.use('/admin', express.static(path.join(__dirname, '../administracion/public')));
app.use('/clientes', express.static(path.join(__dirname, '../clientes/public')));

// ——— Info de acceso en raíz —————————————————————————————————
app.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'API Plataforma Gestión Tecnológica',
    version: '1.0.0',
    port: PORT,
    portales: {
      clientes:      'Abrir clientes/public/index.html directamente en el navegador',
      administracion: 'Abrir administracion/public/index.html directamente en el navegador',
    },
  });
});

// â”€â”€ Rutas API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const authRoutes        = require('./routes/auth');
const clientesRoutes    = require('./routes/clientes');
const ticketsRoutes     = require('./routes/tickets');
const cotizacionesRoutes = require('./routes/cotizaciones');
const usuariosRoutes    = require('./routes/usuarios');
const topologiaRoutes   = require('./routes/topologia');
const catalogoRoutes    = require('./routes/catalogo');
const planosRoutes      = require('./routes/planos');
const customDevRoutes   = require('./routes/equipos_custom');

app.use('/api/auth',         authRoutes);
app.use('/api/clientes',     clientesRoutes);
app.use('/api/tickets',      ticketsRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/usuarios',     usuariosRoutes);
app.use('/api/topologia',    topologiaRoutes);
app.use('/api/catalogo',     catalogoRoutes);
app.use('/api/planos',       planosRoutes);
app.use('/api/custom-devices', customDevRoutes);

// â”€â”€ Manejo de errores global â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, next) => {
  console.error('âŒ Error:', err.message);
  res.status(err.status || 500).json({ ok: false, error: err.message });
});

// â”€â”€ Conectar MongoDB y arrancar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Connection pooling optimizado: reutiliza hasta 10 conexiones simultÃ¡neas
// bufferCommands: false â†’ falla rÃ¡pido si MongoDB no estÃ¡ disponible
mongoose.set('bufferCommands', false);
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,         // mÃ¡x. conexiones reutilizables simultÃ¡neas
  minPoolSize: 2,          // mantiene 2 conexiones listas aunque haya poca carga
  serverSelectionTimeoutMS: 5000,  // falla en 5s si no puede conectar
  socketTimeoutMS: 45000,          // cierra sockets inactivos despuÃ©s de 45s
})
  .then(() => {
    console.log('âœ… MongoDB Atlas conectado (pool: 10 conexiones)');
    app.listen(PORT, () => {
      console.log(`ðŸš€ Servidor corriendo en http://localhost:${PORT}`);
      console.log(`   Portal Clientes  â†’ http://localhost:${PORT}/clientes`);
      console.log(`   Portal Admin     â†’ http://localhost:${PORT}/admin`);
    });
  })
  .catch(err => {
    console.error('âŒ Error MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;

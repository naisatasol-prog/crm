// models/Area.js
const mongoose = require('mongoose');

const AreaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  sitio:  { type: mongoose.Schema.Types.ObjectId, ref: 'Sitio', required: true },
  tipo:   { type: String, enum: ['MDF', 'IDF', 'Site', 'Otro'], default: 'IDF' },
  notas:  { type: String, default: '' },
  
  // Infraestructura
  cuarto: { type: String, enum: ['Rack', 'Gabinete', 'Ninguno'], default: 'Ninguno' },
  rack_unidades_totales: { type: Number, default: 42 },
  fibra_lui: { type: Boolean, default: false },
  fibra_cantidad: { type: Number, default: 0 },
  internet_proveedor: { type: String, default: '' },
  internet_tipo: { type: String, enum: ['ONT', 'Router', 'Ninguno'], default: 'Ninguno' },
  firewall: { type: String, enum: ['Fortinet', 'Propio', 'Ninguno'], default: 'Ninguno' },
  patchpanels: { type: Boolean, default: false },
  patchpanels_puertos: { type: Number, default: 0 },
  organizador: { type: Boolean, default: false },
  switch: { type: Boolean, default: false },
  switch_puertos: { type: String, enum: ['4', '8', '16', '24', '48', ''], default: '' },
  switch_fibra: { type: Boolean, default: false },
  router: { type: Boolean, default: false },
  router_fibra: { type: Boolean, default: false },
  foto_url: { type: String, default: '' },
  
  // Persistencia del Simulador de Rack y Cableado
  simulador_data: { type: String, default: '{}' }
}, { timestamps: true });

// Índice: búsqueda por sitio es la operación más frecuente
AreaSchema.index({ sitio: 1 });

module.exports = mongoose.model('Area', AreaSchema);

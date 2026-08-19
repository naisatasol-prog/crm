// models/Sitio.js
const mongoose = require('mongoose');

const SitioSchema = new mongoose.Schema({
  nombre:    { type: String, required: true, trim: true },
  cliente:   { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  direccion: { type: String, trim: true, default: '' },
  estado:    { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
  notas:     { type: String, default: '' },
}, { timestamps: true });

// Índices para acelerar búsquedas por cliente (consulta más frecuente)
SitioSchema.index({ cliente: 1 });
SitioSchema.index({ cliente: 1, estado: 1 });

module.exports = mongoose.model('Sitio', SitioSchema);

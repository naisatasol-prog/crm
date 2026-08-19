// models/Cliente.js
const mongoose = require('mongoose');

const ClienteSchema = new mongoose.Schema({
  empresa:       { type: String, required: true, trim: true },
  rfc:           { type: String, trim: true, default: '' },
  contacto:      { type: String, trim: true },
  email:         { type: String, trim: true },
  telefono:      { type: String, trim: true },
  direccion:     { type: String, trim: true },
  plan:          { type: String, enum: ['basico', 'profesional', 'enterprise'], default: 'basico' },
  estado:        { type: String, enum: ['activo', 'inactivo', 'suspendido'], default: 'activo' },
  fechaAlta:     { type: Date, default: Date.now },
  notas:         { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Cliente', ClienteSchema);

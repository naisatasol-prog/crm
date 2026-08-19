// models/CatalogoCustom.js — Equipo personalizado para el simulador de rack
const mongoose = require('mongoose');

const PortGroupSchema = new mongoose.Schema({
  label:    { type: String, default: '' },          // ej: "GE Ports", "SFP+"
  type:     { type: String, enum: ['rj45','sfp','sfp+','fiber-lc','gpon'], default: 'rj45' },
  count:    { type: Number, default: 4, min: 1, max: 96 },
  layout:   { type: String, enum: ['double', 'single'], default: 'single' },
  has_leds: { type: Boolean, default: true }
}, { _id: false });

const CatalogoCustomSchema = new mongoose.Schema({
  nombre:        { type: String, required: true, trim: true },
  tipo:          { type: String, enum: ['router','switch','server','ont','nvr','ups','firewall','otro'], default: 'switch' },
  chassis_units: { type: Number, enum: [1, 2], default: 1 }, // Altura del equipo (U)
  chassis_color: { type: String, default: '#1e293b' },       // Color hex del chasis
  label_text:    { type: String, default: '' },              // ej: "CISCO" / "Ruijie"
  label_color:   { type: String, default: '#f8fafc' },       // Color del texto del label
  port_side:     { type: String, enum: ['left', 'right', 'center'], default: 'right' }, // Alineación de puertos
  port_groups:   [PortGroupSchema]
}, { timestamps: true });

module.exports = mongoose.model('CatalogoCustom', CatalogoCustomSchema);

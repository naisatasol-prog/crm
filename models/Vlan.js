const mongoose = require('mongoose');

const VlanSchema = new mongoose.Schema({
  id_vlan: { type: Number, required: true, unique: true }, // Ej: 10
  nombre:  { type: String, required: true, trim: true },   // Ej: "Datos"
  color:   { type: String, default: '#3b82f6' },           // Color para badges en UI
  notas:   { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Vlan', VlanSchema);

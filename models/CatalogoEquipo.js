const mongoose = require('mongoose');

const CatalogoEquipoSchema = new mongoose.Schema({
  nombre:            { type: String, required: true, trim: true },
  tipo:              { type: String, enum: ['Internet', 'Firewall', 'Router', 'Switch', 'AP', 'Cliente', 'Patch Panel', 'Gabinete', 'Otro'], default: 'Otro' },
  imagen_url:        { type: String, default: '' },
  num_puertos:       { type: Number, default: 0 },         // 0 = sin puertos (routers simples, AP, etc.)
  capacidad_puertos: { type: String, enum: ['10G', '2.5G', '1G', '100M', 'offline', 'mixto'], default: '1G' },
  rack_unidades:     { type: Number, default: 1 },
  es_rackeable:      { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CatalogoEquipo', CatalogoEquipoSchema);

// models/Cotizacion.js
const mongoose = require('mongoose');

const PartidaSchema = new mongoose.Schema({
  descripcion: { type: String, required: true },
  cantidad:    { type: Number, default: 1 },
  precioUnit:  { type: Number, default: 0 },
  subtotal:    { type: Number, default: 0 },
});

const CotizacionSchema = new mongoose.Schema({
  folio:       { type: String, unique: true },
  cliente:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  titulo:      { type: String, required: true },
  partidas:    [PartidaSchema],
  subtotal:    { type: Number, default: 0 },
  iva:         { type: Number, default: 0 },
  total:       { type: Number, default: 0 },
  estado:      { type: String, enum: ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'], default: 'borrador' },
  validezDias: { type: Number, default: 30 },
  notas:       { type: String, default: '' },
  creadoPor:   { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
}, { timestamps: true });

CotizacionSchema.pre('save', async function(next) {
  if (!this.folio) {
    const count  = await mongoose.model('Cotizacion').countDocuments();
    this.folio   = `COT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Cotizacion', CotizacionSchema);

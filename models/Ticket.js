// models/Ticket.js
const mongoose = require('mongoose');

const MensajeSchema = new mongoose.Schema({
  autor:     { type: String },
  mensaje:   { type: String, required: true },
  rol:       { type: String, enum: ['admin', 'cliente'] },
  fecha:     { type: Date, default: Date.now },
});

const TicketSchema = new mongoose.Schema({
  folio:       { type: String, unique: true },
  titulo:      { type: String, required: true, trim: true },
  descripcion: { type: String, required: true },
  categoria:   { type: String, enum: ['soporte', 'red', 'software', 'hardware', 'otro'], default: 'soporte' },
  prioridad:   { type: String, enum: ['baja', 'media', 'alta', 'critica'], default: 'media' },
  estado:      { type: String, enum: ['abierto', 'en_proceso', 'resuelto', 'cerrado'], default: 'abierto' },
  cliente:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  asignadoA:   { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  mensajes:    [MensajeSchema],
  adjuntos:    [{ type: String }],
}, { timestamps: true });

// Auto-folio
TicketSchema.pre('save', async function(next) {
  if (!this.folio) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.folio  = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);

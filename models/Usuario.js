// models/Usuario.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
  nombre:   { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  rol:      { type: String, enum: ['admin', 'cliente'], default: 'cliente' },
  clienteId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
  activo:   { type: Boolean, default: true },
  avatar:   { type: String, default: '' },
}, { timestamps: true });

// Hash antes de guardar
UsuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UsuarioSchema.methods.compararPassword = function(pass) {
  return bcrypt.compare(pass, this.password);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);

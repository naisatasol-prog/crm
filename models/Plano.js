const mongoose = require('mongoose');

const PlanoSchema = new mongoose.Schema({
  sitio: { type: mongoose.Schema.Types.ObjectId, ref: 'Sitio', required: false },
  area:  { type: mongoose.Schema.Types.ObjectId, ref: 'Area',  required: false },
  nombre: { type: String, required: true, trim: true }, // Ej. "Planta Baja"
  imagen_url: { type: String, required: true } // Ruta a la imagen del plano
}, { timestamps: true });

module.exports = mongoose.model('Plano', PlanoSchema);

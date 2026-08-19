const mongoose = require('mongoose');

const MarcadorPlanoSchema = new mongoose.Schema({
  plano: { type: mongoose.Schema.Types.ObjectId, ref: 'Plano', required: true },
  tipo: { 
    type: String, 
    enum: ['AP', 'Cámara', 'Nodo', 'Cuarto', 'Enlace', 'Otro'], 
    default: 'Otro' 
  },
  nombre: { type: String, required: true, trim: true },
  x: { type: Number, required: true }, // Porcentaje %
  y: { type: Number, required: true }, // Porcentaje %
  angulo: { type: Number, default: 0 }, // Orientación de la cámara (0-360)
  fov: { type: Number, default: 90 }, // Apertura visual (FOV)
  detalles: { type: String, default: '' },
  foto_url: { type: String, default: '' } // Foto real del equipo instalado
}, { timestamps: true });

module.exports = mongoose.model('MarcadorPlano', MarcadorPlanoSchema);

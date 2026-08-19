const mongoose = require('mongoose');

const EquipoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipo: { type: String, enum: ['Internet', 'Firewall', 'Router', 'Switch', 'AP', 'Cliente', 'Patch Panel', 'Gabinete', 'Otro'], default: 'Otro' },
  area: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true },
  padre: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo', default: null },
  padres_adicionales: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Equipo' }], // Multi-WAN
  posicion_x: { type: Number, default: null }, // Posición manual en el canvas
  posicion_y: { type: Number, default: null },
  rack_posicion: { type: Number, default: null }, // Posición en U dentro del Rack
  imagen_url: { type: String, default: '' },
  puertos: [{
    numero:    Number,
    nombre:    String,
    capacidad: { type: String, enum: ['10G','2.5G','1G','100M','offline'], default: 'offline' },
    uso:       { type: String, enum: ['usuario','cascada','ninguno'], default: 'ninguno' },

    // Destino físico del cable
    conexion_tipo:  {
      type: String,
      enum: ['libre','equipo_red','dispositivo_final','patch_panel'],
      default: 'libre'
    },
    conexion_label: { type: String, default: '' }, // Frente: "SW-Core Puerto 24"
    conexion_posterior: { type: String, default: '' }, // Atrás: "Cámara Pasillo", "Usuario 5"

    // Configuración de VLANs
    vlan_modo:   { type: String, enum: ['ninguno','access','trunk'], default: 'ninguno' },
    vlan_access: { type: Number, default: null },   // VLAN ID si modo=access
    vlan_trunk:  [{ type: Number }]                 // Lista de VLAN IDs si modo=trunk
  }]
}, { timestamps: true });

module.exports = mongoose.model('Equipo', EquipoSchema);

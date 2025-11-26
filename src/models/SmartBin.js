const mongoose = require('mongoose');
const { Schema } = mongoose;

const SmartBinSchema = new Schema({
  device_id: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true 
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  model: { 
    type: String, 
    default: 'esp8266' 
  },
  areaId: { type: String },
  bins: [{
    type: String,
    ref: 'Bin'
  }],
  status: { 
    type: String, 
    enum: ['online', 'offline', 'unknown'], 
    default: 'unknown' 
  },
  client_id_mqtt: { type: String },
  last_color: {
    classification: { type: String },
    confidence: { type: Number, min: 0, max: 1 },
    rgb: [Number],
    ts: Date
  },
  last_proximity: {
    distance_cm: Number,
    trigger: Boolean,
    ts: Date
  },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('SmartBin', SmartBinSchema);

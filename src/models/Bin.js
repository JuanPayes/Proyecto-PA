const mongoose = require('mongoose');
const { Schema } = mongoose;

const BinSchema = new Schema({
  bin_id: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true 
  },
  device_id: { 
    type: String, 
    required: true
  },
  assigned_type: { 
    type: String, 
    enum: ['plastic', 'aluminum'], 
    default: null 
  },
  level_percent: { 
    type: Number, 
    min: 0, 
    max: 100, 
    default: 0
  },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Bin', BinSchema);

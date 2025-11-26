const mongoose = require('mongoose');
const { Schema } = mongoose;

const AreaSchema = new Schema({
  area_id: {
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
  devices: [{
    type: String,
    ref: 'Device'
  }],
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Area', AreaSchema);

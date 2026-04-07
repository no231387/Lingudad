const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const OTPSchema = new mongoose.Schema({
  phone:     { type: String, required: true, index: true },
  code:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // auto-delete after 5 min
});

export default mongoose.models.OTP || mongoose.model('OTP', OTPSchema);

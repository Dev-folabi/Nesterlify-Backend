import mongoose, { Schema, Document } from "mongoose";

// Activation Model
interface IActivation extends Document {
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  activationCode: number;
  expirationTime: Date;
}

const ActivationSchema = new Schema<IActivation>({
  email: { type: String, required: true, unique: true },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  activationCode: { type: Number, required: true },
  expirationTime: { type: Date, required: true },
});

export const Activation = mongoose.model<IActivation>(
  "Activation",
  ActivationSchema
);

// PasswordReset Model
interface IPasswordReset extends Document {
  email: string;
  otpCode: number;
  newHashedPassword: string;
  expirationTime: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>({
  email: { type: String, required: true, unique: true },
  otpCode: { type: Number, required: true },
  newHashedPassword: { type: String, required: true },
  expirationTime: { type: Date, required: true },
});

export const PasswordReset = mongoose.model<IPasswordReset>(
  "PasswordReset",
  PasswordResetSchema
);

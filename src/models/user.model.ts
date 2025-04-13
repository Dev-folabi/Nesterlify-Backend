import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "../types/models";

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    profilePicture: {
      type: String,
      default:
        "https://media.istockphoto.com/id/1081381240/photo/young-smiling-african-american-man-over-white-background.jpg?s=612x612&w=0&k=20&c=T2Mq5yJ93H5jvbI87tC5RjXuGcmDdTH4GzcyOL_WRl4=",
    },
    title: String,
    gender: String,
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
    phoneNumber: {
      type: String,
    },
    nationality: String,
    birthPlace: String,
    issuanceDate: String,
    state: String,
    city: String,
    zipcode: String,
    houseNo: String,
    houseAddress: String,
    documenttype: String,
    issuedby: String,
    passportNo: String,
    passportExpiryDate: String,
    dateOfBirth: String,
    isBlocked: {
      type: Boolean,
      default: false,
    },
    notificationSettings: {
      website: {
        bookings: { type: Boolean, default: false },
        cheapflight: { type: Boolean, default: false },
        transaction: { type: Boolean, default: false },
      },
      email: {
        bookings: { type: Boolean, default: false },
        cheapflight: { type: Boolean, default: false },
        transaction: { type: Boolean, default: false },
      },
    },
    emailNotification: {
      type: Boolean,
      default: true,
    },
    twoFa: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const DB_URI = process.env.MONGO_URI || "";
const connectDB = async () => {
  try {
    await mongoose.connect(DB_URI, {});
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  }
};

export default connectDB;

import mongoose, { Schema } from "mongoose";
import { INewsletter } from "../types/models";

const newsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<INewsletter>("Newsletter", newsletterSchema);

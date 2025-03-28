import { Schema, model } from "mongoose";
import { INotification } from "../types/models";

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      enum: [
        "hotel",
        "flight",
        "activity",
        "car",
        "transaction",
        "general",
      ],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = model<INotification>("Notification", NotificationSchema);

export default Notification;

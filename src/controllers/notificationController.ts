import { NextFunction, Request, Response } from "express";
import Notification from "../models/notification.model";
import { errorHandler } from "../middleware/errorHandler";

// Create a new notification
export const createNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, userId, category } = req.body;
    const newNotification = new Notification({
      title,
      message,
      userId,
      category,
    });
    const savedNotification = await newNotification.save();
    res.status(201).json(savedNotification);
  } catch (error) {
    res.status(500).json({ message: "Error creating notification", error });
  }
};

// Get all notifications for a user
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.params.userId;
    const { category, dateFilter, readStatus } = req.query;
    const filter: any = { userId };

    if (category && category !== "all") {
      filter.category = category;
    }

    if (dateFilter) {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      if (dateFilter === "today") {
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateFilter === "yesterday") {
        const yesterday = new Date(today.setDate(today.getDate() - 1));
        const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
        const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfYesterday, $lte: endOfYesterday };
      } else if (dateFilter === "selectDate") {
        const selectedDate = new Date(req.query.selectedDate as string);
        const startOfSelectedDate = new Date(selectedDate.setHours(0, 0, 0, 0));
        const endOfSelectedDate = new Date(
          selectedDate.setHours(23, 59, 59, 999)
        );
        filter.createdAt = {
          $gte: startOfSelectedDate,
          $lte: endOfSelectedDate,
        };
      }
    }

    if (readStatus && readStatus !== "all") {
      filter.read = readStatus === "read";
    }

    const userNotifications = await Notification.find(filter).sort({
      read: 1,
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: userNotifications,
    });
  } catch (error) {
    console.log({ message: "Error retrieving notification", error });
    next(error);
  }
};

// Mark a notification as read
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (id === "all") {
      const userId = req.body.userId;
      await Notification.updateMany(
        { userId, read: false },
        { $set: { read: true } }
      );
      res
        .status(200)
        .json({ success: true, message: "All notifications marked as read" });
    } else {
      const notification = await Notification.findById(id);
      if (notification) {
        notification.read = true;
        const updatedNotification = await notification.save();
        res
          .status(200)
          .json({
            success: true,
            message: "Notification marked as read",
            data: updatedNotification,
          });
      } else {
        errorHandler(res, 404, "Notification not found");
      }
    }
  } catch (error) {
    console.log({ message: "Error marking notification as read", error });
    next(error);
  }
};

// Delete a notification
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const notificationId = req.params.id;
    await Notification.findByIdAndDelete(notificationId);
    res
      .status(204)
      .json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    console.log({ message: "Error deleting notification", error });
    next(error);
  }
};

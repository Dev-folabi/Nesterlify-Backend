import { handleValidationErrors } from "../index";
import { param, query } from "express-validator";

export const validateGetNotifications = [
  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .isIn([
      "Hotel",
      "all",
      "Flight",
      "Activity",
      "Car",
      "Transaction",
      "General",
    ])
    .withMessage("Invalid category"),
  query("dateFilter")
    .optional()
    .isString()
    .withMessage("Date filter must be a string")
    .isIn(["today", "yesterday"])
    .withMessage("Invalid date filter"),
  query("selectedDate")
    .optional()
    .isISO8601()
    .withMessage("Selected date must be a valid date")
    .custom((value, { req }) => {
      const today = new Date(); // Get today's date
      const selectedDate = new Date(value); // Get the selected date  from the request  query
      // Check if the selected date is not in the future  and is not more than 30 days from today
      if (selectedDate > today || selectedDate < new Date(today.setDate(today.getDate() - 30))) {
        throw new Error("Selected date must be within the last 30 days"); // Throw an error if the selected date is invalid
      } else {
        return true; // Return true if the selected date is valid   
      }
    }),
  query("readStatus")
    .optional()
    .isString()
    .withMessage("Read status must be a string")
    .isIn(["read", "unread", "all"])
    .withMessage("Invalid read status"),
  handleValidationErrors,
];

export const validateMarkAsRead = [
  param("id").notEmpty().withMessage("Notification ID is required"),
  handleValidationErrors,
];

export const validateDeleteNotification = [
  param("id").notEmpty().withMessage("Notification ID is required"),
  handleValidationErrors,
];

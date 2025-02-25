import { body } from "express-validator";
import { handleValidationErrors } from "..";

// Validation Middleware
export const validateSubscription = [
  body("email").isEmail().withMessage("A valid email is required"),
  handleValidationErrors,
];

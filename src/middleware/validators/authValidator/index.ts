import { body } from "express-validator";
import { handleValidationErrors } from "../index";

export const validateSignup = [
  body("username").notEmpty().withMessage("Username is required"),
  body("fullName").notEmpty().withMessage("Full name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
  handleValidationErrors,
];

export const validateActivate = [
body("activationCode")
    .isNumeric()
    .isLength({ min: 6, max: 6 })
    .withMessage("Activation code must be a 6-digit number"),
  handleValidationErrors,
];

export const validateResendOTP = [
  body("email").isEmail().withMessage("Valid email is required"),
  handleValidationErrors,
];

export const validateSignin = [
  body("emailOrUsername")
    .notEmpty()
    .withMessage("Email or username is required"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

export const validateRequestPasswordReset = [
  body("email").isEmail().withMessage("Valid email is required"),
  handleValidationErrors,
];

export const validateVerifyPasswordOTP = [
  body("otpCode")
    .isNumeric()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP code must be a 6-digit number"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
  body("confirmNewPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match"),
  handleValidationErrors,
];

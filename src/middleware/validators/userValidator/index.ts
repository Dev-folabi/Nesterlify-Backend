import { body, param, query } from "express-validator";
import { handleValidationErrors } from "../index";

export const validateEditProfile = [
  body("username")
    .optional()
    .isString()
    .withMessage("Username must be a string"),
  body("fullName")
    .optional()
    .isString()
    .withMessage("FullName must be a string"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("profilePicture")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string"),
  body("title").optional().isString().withMessage("Title must be a string"),
  body("gender").optional().isString().withMessage("Gender must be a string"),
  body("firstName")
    .optional()
    .isString()
    .withMessage("First name must be a string"),
  body("lastName")
    .optional()
    .isString()
    .withMessage("Last name must be a string"),
  body("middleName")
    .optional()
    .isString()
    .withMessage("Middle name must be a string"),
  body("phoneNumber")
    .optional()
    .isString()
    .withMessage("Phone number must be a string"),
  body("nationality")
    .optional()
    .isString()
    .withMessage("Nationality must be a string"),
  body("birthPlace")
    .optional()
    .isString()
    .withMessage("Birth place must be a string"),
  body("issuanceDate")
    .optional()
    .isString()
    .withMessage("Issuance date must be a string"),
  body("state").optional().isString().withMessage("State must be a string"),
  body("city").optional().isString().withMessage("City must be a string"),
  body("zipcode").optional().isString().withMessage("Zipcode must be a string"),
  body("houseNo")
    .optional()
    .isString()
    .withMessage("House number must be a string"),
  body("houseAddress")
    .optional()
    .isString()
    .withMessage("House address must be a string"),
  body("documenttype")
    .optional()
    .isString()
    .withMessage("Document type must be a string"),
  body("issuedby")
    .optional()
    .isString()
    .withMessage("Issued by must be a string"),
  body("passportNo")
    .optional()
    .isString()
    .withMessage("Passport number must be a string"),
  body("passportExpiryDate")
    .optional()
    .isString()
    .withMessage("Passport expiry date must be a string"),
  body("dateOfBirth")
    .optional()
    .isString()
    .withMessage("Date of birth must be a string"),
  handleValidationErrors,
];

export const validateEmailNotification = [
  body("bookings")
    .optional()
    .isBoolean()
    .withMessage("Bookings must be a boolean value"),
  body("cheapflight")
    .optional()
    .isBoolean()
    .withMessage("Cheap flight must be a boolean value"),
  body("transaction")
    .optional()
    .isBoolean()
    .withMessage("Transaction must be a boolean value"),
  handleValidationErrors,
];

export const validateWebNotification = [
  body("bookings")
    .optional()
    .isBoolean()
    .withMessage("Bookings must be a boolean value"),
  body("cheapflight")
    .optional()
    .isBoolean()
    .withMessage("Cheap flight must be a boolean value"),
  body("transaction")
    .optional()
    .isBoolean()
    .withMessage("Transaction must be a boolean value"),
  handleValidationErrors,
];

export const validateChangePassword = [
  body("oldPassword").notEmpty().withMessage("Old password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
  body("confirmNewPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match"),
  handleValidationErrors,
];

export const validateVerifyChangePasswordOTP = [
  body("otpCode")
    .isNumeric()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP code must be a 6-digit number"),
  handleValidationErrors,
];

export const validateDeleteUser = [
  param("id").isMongoId().withMessage("Invalid user ID"),
  handleValidationErrors,
];

export const validateBlockUser = [
  param("id").isMongoId().withMessage("Invalid user ID"),
  handleValidationErrors,
];

export const validateDeleteSelectedUsers = [
  body("userIds")
    .isArray({ min: 1 })
    .withMessage("At least one user ID must be provided"),
  body("userIds.*").isMongoId().withMessage("Invalid user ID in array"),
  handleValidationErrors,
];

export const validateTwoFA = [
  body("twoFa")
    .isBoolean()
    .withMessage("Two-factor authentication enabled must be a boolean value"),
  handleValidationErrors,
];

export const validateEmailToggle = [
  body("emailToggle")
    .isBoolean()
    .withMessage("Email toggle must be a boolean value"),
  handleValidationErrors,
];

/**
 * Validation for User Bookings
 */
export const validateUserBookings = [
  query("bookingType")
    .optional()
    .isIn(["flight", "hotel", "car"])
    .withMessage("Booking type must be 'flight', 'hotel', or 'car'"),
  query("bookingStatus")
    .optional()
    .isIn(["confirmed", "pending", "cancelled"])
    .withMessage("Booking status must be 'confirmed', 'pending', or 'cancelled'"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Limit must be a positive integer"),
  handleValidationErrors,
];

/**
 * Validation for Booking by ID
 */
export const validateBookingById = [
  param("bookingId")
    .notEmpty()
    .withMessage("Booking ID is required")
    .isMongoId()
    .withMessage("Booking ID must be a valid MongoDB ID"),
  handleValidationErrors,
];
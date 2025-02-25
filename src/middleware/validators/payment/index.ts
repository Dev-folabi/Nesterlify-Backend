import { body } from "express-validator";
import { handleValidationErrors } from "../index";

export const validateCreateOrder = [
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("Amount must be a positive number"),

  body("currency")
    .isString()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter currency code (e.g., USD)"),

  body("bookingType")
    .isIn(["flight", "hotel", "car", "vacation"])
    .withMessage("Booking type must be one of: flight, hotel, car, vacation"),

  body("flightOffers")
    .if(body("bookingType").equals("flight"))
    .isArray({ min: 1 })
    .withMessage(
      "Flight offers must be an array and required for flight bookings"
    ),

  body("travelers")
    .if(body("bookingType").equals("flight"))
    .isArray({ min: 1 })
    .withMessage("Travelers must be an array and required for flight bookings"),

  body("carOfferID")
    .if(body("bookingType").equals("car"))
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Car offer ID is required for car bookings"),

  body("passengers")
    .if(body("bookingType").equals("car"))
    .isArray({ min: 1 })
    .withMessage("Passengers must be an array and required for car bookings"),

  body("note")
    .if(body("bookingType").equals("car"))
    .optional()
    .isString()
    .trim()
    .withMessage("Note must be a string if provided"),

  body("passengers.*.firstName")
    .if(body("bookingType").equals("car"))
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Passenger first name is required"),

  body("passengers.*.lastName")
    .if(body("bookingType").equals("car"))
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Passenger last name is required"),

  body("passengers.*.title")
    .if(body("bookingType").equals("car"))
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Passenger title is required"),

  body("passengers.*.contacts.phoneNumber")
    .if(body("bookingType").equals("car"))
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Passenger phone number is required"),

  body("passengers.*.contacts.email")
    .if(body("bookingType").equals("car"))
    .isEmail()
    .withMessage("Passenger email is required"),

  handleValidationErrors,
];

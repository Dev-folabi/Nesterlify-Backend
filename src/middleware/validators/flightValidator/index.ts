import { body, query } from "express-validator";
import { handleValidationErrors } from "../index";

/**
 * Validation for Location Search
 */
export const validateLocationSearch = [
  query("keyword").notEmpty().withMessage("Search keyword is required"),
  handleValidationErrors,
];

/**
 * Validation for One-Way and Round-Trip Flight Search
 */
export const validateSearchFlights = [
  query("from").notEmpty().withMessage("Origin location is required"),
  query("to").notEmpty().withMessage("Destination location is required"),
  query("departureDate")
    .isDate()
    .withMessage("Departure date must be a valid date"),
  query("returnDate")
    .optional()
    .isDate()
    .withMessage("Return date must be a valid  date"),
  query("adults")
    .isInt({ min: 1 })
    .withMessage("At least one adult is required"),
  query("children")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Children must be a non-negative integer"),
  query("travelClass")
    .isIn(["economy", "business", "first", "premium_first"])
    .withMessage("Invalid travel class"),
  query("tripType")
    .isIn(["one-way", "round-trip"])
    .withMessage("Trip type must be either 'one-way' or 'round-trip'"),
  query("minPrice")
    .optional()
    .isDecimal()
    .withMessage("Min price must be a valid decimal number"),
  query("maxPrice")
    .optional()
    .isDecimal()
    .withMessage("Max price must be a valid decimal number"),
  query("sortBy")
    .optional()
    .isIn([
      "low-to-high",
      "high-to-low",
      "cheapest-price",
      "best-price",
      "quickest",
    ])
    .withMessage(
      "Sort by must be 'low-to-high', 'high-to-low', 'cheapest-price', 'best-price', or 'quickest'"
    ),
  query("stops")
    .optional()
    .isIn(["any", "direct", "1", "2"])
    .withMessage("Stops must be 'any', 'direct', '1', or '2'"),
  query("cancellationPolicy")
    .optional()
    .isIn(["all", "fully-refundable", "non-refundable"])
    .withMessage(
      "Cancellation policy must be 'all', 'fully-refundable', or 'non-refundable'"
    ),
  query("airlines")
    .optional()
    .isString()
    .withMessage("Airlines must be a comma-separated string"),
  query("rating")
    .optional()
    .isIn(["1", "2", "3", "4", "5"])
    .withMessage("Rating must be between 1 and 5"),
  handleValidationErrors,
];

/**
 * Validation for Multi-City Flight Search
 */
export const validateMultiCityFlights = [
  // Validate trips array in the request body
  body("trips")
    .isArray({ min: 2 })
    .withMessage("Multi-city flights require at least two trip legs"),
  body("trips.*.from")
    .notEmpty()
    .withMessage("Each trip leg must have an origin location"),
  body("trips.*.to")
    .notEmpty()
    .withMessage("Each trip leg must have a destination location"),
  body("trips.*.departureDate")
    .isISO8601()
    .withMessage("Each departure date must be a valid ISO 8601 date"),

  // Validate query parameters
  query("adults")
    .isInt({ min: 1 })
    .withMessage("At least one adult is required"),
  query("children")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Children must be a non-negative integer"),
  query("travelClass")
    .isIn(["economy", "business", "first", "premium_first"])
    .withMessage("Invalid travel class"),
  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Min price must be a valid positive decimal number"),
  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max price must be a valid positive decimal number"),
  query("sortBy")
    .optional()
    .isIn([
      "low-to-high",
      "high-to-low",
      "cheapest-price",
      "best-price",
      "quickest",
    ])
    .withMessage(
      "Sort by must be 'low-to-high', 'high-to-low', 'cheapest-price', 'best-price', or 'quickest'"
    ),
  query("stops")
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage("Stops must be 0 (direct), 1, or 2"),
  query("cancellationPolicy")
    .optional()
    .isIn(["all", "fully-refundable", "non-refundable"])
    .withMessage(
      "Cancellation policy must be 'all', 'fully-refundable', or 'non-refundable'"
    ),
  query("airlines")
    .optional()
    .matches(/^([A-Z0-9]+,)*[A-Z0-9]+$/i)
    .withMessage(
      "Airlines must be a comma-separated list of valid airline codes"
    ),
  query("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be an integer between 1 and 5"),

  handleValidationErrors,
];

export const validateHotelSearch = [
  body("location").notEmpty().withMessage("Location is required"),
  body("check_in_date")
    .isISO8601()
    .toDate()
    .withMessage("Check-in date must be a valid date in YYYY-MM-DD format"),
  body("check_out_date")
    .isISO8601()
    .toDate()
    .withMessage("Check-out date must be a valid date in YYYY-MM-DD format"),
  body("rooms")
    .isInt({ min: 1 })
    .withMessage("At least one room is required"),
  body("guests")
    .isArray({ min: 1 })
    .withMessage("At least one guest is required"),
  body("guests.*.type")
    .isIn(["adult", "child"])
    .withMessage("Guest type must be 'adult' or 'child'"),
  body("guests.*.age")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Child age must be a non-negative integer"),
  body("radius")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Radius must be a positive integer"),

  // Filters
  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Min price must be a valid positive number"),
  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max price must be a valid positive number"),
  query("sortBy")
    .optional()
    .isIn(["low-to-high", "high-to-low", "popular"])
    .withMessage("Sort by must be 'low-to-high', 'high-to-low', or 'popular'"),
  query("propertyType")
    .optional()
    .isIn(["all", "home-stay", "apartment", "motel", "resort", "condo"])
    .withMessage(
      "Property type must be 'all', 'home-stay', 'apartment', 'motel', 'resort', or 'condo'"
    ),
  query("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  query("cancellationPolicy")
    .optional()
    .isIn(["all", "fully-refundable", "non-refundable"])
    .withMessage(
      "Cancellation policy must be 'all', 'fully-refundable', or 'non-refundable'"
    ),

  handleValidationErrors,
];


export const validateTrackFlight = [
  query("flightNumber")
    .notEmpty()
    .withMessage("Flight number is required")
    .isString()
    .withMessage("Flight number must be a string"),
  query("date")
    .notEmpty()
    .withMessage("Date is required")
    .isISO8601()
    .withMessage("Date must be a valid ISO 8601 date"),
  handleValidationErrors,
];
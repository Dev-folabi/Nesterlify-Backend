import { body } from "express-validator";
import { handleValidationErrors } from "../index";

export const validateFindCars = [
  body("startAddressLine")
    .notEmpty()
    .withMessage("Start address line is required"),
  body("startCityName").notEmpty().withMessage("Start city name is required"),
  body("startCountryCode")
    .notEmpty()
    .withMessage("Start country code is required"),
  body("startGeoCode").notEmpty().withMessage("Start geo code is required"),
  body("endAddressLine").notEmpty().withMessage("End address line is required"),
  body("endCityName").notEmpty().withMessage("End city name is required"),
  body("endCountryCode").notEmpty().withMessage("End country code is required"),
  body("endGeoCode").notEmpty().withMessage("End geo code is required"),
  body("startDateTime").notEmpty().withMessage("Start date time is required"),
  body("passengers")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Passengers must be a number greater than 0"),
  handleValidationErrors,
];

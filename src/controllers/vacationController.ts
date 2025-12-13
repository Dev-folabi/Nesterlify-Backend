import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import { errorHandler } from "../middleware/errorHandler";
import logger from "../utils/logger";
import { getGeocodeString } from "../utils/geocoding";
import dotenv from "dotenv";
import { paginateResults } from "../function";

dotenv.config();

// Get Coordinates
export const getCoordinates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const location = req.query.location as string;
  if (!location) {
    return errorHandler(res, 400, "Location is required.");
  }

  try {
    const result = await getGeocodeString(location);
    if (result) {
      const data = { location, latitude: result.lat, longitude: result.lon };
      res.status(200).json({
        success: true,
        message: "Coordinates found",
        data,
      });
    } else {
      errorHandler(res, 404, `No coordinates found for: ${location}`);
    }
  } catch (error) {
    next(error);
  }
};

export const getVacations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { latitude, longitude, location } = req.query;

  if ((!latitude || !longitude) && !location) {
    return errorHandler(
      res,
      400,
      "Latitude and Longitude, or location are required."
    );
  }

  try {
    let coordinates: { latitude: string; longitude: string } | null = null;

    if (location) {
      const result = await getGeocodeString(location as string);
      if (result) {
        coordinates = { latitude: result.lat, longitude: result.lon };
      } else {
        return errorHandler(res, 404, `No coordinates found for: ${location}`);
      }
    }

    const response = await amadeus.shopping.activities.get({
      latitude: coordinates?.latitude ?? latitude,
      longitude: coordinates?.longitude ?? longitude,
    });

    res.status(200).json({
      success: true,
      message: "Vacations retrieved successfully",
      data: paginateResults(
        response.data,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    next(error);
  }
};

export const getVacationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { activityId } = req.params;

  if (!activityId) {
    return errorHandler(res, 400, "Activity ID is required.");
  }

  try {
    const response = await amadeus.shopping.activity(activityId).get();

    res.status(200).json({
      success: true,
      message: "Vacation retrieved successfully",
      data: paginateResults(
        [response.data],
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    next(error);
  }
};

export const bookVacation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { activityId, travelerId, paymentMethod, quantity } = req.body;

  if (!activityId || !travelerId || !paymentMethod || !quantity) {
    return errorHandler(
      res,
      400,
      "All fields (activityId, travelerId, paymentMethod, quantity) are required."
    );
  }

  try {
    const response = await amadeus.booking.activities.post(
      JSON.stringify({
        data: {
          type: "activity-order",
          activityId,
          travelers: [{ id: travelerId }],
          paymentMethod,
          quantity,
        },
      })
    );

    res.status(201).json({
      success: true,
      message: "Activity booked successfully",
      data: paginateResults(
        response.data,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    logger.error(error);
    return errorHandler(
      res,
      error.response?.status || 500,
      error.response?.data || "An error occurred while booking the activity"
    );
  }
};

import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import { getGeocodeString } from "../utils/geocoding";
import { errorHandler } from "../middleware/errorHandler";
import dotenv from "dotenv";
import { paginateResults } from "../function";
import { MARKUP_PERCENT } from "../constant";
import logger from "../utils/logger";

dotenv.config();

// Controller to get all matching airports & their geo-coordinates
export const getMatchingAirports = async (req: Request, res: Response) => {
  try {
    const { airportName } = req.query; // Example: "Charles de Gaulle"

    if (!airportName) {
      return errorHandler(res, 400, "Airport name is required");
    }

    // Call Amadeus API to get all matching airports
    const response = await amadeus.referenceData.locations.get({
      keyword: airportName,
      subType: "AIRPORT",
    });

    if (!response.data || response.data.length === 0) {
      return errorHandler(res, 400, "No matching airports found");
    }

    // Process each airport & fetch geo-coordinates
    const airportData = await Promise.all(
      response.data.map(async (airport: any) => {
        const address = `${airport.name}, ${airport.address.cityCode}`;
        const geoCode = await getGeocodeString(address);

        return {
          startLocationCode: airport.iataCode, // IATA code (e.g., CDG)
          endCountryCode: airport.address.countryCode, // Country code (e.g., FR)
          airportName: airport.name,
          cityCode: airport.address.cityCode,
          endGeoCode: geoCode ? `${geoCode.lat},${geoCode.lon}` : null, // Latitude, Longitude
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Location search successfully.",
      data: paginateResults(
        airportData,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    logger.error("Error fetching airport details:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const findCars = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { minPrice, maxPrice, sortBy, carType, cancellationPolicy } =
      req.query;
    const {
      startLocationCode,
      endAddressLine,
      endCountryCode,
      endGeoCode,
      startDateTime,
    } = req.body;

    if (
      !startLocationCode ||
      !endAddressLine ||
      !endCountryCode ||
      !endGeoCode ||
      !startDateTime
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: startLocationCode, endAddressLine, endCountryCode, endGeoCode, startDateTime",
      });
    }

    const params: any = {
      startLocationCode,
      endAddressLine,
      endCountryCode,
      endGeoCode,
      startDateTime,
    };

    const response = await amadeus.shopping.transferOffers.post(params);
    const carOffers = response.data || [];

    let filteredCars = carOffers;

    // Car Type Filtering
    if (carType) {
      const carTypesArray = (carType as string).split(",");
      filteredCars = filteredCars.filter(
        (car: any) =>
          car.vehicle.category && carTypesArray.includes(car.vehicle.category)
      );
    }

    // Cancellation Policy Filtering
    if (cancellationPolicy) {
      filteredCars = filteredCars.filter((car: any) =>
        car.cancellationRules.some((rule: any) =>
          rule.ruleDescription
            .toLowerCase()
            .includes((cancellationPolicy as string).toLowerCase())
        )
      );
    }

    // Apply a 5% markup on the base price
    const carsWithMarkup = filteredCars.map((car: any) => {
      const originalPrice = parseFloat(car.quotation.base.monetaryAmount);
      const markupPercentage = MARKUP_PERCENT;
      const newPrice = originalPrice * markupPercentage;

      return {
        ...car,
        quotation: {
          ...car.quotation,
          total: newPrice.toFixed(2),
        },
      };
    });

    // Apply price filtering
    if (minPrice) {
      filteredCars = carsWithMarkup.filter(
        (car: any) =>
          parseFloat(car.quotation.total) >= parseFloat(minPrice as string)
      );
    }

    if (maxPrice) {
      filteredCars = filteredCars.filter(
        (car: any) =>
          parseFloat(car.quotation.total) <= parseFloat(maxPrice as string)
      );
    }

    // Apply sorting
    if (sortBy) {
      filteredCars.sort((a: any, b: any) => {
        if (sortBy === "low-to-high" || sortBy === "best-price") {
          return parseFloat(a.quotation.total) - parseFloat(b.quotation.total);
        } else if (sortBy === "high-to-low") {
          return parseFloat(b.quotation.total) - parseFloat(a.quotation.total);
        }
        return 0;
      });
    }

    return res.status(200).json({
      success: true,
      message: "Car transfer search completed successfully with a 55% markup.",
      data: paginateResults(
        carsWithMarkup,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    logger.error("Car transfer error:", error);
    next(error);
  }
};

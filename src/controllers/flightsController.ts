import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import { errorHandler } from "../middleware/errorHandler";
import {
  FlightSearchRequest,
  MultiCityFlightSearchRequest,
} from "../types/requests";
import { paginateResults } from "../function";
import { MARKUP_PERCENT } from "../constant";

// Travel class mapping
const travelClassMap: Record<string, string> = {
  economy: "ECONOMY",
  business: "BUSINESS",
  first: "FIRST",
  premium_first: "PREMIUM_ECONOMY",
};

// Function to validate and map travel class
const getCabinClass = (travelClass: string): string | null => {
  return travelClassMap[travelClass.toLowerCase()] || null;
};

const getDurationInMinutes = (duration: string): number => {
  const match = duration.match(/PT(\d+H)?(\d+M)?/);
  if (!match) return 0;

  const hours = match[1] ? parseInt(match[1].replace("H", "")) * 60 : 0;
  const minutes = match[2] ? parseInt(match[2].replace("M", "")) : 0;

  return hours + minutes;
};

// Helper function to apply markup to flight prices
const applyMarkupToFlights = (flights: any[]): any[] => {
  return flights.map((flight: any) => {
    const originalPrice = parseFloat(flight.price.total);
    const newPrice = originalPrice * MARKUP_PERCENT;

    return {
      ...flight,
      price: { ...flight.price, total: newPrice.toFixed(2) },
    };
  });
};

// Search for locations (cities and airports)
export const searchLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return errorHandler(res, 400, "Search keyword is required.");
    }

    // Call Amadeus API to find city/airport codes
    const response = await amadeus.referenceData.locations.get({
      keyword,
      subType: "CITY,AIRPORT",
    });

    res.status(200).json({
      success: true,
      message: "Locations retrieved successfully",
      data: paginateResults(
        response.result.data,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    next(error);
  }
};

// One-way & Round-trip flight search
export const searchFlights = async (
  req: FlightSearchRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      from,
      to,
      departureDate,
      returnDate,
      adults,
      children,
      travelClass,
      tripType,
      minPrice,
      maxPrice,
      sortBy,
      stops,
      airlines,
    } = req.query;

    const today = new Date().toISOString().split("T")[0];
    const parsedDepartureDate = new Date(departureDate as string)
      .toISOString()
      .split("T")[0];
    const parsedReturnDate = returnDate
      ? new Date(returnDate as string).toISOString().split("T")[0]
      : null;

    if (parsedDepartureDate < today)
      return errorHandler(res, 400, "Departure date cannot be in the past.");
    if (parsedReturnDate && parsedReturnDate < today)
      return errorHandler(res, 400, "Return date cannot be in the past.");
    if (
      tripType === "round-trip" &&
      (!parsedReturnDate || parsedReturnDate < parsedDepartureDate)
    ) {
      return errorHandler(res, 400, "Invalid return date for round-trip.");
    }

    const cabinClass = getCabinClass(travelClass as string);
    if (!cabinClass) return errorHandler(res, 400, "Invalid travel class.");

    const params: any = {
      originLocationCode: from,
      destinationLocationCode: to,
      departureDate,
      adults: parseInt(adults as string, 10),
      travelClass: cabinClass,
      currencyCode: "USD",
    };

    if (children) params.children = parseInt(children as string, 10);
    if (tripType === "round-trip") params.returnDate = returnDate;

    const response = await amadeus.shopping.flightOffersSearch.get(params);

    if (!response.data || !Array.isArray(response.data)) {
      return errorHandler(res, 500, "No flights found");
    }

    const flightsWithMarkup = applyMarkupToFlights(response.data);

    // Filter flights by Min and Max Price
    const filteredByPrice = flightsWithMarkup.filter((flight: any) => {
      const flightPrice = parseFloat(flight.price.total);
      return (
        (!minPrice || flightPrice >= parseFloat(minPrice as string)) &&
        (!maxPrice || flightPrice <= parseFloat(maxPrice as string))
      );
    });

    // Filter flights by Stops
    const filteredByStops = stops
      ? filteredByPrice.filter((flight: any) => {
          const numberOfStops = flight.itineraries[0].segments.length - 1;
          return stops === "any" || numberOfStops === parseInt(stops as string);
        })
      : filteredByPrice;

    // Sorting Logic
    if (sortBy) {
      if (
        ["low-to-high", "cheapest-price", "best-price"].includes(
          sortBy as string
        )
      ) {
        filteredByStops.sort(
          (a: any, b: any) =>
            parseFloat(a.price.total) - parseFloat(b.price.total)
        );
      } else if (sortBy === "high-to-low") {
        filteredByStops.sort(
          (a: any, b: any) =>
            parseFloat(b.price.total) - parseFloat(a.price.total)
        );
      } else if (sortBy === "quickest") {
        filteredByStops.sort(
          (a: any, b: any) =>
            getDurationInMinutes(a.duration) - getDurationInMinutes(b.duration)
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Flight search completed successfully.",
      data: paginateResults(
        filteredByStops,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error("Flight search error:", error);
    next(error);
  }
};

// Multi-city flight search
export const searchMultiCityFlights = async (
  req: MultiCityFlightSearchRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { trips } = req.body;
    const {
      adults,
      children,
      travelClass,
      minPrice,
      maxPrice,
      sortBy,
      stops,
      airlines,
    } = req.query;

    if (!trips || trips.length < 2) {
      return errorHandler(
        res,
        400,
        "Multi-city flights require at least two trip legs."
      );
    }

    const today = new Date().toISOString().split("T")[0];
    for (const trip of trips) {
      const parsedDepartureDate = new Date(trip.departureDate)
        .toISOString()
        .split("T")[0];
      if (parsedDepartureDate < today) {
        return errorHandler(res, 400, "Departure date cannot be in the past.");
      }
    }

    const cabinClass = getCabinClass(travelClass as string);
    if (!cabinClass) {
      return errorHandler(res, 400, "Invalid travel class.");
    }

    const parsedAdults = parseInt(adults as string, 10);
    const parsedChildren = children ? parseInt(children as string, 10) : 0;

    if (isNaN(parsedAdults) || parsedAdults < 1) {
      return errorHandler(res, 400, "Invalid number of adults.");
    }

    const results = await Promise.all(
      trips.map(async (trip) => {
        const { from, to, departureDate } = trip;

        if (!from || !to || !departureDate) {
          throw new Error(
            "Each trip leg must include from, to, and departureDate."
          );
        }

        const params: any = {
          originLocationCode: from,
          destinationLocationCode: to,
          departureDate,
          adults: parsedAdults,
          travelClass: cabinClass,
          currencyCode: "USD",
        };

        if (parsedChildren) params.children = parsedChildren;
        if (stops === "direct") params.nonStop = true;
        if (airlines) params.includedAirlineCodes = airlines;

        const response = await amadeus.shopping.flightOffersSearch.get(params);
        console.log(response.data);
        if (!response.data || !Array.isArray(response.data)) {
          return errorHandler(res, 500, "Unexpected API response format.");
        }

        const flightsWithMarkup = applyMarkupToFlights(response.data);

        // Filter flights by Min and Max Price
        const filteredByPrice = flightsWithMarkup.filter((flight: any) => {
          const flightPrice = parseFloat(flight.price.total);
          return (
            (!minPrice || flightPrice >= parseFloat(minPrice as string)) &&
            (!maxPrice || flightPrice <= parseFloat(maxPrice as string))
          );
        });

        // Filter flights by Stops
        const filteredByStops = stops
          ? filteredByPrice.filter((flight: any) => {
              const numberOfStops = flight.itineraries[0].segments.length - 1;
              return (
                stops === "any" || numberOfStops === parseInt(stops as string)
              );
            })
          : filteredByPrice;

        // Sorting Logic
        if (sortBy) {
          if (
            ["low-to-high", "cheapest-price", "best-price"].includes(
              sortBy as string
            )
          ) {
            filteredByStops.sort(
              (a: any, b: any) =>
                parseFloat(a.price.total) - parseFloat(b.price.total)
            );
          } else if (sortBy === "high-to-low") {
            filteredByStops.sort(
              (a: any, b: any) =>
                parseFloat(b.price.total) - parseFloat(a.price.total)
            );
          } else if (sortBy === "quickest") {
            filteredByStops.sort(
              (a: any, b: any) =>
                getDurationInMinutes(a.duration) -
                getDurationInMinutes(b.duration)
            );
          }
        }

        return {
          from,
          to,
          departureDate,
          flights: filteredByStops,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Multi-city search completed successfully with markup applied.",
      data: paginateResults(
        results,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error("Multi-city flight search error:", error);
    next(error);
  }
};

// Retrieve flight offers pricing
export const confirmFlightPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { offers } = req.body;

    if (!Array.isArray(offers) || offers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. An array of flight offers is required.",
      });
    }

    // Make API request to get flight pricing for multiple offers
    const pricingResponse = await amadeus.shopping.flightOffers.pricing.post({
      data: {
        type: "flight-offers-pricing",
        flightOffers: offers, // Send multiple flight offers
      },
    });

    // Check if response contains valid flight offers
    if (
      !pricingResponse.data ||
      !Array.isArray(pricingResponse.data.flightOffers)
    ) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve flight pricing.",
      });
    }

    // Apply 5 markup to each flight price
    const updatedFlights = pricingResponse.data.flightOffers.map(
      (flight: any) => {
        const originalPrice = parseFloat(flight.price.total);
        const markupPrice = originalPrice * MARKUP_PERCENT;

        return {
          ...flight,
          price: {
            ...flight.price,
            total: markupPrice.toFixed(2),
            markedUpPrice: markupPrice.toFixed(2), // Include updated price field
          },
        };
      }
    );

    res.status(200).json({
      success: true,
      message: "Flight pricing retrieved successfully.",
      data: paginateResults(
        updatedFlights,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error("Flight pricing error:", error);
    next(error);
  }
};

// Track flight status
export const trackFlight = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { flightNumber, date } = req.query;

    if (!flightNumber || !date) {
      return errorHandler(res, 400, "Flight number and date are required.");
    }

    // Call Amadeus API to track flight status
    const response = await amadeus.schedule.flights.get({
      carrierCode: (flightNumber as string).slice(0, 2),
      flightNumber: (flightNumber as string).slice(2),
      scheduledDepartureDate: date,
    });

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Flight not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Flight status retrieved successfully.",
      data: response.data,
    });
  } catch (error: any) {
    console.error("Flight tracking error:", error);
    next(error);
  }
};

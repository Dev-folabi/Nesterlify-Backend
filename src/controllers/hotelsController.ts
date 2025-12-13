import { Duffel } from "@duffel/api";
import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { errorHandler } from "../middleware/errorHandler";
import { paginateResults } from "../function";
import { MARKUP_PERCENT } from "../constant";
import logger from "../utils/logger";
import { getGeocode } from "../utils/geocoding";

const { DUFFEL_TOKEN } = process.env;

// Initialize Duffel API
const duffel = new Duffel({
  token: DUFFEL_TOKEN!,
});
// Type for search request body
interface SearchRequestBody {
  rooms: number;
  guests: Array<{ type: "adult" } | { type: "child"; age: number }>;
  check_in_date: string;
  check_out_date: string;
  location: string;
  radius?: number;
}

// Search for hotels
export const findHotels = async (
  req: Request<{}, {}, SearchRequestBody>,
  res: Response
) => {
  const { rooms, guests, check_in_date, check_out_date, location, radius } =
    req.body;
  const {
    minPrice,
    maxPrice,
    sortBy,
    propertyType,
    rating,
    cancellationPolicy,
  } = req.query;

  if (!rooms || !guests || !check_in_date || !check_out_date || !location) {
    return errorHandler(res, 400, "Missing required fields");
  }

  const checkInDate = new Date(check_in_date);
  const checkOutDate = new Date(check_out_date);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return errorHandler(res, 400, "Invalid date format");
  }

  if (checkInDate < new Date() || checkOutDate < new Date()) {
    return errorHandler(res, 400, "Dates must be in the future");
  }

  if (checkInDate >= checkOutDate) {
    return errorHandler(
      res,
      400,
      "check_in_date must be earlier than check_out_date"
    );
  }

  const numberOfAdults = guests.filter(
    (guest): guest is { type: "adult" } => guest.type === "adult"
  ).length;

  if (numberOfAdults < rooms) {
    return errorHandler(
      res,
      400,
      "Number of adults must be greater or equal to the number of rooms"
    );
  }

  for (const guest of guests) {
    if (guest.type === "child" && (!("age" in guest) || guest.age >= 18)) {
      return errorHandler(
        res,
        400,
        "Age must be provided and less than 18 for child guests"
      );
    }
  }

  try {
    const { latitude, longitude } = await getGeocode(location);

    const searchParams = {
      rooms,
      guests,
      check_in_date,
      check_out_date,
      location: {
        radius: radius || 1,
        geographic_coordinates: { latitude, longitude },
      },
    };

    const result = await duffel.stays.search(searchParams);

    if (!result.data || !result.data.results) {
      return res.status(200).json({
        success: true,
        message: "No hotels found",
        data: { created_at: new Date().toISOString(), results: [] },
      });
    }

    let hotels = result.data.results.map((hotel: any) => ({
      ...hotel,
      cheapest_rate_total_amount: (
        parseFloat(hotel.cheapest_rate_total_amount) * MARKUP_PERCENT
      ).toFixed(2),
    }));

    // Apply Min/Max Price filter
    if (minPrice) {
      hotels = hotels.filter(
        (hotel) =>
          parseFloat(hotel.cheapest_rate_total_amount) >= Number(minPrice)
      );
    }
    if (maxPrice) {
      hotels = hotels.filter(
        (hotel) =>
          parseFloat(hotel.cheapest_rate_total_amount) <= Number(maxPrice)
      );
    }

    // Apply Property Type filter
    if (propertyType && propertyType !== "All") {
      hotels = hotels.filter(
        (hotel) => hotel.accommodation?.type === propertyType
      );
    }

    // Apply Rating filter
    if (rating) {
      hotels = hotels.filter(
        (hotel) => hotel.accommodation?.rating >= Number(rating)
      );
    }

    // Apply Cancellation Policy filter
    if (cancellationPolicy && cancellationPolicy !== "All") {
      hotels = hotels.filter(
        (hotel) => hotel.cancellation_policy === cancellationPolicy
      );
    }

    // Sorting
    if (sortBy === "LowToHigh") {
      hotels.sort(
        (a, b) =>
          parseFloat(a.cheapest_rate_total_amount) -
          parseFloat(b.cheapest_rate_total_amount)
      );
    } else if (sortBy === "HighToLow") {
      hotels.sort(
        (a, b) =>
          parseFloat(b.cheapest_rate_total_amount) -
          parseFloat(a.cheapest_rate_total_amount)
      );
    } else if (sortBy === "Popular") {
      hotels.sort(
        (a, b) =>
          (b.accommodation?.review_score || 0) -
          (a.accommodation?.review_score || 0)
      ); // Popularity based on review score
    }

    res.status(200).json({
      success: true,
      message: "Hotel search successful",
      data: paginateResults(
        hotels,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

interface FetchRoomRatesRequest {
  id: string;
}

// Fetch room rates
export const fetchRoomRates = async (
  req: Request<FetchRoomRatesRequest, {}, {}>,
  res: Response
) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  try {
    // Fetch all room rates for the given hotel ID from Duffel
    const rates = await duffel.stays.searchResults.fetchAllRates(id);

    // Apply 5% markup while handling potential missing or invalid values
    const updatedRates = {
      ...rates,
      data: {
        ...rates.data,
        cheapest_rate_total_amount: rates.data.cheapest_rate_total_amount
          ? (
              parseFloat(rates.data.cheapest_rate_total_amount) * MARKUP_PERCENT
            ).toFixed(2)
          : rates.data.cheapest_rate_total_amount, // Preserve original if invalid
        accommodation: {
          ...rates.data.accommodation,
          rooms: rates.data.accommodation.rooms.map((room: any) => ({
            ...room,
            rates: room.rates.map((rate: any) => ({
              ...rate,
              total_amount: rate.total_amount
                ? (parseFloat(rate.total_amount) * MARKUP_PERCENT).toFixed(2)
                : rate.total_amount,
            })),
          })),
        },
      },
    };

    res.status(200).json({
      success: true,
      message: "Hotel rate fetch successful",
      data: paginateResults(
        [updatedRates.data],
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

interface RecheckRateRequest {
  rate_id: string;
}

// Quote Booking
export const quoteBooking = async (
  req: Request<RecheckRateRequest, {}, {}>,
  res: Response,
  next: NextFunction
) => {
  const { rate_id } = req.params;
  if (!rate_id) {
    return errorHandler(res, 400, "Missing rate_id");
  }

  try {
    const quote = await duffel.stays.quotes.create(rate_id);

    // Apply 5% markup to the total_amount
    const updatedQuote = {
      ...quote,
      data: {
        ...quote.data,
        total_amount: quote.data.total_amount
          ? (parseFloat(quote.data.total_amount) * MARKUP_PERCENT).toFixed(2)
          : quote.data.total_amount,
      },
    };

    res.status(200).json({
      success: true,
      message: "Hotel rate quotes get successful",
      data: paginateResults(
        [updatedQuote.data],
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    logger.error(error);
    next(error);
  }
};

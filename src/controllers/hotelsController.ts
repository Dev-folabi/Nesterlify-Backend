import { Duffel } from "@duffel/api";
import axios from "axios";
import { Request, Response } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Booking from "../models/booking.model";

const { DUFFEL_TOKEN, NOMINATIM_BASE_URL } = process.env;

// Initialize Duffel API
const duffel = new Duffel({
  token: DUFFEL_TOKEN!,
});

// Type for geocode response
interface GeocodeResult {
  latitude: number;
  longitude: number;
}

// Function to get geolocation coordinates using Nominatim
const getGeocode = async (location: string): Promise<GeocodeResult> => {
  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: { q: location, format: "json", addressdetails: 1 },
    });
    if (!response.data || response.data.length === 0) {
      throw new Error("Location not found");
    }

    const result = response.data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  } catch (error: any) {
    throw new Error(`Failed to get geocode: ${error.message}`);
  }
};

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

  if (!rooms || !guests || !check_in_date || !check_out_date || !location) {
    return errorHandler(res, 400, "Missing required fields");
  }

  const checkInDate = new Date(check_in_date);
  const checkOutDate = new Date(check_out_date);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return errorHandler(res, 400, "Invalid date format");
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
    if (guest.type === "child" && !("age" in guest)) {
      return errorHandler(res, 400, "Age must be provided for child guests");
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

    res
      .status(200)
      .json({
        status: "success",
        message: "Hotel search successful",
        data: result.data,
      });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// Type for fetch room rates request
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
    const rates = await duffel.stays.searchResults.fetchAllRates(id);

    console.log("rate:", rates);

    res
      .status(200)
      .json({
        status: "success",
        message: "Hotel rate get successful",
        data: rates.data,
      });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// Type for recheck request
interface RecheckRateRequest {
  rate_id: string;
}

// Quote Booking
export const quoteBooking = async (
  req: Request<RecheckRateRequest, {}, {}>,
  res: Response
) => {
  const { rate_id } = req.params;
  if (!rate_id) {
    return errorHandler(res, 400, "Missing rate_id");
  }

  try {
    const quote = await duffel.stays.quotes.create(rate_id);

    res
      .status(200)
      .json({
        status: "success",
        message: "Hotel rate quotes get successful",
        data: quote.data,
      });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// Type for booking request
interface BookHotelRequest {
  quote_id: string;
  phone_number: string;
  guests: { given_name: string; family_name: string }[];
  email: string;
  accommodation_special_requests?: string;
}

export const processingHotelBooking = async (
  userId: string,
  orderId: string,
  amount: number,
  currency: string,
  paymentMethod: string,
  quote_id: string,
  guests: { given_name: string; family_name: string }[],
  email: string,
  phone_number: string,
  stay_special_requests?: string,
) => {
  if (!Array.isArray(guests) || guests.length === 0) {
    throw new Error("Invalid guest data");
  }

  if (!guests.every((guest) => guest.given_name && guest.family_name)) {
    throw new Error("Guest details are required");
  }

  // Create and save booking
  const bookingData = new Booking({
    userId,
    bookingType: "hotel",
    hotel: [
      {
        quote_id,
        guests,
        email,
        stay_special_requests,
        phone_number,
      },
    ],
    paymentDetails: {
      transactionId: orderId,
      paymentStatus: "pending",
      paymentMethod,
      amount: amount.toString(),
      currency,
    },
    bookingStatus: "pending",
  });

  await bookingData.save();
};

// Book a hotel
export const bookHotel = async (offerId: string) => {
  try {
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": offerId,
    });
    if (!booking) {
      throw new Error("Booking not found");
    }

    const bookingResponse = await duffel.stays.bookings.create({
      quote_id: booking.hotel[0].quote_id,
      phone_number: booking.hotel[0].phone_number,
      guests: booking.hotel[0].guests,
      email: booking.hotel[0].email,
      accommodation_special_requests: booking.hotel[0].stay_special_requests,
    });

    const bookingData = bookingResponse.data;

    booking.hotel[0].check_in_date = bookingData.check_in_date;
    booking.hotel[0].check_out_date = bookingData.check_out_date;
    booking.hotel[0].rooms = bookingData.rooms;
    booking.hotel[0].check_in_information = {
      check_out_before_time:
        bookingData.accommodation.check_in_information?.check_out_before_time ||
        "",
      check_in_before_time:
        bookingData.accommodation.check_in_information?.check_out_before_time ||
        "",
      check_in_after_time:
        bookingData.accommodation.check_in_information?.check_in_after_time ||
        "",
    };
    booking.hotel[0].booking_id = bookingData.id;
    booking.bookingStatus = bookingData.status;

    await booking.save();

    return {
      success: true,
      message: "Hotel booking successful",
      data: bookingData,
    };
  } catch (error: any) {
    console.error("Booking error:", error);
    throw new Error(
      "Booking failed: " +
        (error.response ? error.response.result : error.message)
    );
  }
};

import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import axios from "axios";
import { errorHandler } from "../middleware/errorHandler";
import Booking from "../models/booking.model";
import dotenv from "dotenv";

dotenv.config();

const {
  BILLING_ADDRESS_LINE,
  BILLING_ADDRESS_ZIP,
  BILLING_ADDRESS_COUNTRY_CODE,
  BILLING_ADDRESS_CITY_NAME,
  PAYMENT_METHOD_OF_PAYMENT,
  PAYMENT_CREDIT_CARD_NUMBER,
  PAYMENT_CREDIT_CARD_HOLDER_NAME,
  PAYMENT_CREDIT_CARD_VENDOR_CODE,
  PAYMENT_CREDIT_CARD_EXPIRY_DATE,
  PAYMENT_CREDIT_CARD_CVV,
  NOMINATIM_BASE_URL,
} = process.env;

// Function to get latitude & longitude from Nominatim API
const getGeoCode = async (
  address: string
): Promise<{ lat: string; lon: string } | null> => {
  try {
    const url = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(address)}&format=json`;
    const response = await axios.get(url);
    if (response.data.length > 0) {
      return { lat: response.data[0].lat, lon: response.data[0].lon };
    }
    return null;
  } catch (error) {
    console.error("Error fetching geocode:", error);
    return null;
  }
};

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
        const geoCode = await getGeoCode(address);

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
      data: airportData,
    });
  } catch (error: any) {
    console.error("Error fetching airport details:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const findCars = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract filter query parameters
    const {
      minPrice,
      maxPrice,
      sortBy,
      rating,
      carType,
      transmission,
      cancellationPolicy,
    } = req.query;

    // Extract mandatory fields from body
    const {
      startLocationCode,
      endAddressLine,
      endCountryCode,
      endGeoCode,
      startDateTime,
    } = req.body;

    // Validate mandatory fields
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

    // Construct Amadeus API request parameters
    const params: any = {
      startLocationCode,
      endAddressLine,
      endCountryCode,
      endGeoCode,
      startDateTime,
    };

    // Fetch car transfer offers from Amadeus API using the correct endpoint
    const response = await amadeus.shopping.transferOffers.post(params);
    const carOffers = response.data || [];

    // Apply filters
    let filteredCars = carOffers;

    if (minPrice) {
      filteredCars = filteredCars.filter(
        (car: any) =>
          parseFloat(car.price.total) >= parseFloat(minPrice as string)
      );
    }
    if (maxPrice) {
      filteredCars = filteredCars.filter(
        (car: any) =>
          parseFloat(car.price.total) <= parseFloat(maxPrice as string)
      );
    }
    if (rating) {
      filteredCars = filteredCars.filter(
        (car: any) => car.rating && car.rating >= Number(rating)
      );
    }
    if (carType) {
      const carTypesArray = (carType as string).split(",");
      filteredCars = filteredCars.filter(
        (car: any) =>
          car.vehicle.category && carTypesArray.includes(car.vehicle.category)
      );
    }
    if (transmission) {
      const transmissionArray = (transmission as string).split(",");
      filteredCars = filteredCars.filter(
        (car: any) =>
          car.vehicle.transmission &&
          transmissionArray.includes(car.vehicle.transmission)
      );
    }
    if (cancellationPolicy) {
      if (cancellationPolicy === "Fully refundable") {
        filteredCars = filteredCars.filter(
          (car: any) => car.cancellationPolicy === "FULLY_REFUNDABLE"
        );
      } else if (cancellationPolicy === "Non-refundable") {
        filteredCars = filteredCars.filter(
          (car: any) => car.cancellationPolicy === "NON_REFUNDABLE"
        );
      }
    }

    const carsWithMarkup = filteredCars
      .filter((car: any) => car.quotation && car.quotation.base) // Ensure price exists
      .map((car: any) => {
        const originalPrice = parseFloat(car.quotation.base.monetaryAmount);
        const markupPercentage = 0.55;
        const newPrice = originalPrice * (1 + markupPercentage);

        return {
          ...car,
          quotation: {
            ...car.quotation,
            total: newPrice.toFixed(2),
          },
        };
      });

    // Sorting logic
    if (sortBy) {
      if (sortBy === "low-to-high") {
        carsWithMarkup.sort(
          (a: any, b: any) =>
            parseFloat(a.price.total) - parseFloat(b.price.total)
        );
      } else if (sortBy === "high-to-low") {
        carsWithMarkup.sort(
          (a: any, b: any) =>
            parseFloat(b.price.total) - parseFloat(a.price.total)
        );
      } else if (sortBy === "popular") {
        carsWithMarkup.sort(
          (a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)
        ); // Assuming popularity is provided
      } else if (sortBy === "rating") {
        carsWithMarkup.sort(
          (a: any, b: any) => (b.rating || 0) - (a.rating || 0)
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Car transfer search completed successfully with a 55% markup.",
      data: carsWithMarkup,
    });
  } catch (error: any) {
    console.error("Car transfer error:", error);
    next(error);
  }
};

export const processingCarBooking = async (
  userId: string,
  orderId: string,
  carOfferID: string,
  passengers: any[],
  amount: number,
  currency: string,
  paymentMethod: string,
  note?: string
) => {
  if (!Array.isArray(passengers) || passengers.length === 0) {
    throw new Error("Invalid passenger data");
  }

  if (
    !passengers.every(
      (passenger: any) =>
        passenger.firstName &&
        passenger.lastName &&
        passenger.title &&
        passenger.contacts?.phoneNumber &&
        passenger.contacts?.email
    )
  ) {
    throw new Error("Passenger details are required");
  }

  // Format passenger details
  const carPassengers = passengers.map((passenger: any, index) => ({
    id: (index + 1).toString(),
    firstName: passenger.firstName,
    lastName: passenger.lastName,
    title: passenger.title,
    contacts: {
      phoneNumber: passenger.contacts.phoneNumber,
      email: passenger.contacts.email,
    },
  }));

  // Create and save booking
  const bookingData = new Booking({
    userId,
    bookingType: "car",
    car: { carOfferID, carPassengers, note: note || "No special requests" },
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

export const bookCarTransfer = async (offerId: string) => {
  try {
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": offerId,
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Construct booking request body
    const bookingData = {
      data: {
        note: booking.car[0].note || "No special requests",
        passengers: booking.car[0].passengers.map((passenger: any) => ({
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          title: passenger.title,
          contacts: {
            phoneNumber: passenger.contacts.phoneNumber,
            email: passenger.contacts.email,
          },
          billingAddress: {
            line: BILLING_ADDRESS_LINE,
            zip: BILLING_ADDRESS_ZIP,
            countryCode: BILLING_ADDRESS_COUNTRY_CODE,
            cityName: BILLING_ADDRESS_CITY_NAME,
          },
        })),
        payment: {
          methodOfPayment: PAYMENT_METHOD_OF_PAYMENT,
          creditCard: {
            number: PAYMENT_CREDIT_CARD_NUMBER,
            holderName: PAYMENT_CREDIT_CARD_HOLDER_NAME,
            vendorCode: PAYMENT_CREDIT_CARD_VENDOR_CODE,
            expiryDate: PAYMENT_CREDIT_CARD_EXPIRY_DATE,
            cvv: PAYMENT_CREDIT_CARD_CVV,
          },
        },
        extraServices: [
          {
            code: "",
            itemId: "",
          },
        ],
      },
    };

    // Call Amadeus Transfer Booking API
    const response = await amadeus.ordering.transferOrders.post(
      JSON.stringify(bookingData),
      offerId
    );

    console.log(response.result);

    return {
      success: true,
      message: "Booking successful",
      data: response.result,
    };
  } catch (error: any) {
    console.error("Booking error:", error);
    throw new Error(
      "Booking failed: " +
        (error.response ? error.response.result : error.message)
    );
  }
};

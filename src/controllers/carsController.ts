import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import axios from "axios";
import { errorHandler } from "../middleware/errorHandler";
import Booking from "../models/booking.model";
import dotenv from "dotenv";
import { paginateResults } from "../function";

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
      data: paginateResults(
        airportData,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
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

    // Apply a 55% markup on the base price
    const carsWithMarkup = filteredCars.map((car: any) => {
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
    car: {
      carOfferID,
      passengers: carPassengers,
      note: note || "No special requests",
    },
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

export const bookCarTransfer = async (orderId: string) => {
  try {
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": orderId,
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
        // extraServices: [
        //   {
        //     code: "",
        //     itemId: "",
        //   },
        // ],
      },
    };

    const carOfferID = booking.car[0].carOfferID;

    // Call Amadeus Transfer Booking API
    const response = await amadeus.ordering.transferOrders.post(
      JSON.stringify(bookingData),
      carOfferID
    );

    console.log(response.result);

    if (response.result.errors) {
      throw new Error("Booking failed: " + response.result.errors[0].detail);
    }

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

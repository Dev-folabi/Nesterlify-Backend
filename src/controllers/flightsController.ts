import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import { errorHandler } from "../middleware/errorHandler";
import {
  FlightSearchRequest,
  MultiCityFlightSearchRequest,
} from "../types/requests";
import { IBooking } from "../types/models";
import Booking from "../models/booking.model";

// Travel class mapping
const travelClassMap: Record<string, string> = {
  economy: "ECONOMY",
  business: "BUSINESS",
  first: "FIRST",
  premium_first: "PREMIUM_FIRST",
};

// Function to validate and map travel class
const getCabinClass = (travelClass: string): string | null => {
  return travelClassMap[travelClass.toLowerCase()] || null;
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
      data: response.result,
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
      cancellationPolicy,
      airlines,
      rating,
    } = req.query;

    const today = new Date().toISOString().split("T")[0];
    const parsedDepartureDate = new Date(departureDate as string)
      .toISOString()
      .split("T")[0];
    const parsedReturnDate = returnDate
      ? new Date(returnDate as string).toISOString().split("T")[0]
      : null;

    if (parsedDepartureDate < today) {
      return errorHandler(res, 400, "Departure date cannot be in the past.");
    }
    if (parsedReturnDate && parsedReturnDate < today) {
      return errorHandler(res, 400, "Return date cannot be in the past.");
    }
    if (
      tripType === "round-trip" &&
      parsedReturnDate &&
      parsedReturnDate < parsedDepartureDate
    ) {
      return errorHandler(
        res,
        400,
        "Return date cannot be before departure date."
      );
    }
    if (tripType === "round-trip" && !parsedReturnDate) {
      return errorHandler(
        res,
        400,
        "Return date is required for round-trip flights."
      );
    }

    const cabinClass = getCabinClass(travelClass as string);
    if (!cabinClass) {
      return errorHandler(res, 400, "Invalid travel class.");
    }

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
    if (minPrice)
      params.price = { ...params.price, min: parseFloat(minPrice as string) };
    if (maxPrice)
      params.price = { ...params.price, max: parseFloat(maxPrice as string) };
    if (airlines) params.carriers = (airlines as string).split(",");
    if (rating) params.rating = rating;
    if (stops) params.stops = stops;
    if (cancellationPolicy) params.cancellationPolicy = cancellationPolicy;

    // Fetch flight offers from Amadeus API
    const response = await amadeus.shopping.flightOffersSearch.get(params);

    const flightOffers = Array.isArray(response.data) ? response.data : [];

    // Apply 50% markup directly to the price
    const flightsWithMarkup = flightOffers.map((flight: any) => {
      const originalPrice = parseFloat(flight.price.total);
      const markupPercentage = 0.5;
      const newPrice = originalPrice * (1 + markupPercentage);

      return {
        ...flight,
        price: {
          ...flight.price,
          total: newPrice.toFixed(2),
        },
      };
    });

    // Sorting logic
    if (sortBy) {
      if (
        ["low-to-high", "cheapest-price", "best-price"].includes(
          sortBy as string
        )
      ) {
        flightsWithMarkup.sort(
          (a: any, b: any) =>
            parseFloat(a.price.total) - parseFloat(b.price.total)
        );
      } else if (sortBy === "high-to-low") {
        flightsWithMarkup.sort(
          (a: any, b: any) =>
            parseFloat(b.price.total) - parseFloat(a.price.total)
        );
      } else if (sortBy === "quickest") {
        flightsWithMarkup.sort((a: any, b: any) => a.duration - b.duration);
      }
    }

    res.status(200).json({
      success: true,
      message: "Flight search completed successfully with a 50% markup.",
      data: flightsWithMarkup,
    });
  } catch (error: any) {
    console.log("flight error:", error);
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
      cancellationPolicy,
      airlines,
      rating,
    } = req.query;

    if (!trips || trips.length < 2) {
      return errorHandler(
        res,
        400,
        "Multi-city flights require at least two trip legs."
      );
    }
    // Validate trip dates
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
    const parsedRating = rating ? parseInt(rating as string, 10) : null;
    const parsedStops = stops ? parseInt(stops as string, 10) : null;

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

        // Optional filters
        if (parsedChildren) params.children = parsedChildren;
        if (minPrice)
          params.price = {
            ...params.price,
            min: parseFloat(minPrice as string),
          };
        if (maxPrice)
          params.price = {
            ...params.price,
            max: parseFloat(maxPrice as string),
          };
        if (airlines) params.carriers = (airlines as string).split(",");
        if (parsedRating) params.rating = parsedRating;
        if (parsedStops !== null) params.stops = parsedStops;
        if (cancellationPolicy)
          params.cancellationPolicy = cancellationPolicy as string;

        const response = await amadeus.shopping.flightOffersSearch.get(params);

        if (!response.data || !Array.isArray(response.data)) {
          return errorHandler(res, 500, "Unexpected API response format.");
        }

        const markedUpFlights = response.data
          .map((flight: any) => {
            const originalPrice = parseFloat(flight.price.total);
            if (isNaN(originalPrice)) {
              console.warn("Skipping flight due to invalid price:", flight);
              return null;
            }

            const markupFee = 0.5; // 50% markup
            const newPrice = originalPrice * (1 + markupFee);

            return {
              ...flight,
              price: {
                ...flight.price,
                total: newPrice.toFixed(2),
              },
            };
          })
          .filter(Boolean);

        return {
          from,
          to,
          departureDate,
          flights: markedUpFlights,
        };
      })
    );

    // Apply optional sorting if specified in the request
    if (sortBy) {
      results.forEach((trip: any) => {
        if (!trip.flights || trip.flights.length === 0) return;

        switch (sortBy) {
          case "low-to-high":
          case "cheapest-price":
          case "best-price":
            trip.flights.sort(
              (a: any, b: any) =>
                parseFloat(a.price.total) - parseFloat(b.price.total)
            );
            break;

          case "high-to-low":
            trip.flights.sort(
              (a: any, b: any) =>
                parseFloat(b.price.total) - parseFloat(a.price.total)
            );
            break;

          case "quickest":
            trip.flights.sort(
              (a: any, b: any) =>
                (a.duration ? parseInt(a.duration) : Infinity) -
                (b.duration ? parseInt(b.duration) : Infinity)
            );
            break;
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Multi-city search completed successfully with markup applied.",
      data: results,
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

    // Apply 50% markup to each flight price
    const updatedFlights = pricingResponse.data.flightOffers.map(
      (flight: any) => {
        const originalPrice = parseFloat(flight.price.total);
        const markupPrice = originalPrice * 1.5; // 50% markup

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
      data: updatedFlights,
    });
  } catch (error: any) {
    console.error("Flight pricing error:", error);
    next(error);
  }
};

// Create Flight Function
export const processFlightBooking = async (
  userId: string,
  orderId: string,
  flightOffers: any[],
  travelers: any[],
  amount: number,
  currency: string,
  paymentMethod: string
) => {
  if (!Array.isArray(flightOffers) || flightOffers.length === 0) {
    throw new Error("Invalid flight offer data");
  }

  // Process all flight offers
  const flights = flightOffers.map((flight: any, index: number) => {
    if (!flight.itineraries) {
      throw new Error(`Invalid flight itinerary for flight ${index + 1}`);
    }

    // Format traveler details and embed inside the flight
    const flightTravelers = travelers?.map((traveler: any) => ({
      id: traveler.id,
      dateOfBirth: traveler.dateOfBirth,
      name: {
        firstName: traveler.name?.firstName || "",
        lastName: traveler.name?.lastName || "",
      },
      gender: traveler.gender,
      contact: {
        email: traveler.contact?.email || "",
        phones:
          traveler.contact?.phones?.map((phone: any) => ({
            deviceType: phone.deviceType || "MOBILE",
            countryCallingCode: phone.countryCallingCode || "1",
            number: phone.number || "",
          })) || [],
      },
      documents:
        traveler.documents?.map((doc: any) => ({
          documentType: doc.documentType || "PASSPORT",
          number: doc.number || "",
          expiryDate: doc.expiryDate || "",
          nationality: doc.nationality || "",
          issuanceLocation: doc.issuanceCountry || "",
          issuanceDate: doc.issuanceDate || "",
          issuanceCountry: doc.issuanceCountry || "",
          validityCountry: doc.issuanceCountry || "",
          holder: doc.holder ?? true,
        })) || [],
    }));

    return {
      flightOrderId: flight.id,
      type: "flight-offer",
      source: flight.source,
      instantTicketingRequired: flight.instantTicketingRequired,
      nonHomogeneous: flight.nonHomogeneous,
      paymentCardRequired: flight.paymentCardRequired,
      lastTicketingDate: flight.lastTicketingDate,

      itineraries: flight.itineraries.map((itinerary: any) => ({
        segments: itinerary.segments.map((segment: any) => ({
          departure: {
            iataCode: segment.departure.iataCode,
            at: segment.departure.at,
          },
          arrival: {
            iataCode: segment.arrival.iataCode,
            at: segment.arrival.at,
          },
          carrierCode: segment.carrierCode,
          number: segment.number,
          aircraft: segment.aircraft.code,
          operatingCarrierCode: segment.operating.carrierCode,
          duration: segment.duration,
          segmentId: segment.id,
          numberOfStops: segment.numberOfStops,
          co2Emissions: segment.co2Emissions.map((emission: any) => ({
            weight: emission.weight,
            weightUnit: emission.weightUnit,
            cabin: emission.cabin,
          })),
        })),
      })),

      price: {
        currency: flight.price.currency,
        total: flight.price.total,
        base: flight.price.base,
        fees: flight.price.fees.map((fee: any) => ({
          amount: fee.amount,
          type: fee.type,
        })),
        grandTotal: flight.price.grandTotal,
        billingCurrency: flight.price.billingCurrency,
      },

      pricingOptions: {
        fareType: flight.pricingOptions.fareType,
        includedCheckedBagsOnly: flight.pricingOptions.includedCheckedBagsOnly,
      },

      validatingAirlineCodes: flight.validatingAirlineCodes,

      travelerPricings: flight.travelerPricings.map((traveler: any) => ({
        travelerId: traveler.travelerId,
        fareOption: traveler.fareOption,
        travelerType: traveler.travelerType,
        price: {
          currency: traveler.price.currency,
          total: traveler.price.total,
          base: traveler.price.base,
          taxes: traveler.price.taxes.map((tax: any) => ({
            amount: tax.amount,
            code: tax.code,
          })),
          refundableTaxes: traveler.price.refundableTaxes,
        },
        fareDetailsBySegment: traveler.fareDetailsBySegment.map(
          (segment: any) => ({
            segmentId: segment.segmentId,
            cabin: segment.cabin,
            fareBasis: segment.fareBasis,
            class: segment.class,
            includedCheckedBags: segment.includedCheckedBags
              ? { quantity: segment.includedCheckedBags.quantity || 0 }
              : { quantity: 0 },
          })
        ),
      })),

      travelers: flightTravelers,
    };
  });

  // Create and save booking
  const bookingData: IBooking = new Booking({
    userId,
    bookingType: "flight",
    flights,
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

export const bookFlight = async (offerId: string) => {
  try {
    // Fetch booking from DB using merchantTradeNo
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": offerId,
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Map flight offers
    const flightOffers = booking.flights.map((flight, index) => ({
      id: (index + 1).toString(),
      type: "flight-offer",
      validatingAirlineCodes: flight.validatingAirlineCodes,
      source: flight.source,
      instantTicketingRequired: flight.instantTicketingRequired,
      nonHomogeneous: flight.nonHomogeneous,
      paymentCardRequired: flight.paymentCardRequired,
      lastTicketingDate: flight.lastTicketingDate,
      itineraries: flight.itineraries.map((itinerary: any) => ({
        segments: itinerary.segments.map((segment: any) => ({
          departure: {
            iataCode: segment.departure.iataCode,
            at: segment.departure.at,
          },
          arrival: {
            iataCode: segment.arrival.iataCode,
            at: segment.arrival.at,
          },
          carrierCode: segment.carrierCode,
          number: segment.number,
          aircraft: { code: segment.aircraft },
          duration: segment.duration,
          id: segment.segmentId,
          numberOfStops: segment.numberOfStops,
          co2Emissions: segment.co2Emissions.map((emission: any) => ({
            weight: emission.weight,
            weightUnit: emission.weightUnit,
            cabin: emission.cabin,
          })),
        })),
      })),
      price: {
        currency: flight.price.currency,
        total: flight.price.total,
        base: flight.price.base,
        grandTotal: flight.price.grandTotal,
        billingCurrency: flight.price.billingCurrency,
        fees: flight.price.fees.map((fee: any) => ({
          amount: fee.amount,
          type: fee.type,
        })),
      },
      pricingOptions: {
        fareType: flight.pricingOptions.fareType,
        includedCheckedBagsOnly: flight.pricingOptions.includedCheckedBagsOnly,
      },
      travelerPricings: flight.travelerPricings.map((traveler: any) => ({
        travelerId: traveler.travelerId,
        fareOption: traveler.fareOption,
        travelerType: traveler.travelerType,
        price: {
          total: traveler.price.total,
          currency: traveler.price.currency,
          base: traveler.price.base,
          refundableTaxes: traveler.price.refundableTaxes,
          taxes: traveler.price.taxes.map((tax: any) => ({
            amount: tax.amount,
            code: tax.code,
          })),
        },
        fareDetailsBySegment: traveler.fareDetailsBySegment.map(
          (segment: any) => ({
            segmentId: segment.segmentId,
            cabin: segment.cabin,
            fareBasis: segment.fareBasis,
            class: segment.class,
            includedCheckedBags: {
              quantity: segment.includedCheckedBags.quantity ?? 0,
            },
          })
        ),
      })),
    }));

    // Format travelers properly
    const travelers = booking.flights.flatMap((flight) => flight.travelers);

    const formattedTravelers = travelers.map(
      (traveler: any, index: number) => ({
        id: (index + 1).toString(),
        dateOfBirth: traveler.dateOfBirth,
        name: {
          firstName: traveler.name.firstName.toUpperCase(),
          lastName: traveler.name.lastName.toUpperCase(),
        },
        gender: traveler.gender.toUpperCase(),
        contact: {
          emailAddress: traveler.contact.email,
          phones: traveler.contact.phones.map((phone: any) => ({
            deviceType: phone.deviceType || "MOBILE",
            countryCallingCode: phone.countryCallingCode || "1",
            number: phone.number,
          })),
        },
        documents: traveler.documents.map((doc: any) => ({
          documentType: doc.documentType,
          number: doc.number,
          expiryDate: doc.expiryDate,
          nationality: doc.nationality,
          issuanceLocation: doc.issuanceLocation,
          issuanceDate: doc.issuanceDate,
          issuanceCountry: doc.issuanceCountry,
          validityCountry: doc.validityCountry,
          holder: doc.holder ?? false,
        })),
      })
    );

    // Make booking request to Amadeus API
    const response = await amadeus.booking.flightOrders.post({
      data: {
        type: "flight-order",
        flightOffers,
        travelers: formattedTravelers,
      },
    });

    const flightOrderResponse = response.data;

    // Update booking record in the database
    if (flightOrderResponse?.associatedRecords) {
      const bookingID = flightOrderResponse.id || "N/A";

      for (const flight of booking.flights) {
        flight.flightOrderId = bookingID;
      }
    } else {
      booking.bookingStatus = "failed";
      booking.paymentDetails.paymentStatus = "failed";
      await booking.save();
      throw new Error("Flight booking failed");
    }

    // Mark payment as completed
    booking.bookingStatus = "confirmed";
    booking.paymentDetails.paymentStatus = "completed";
    await booking.save();
  } catch (error: any) {
    console.log("Booking Error:", error);
    console.error("Booking Error:", error.response?.data || error.message);
    throw new Error("Flight booking failed. Please try again.");
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
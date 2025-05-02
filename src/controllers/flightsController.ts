import { Request, Response, NextFunction } from "express";
import { amadeus } from "../utils/amadeus";
import { errorHandler } from "../middleware/errorHandler";
import {
  FlightSearchRequest,
  MultiCityFlightSearchRequest,
} from "../types/requests";
import { IBooking } from "../types/models";
import Booking from "../models/booking.model";
import { paginateResults } from "../function";

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

const getDurationInMinutes = (duration: string): number => {
  const match = duration.match(/PT(\d+H)?(\d+M)?/);
  if (!match) return 0;

  const hours = match[1] ? parseInt(match[1].replace("H", "")) * 60 : 0;
  const minutes = match[2] ? parseInt(match[2].replace("M", "")) : 0;

  return hours + minutes;
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
      return errorHandler(
        res,
        500,
        "No flights found or invalid API response."
      );
    }

    const flightsWithMarkup = response.data.map((flight: any) => {
      const originalPrice = parseFloat(flight.price.total);
      const newPrice = originalPrice * 1.4;

      return {
        ...flight,
        price: { ...flight.price, total: newPrice.toFixed(2) },
      };
    });

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
      message: "Flight search completed successfully with a 50% markup.",
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

        const flightsWithMarkup = response.data.map((flight: any) => {
          const originalPrice = parseFloat(flight.price.total);
          const newPrice = originalPrice * 1.4;

          return {
            ...flight,
            price: { ...flight.price, total: newPrice.toFixed(2) },
          };
        });

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

    // Apply 40% markup to each flight price
    const updatedFlights = pricingResponse.data.flightOffers.map(
      (flight: any) => {
        const originalPrice = parseFloat(flight.price.total);
        const markupPrice = originalPrice * 1.4; // 40% markup

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
      id: (`${index}`+ 1).toString(),
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
        id: (`${index}`+1).toString(),
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

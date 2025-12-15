import { IBooking } from "../types/models";
import Booking from "../models/booking.model";
import { amadeus } from "../utils/amadeus";
import { Duffel } from "@duffel/api";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

const {
  DUFFEL_TOKEN,
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
} = process.env;

// Initialize Duffel API
const duffel = new Duffel({
  token: DUFFEL_TOKEN!,
});

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
          co2Emissions:
            segment.co2Emissions?.map((emission: any) => ({
              weight: emission.weight,
              weightUnit: emission.weightUnit,
              cabin: emission.cabin,
            })) || [],
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
          taxes:
            traveler.price.taxes?.map((tax: any) => ({
              amount: tax.amount,
              code: tax.code,
            })) || [],
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
          co2Emissions:
            segment.co2Emissions?.map((emission: any) => ({
              weight: emission.weight,
              weightUnit: emission.weightUnit,
              cabin: emission.cabin,
            })) || [],
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
          taxes:
            traveler.price.taxes?.map((tax: any) => ({
              amount: tax.amount,
              code: tax.code,
            })) || [],
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
    const travelers = booking.flights[0].travelers;

    const formattedTravelers = travelers.map(
      (traveler: any, index: number) => ({
        id: traveler.id,
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
    booking.markModified("flights");
    await booking.save();
  } catch (error: any) {
    console.log("Booking Error:", error);
    console.error("Booking Error:", error.response?.data || error.message);
    throw new Error("Flight booking failed. Please try again.");
  }
};

//  Car Booking Function
export const processingCarBooking = async (
  userId: string,
  orderId: string,
  carOfferID: string,
  passengers: any[],
  amount: number,
  currency: string,
  paymentMethod: string,
  note?: string,
  startConnectedSegment?: any,
  endConnectedSegment?: any
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
      startConnectedSegment,
      endConnectedSegment,
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
        startConnectedSegment: booking.car[0].startConnectedSegment,
      },
    };

    const carOfferID = booking.car[0].carOfferID;

    // Call Amadeus Transfer Booking API
    const response = await amadeus.ordering.transferOrders.post(
      JSON.stringify(bookingData),
      carOfferID
    );

    logger.info(response.result);

    if (response.result.errors) {
      throw new Error("Booking failed: " + response.result.errors[0].detail);
    }

    const transferData = response.result.data.transfers[0];

    // Update booking with confirmed details
    booking.car[0].confirmNbr = transferData.confirmNbr;
    booking.car[0].transferType = transferData.transferType;
    booking.car[0].distance = transferData.distance;
    booking.car[0].start = transferData.start;
    booking.car[0].end = transferData.end;
    booking.car[0].vehicle = transferData.vehicle;
    booking.car[0].serviceProvider =
      transferData.partnerInfo?.serviceProvider || transferData.serviceProvider;
    booking.car[0].quotation = transferData.quotation;

    booking.bookingStatus = "confirmed";
    booking.paymentDetails.paymentStatus = "completed";

    booking.markModified("car");
    await booking.save();

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

// Function to book hotel
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
  stay_special_requests?: string
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
    booking.hotel[0].name = bookingData.accommodation.name;
    const accommodation = bookingData.accommodation as any;
    booking.hotel[0].address = {
      line_one: accommodation.address?.line_one || "",
      city_name: accommodation.address?.city_name || "",
      country_code: accommodation.address?.country_code || "",
      postal_code: accommodation.address?.postal_code || "",
    };
    booking.bookingStatus = bookingData.status;

    booking.markModified("hotel");
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

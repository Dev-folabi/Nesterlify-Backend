import mongoose, { Schema, Document } from "mongoose";
import { IBooking } from "../types/models";

const BookingSchema = new Schema<IBooking>(
  {
    userId: { type: String, required: true }, // User making the booking
    bookingType: {
      type: String,
      required: true,
      enum: ["flight", "hotel", "car", "vacation"],
    }, // flight, hotel, car, vacation

    flights: [
      {
        flightOrderId: { type: String, required: true }, // Amadeus flight order ID
        type: { type: String, required: true }, // "flight-offer"
        source: { type: String, required: true }, // e.g., "GDS"
        instantTicketingRequired: { type: Boolean, required: true },
        nonHomogeneous: { type: Boolean, required: true },
        paymentCardRequired: { type: Boolean, required: true },
        lastTicketingDate: { type: String, required: true },

        itineraries: [
          {
            segments: [
              {
                departure: {
                  iataCode: { type: String, required: true },
                  at: { type: String, required: true },
                },
                arrival: {
                  iataCode: { type: String, required: true },
                  at: { type: String, required: true },
                },
                carrierCode: { type: String, required: true },
                number: { type: String, required: true },
                aircraft: { type: String, required: true },
                operatingCarrierCode: { type: String, required: true },
                duration: { type: String, required: true },
                segmentId: { type: String, required: true },
                numberOfStops: { type: Number, required: true },
                co2Emissions: [
                  {
                    weight: { type: Number, required: true },
                    weightUnit: { type: String, required: true },
                    cabin: { type: String, required: true },
                  },
                ],
              },
            ],
          },
        ],

        price: {
          currency: { type: String, required: true },
          total: { type: String, required: true },
          base: { type: String, required: true },
          fees: [
            {
              amount: { type: String, required: true },
              type: { type: String, required: true },
            },
          ],
          grandTotal: { type: String, required: true },
          billingCurrency: { type: String, required: true },
        },

        pricingOptions: {
          fareType: [{ type: String, required: true }],
          includedCheckedBagsOnly: { type: Boolean, required: true },
        },

        validatingAirlineCodes: [{ type: String, required: true }],

        travelerPricings: [
          {
            travelerId: { type: String, required: true },
            fareOption: { type: String, required: true },
            travelerType: { type: String, required: true },
            price: {
              currency: { type: String, required: true },
              total: { type: String, required: true },
              base: { type: String, required: true },
              taxes: [
                {
                  amount: { type: String, required: true },
                  code: { type: String, required: true },
                },
              ],
              refundableTaxes: { type: String, required: true },
            },
            fareDetailsBySegment: [
              {
                segmentId: { type: String, required: true },
                cabin: { type: String, required: true },
                fareBasis: { type: String, required: true },
                class: { type: String, required: true },
                includedCheckedBags: {
                  quantity: { type: Number, default: 0 },
                },
              },
            ],
          },
        ],

        travelers: [
          {
            id: { type: String, required: true },
            dateOfBirth: { type: String, required: true },
            name: {
              firstName: { type: String, required: true },
              lastName: { type: String, required: true },
            },
            gender: { type: String, required: true },
            contact: {
              email: { type: String, required: true },
              phones: [
                {
                  deviceType: { type: String, required: true },
                  countryCallingCode: { type: String, required: true },
                  number: { type: String, required: true },
                },
              ],
            },
            documents: [
              {
                documentType: { type: String, required: true },
                number: { type: String, required: true },
                expiryDate: { type: String, required: true },
                nationality: { type: String, required: true },
                issuanceLocation: { type: String, required: true },
                issuanceDate: { type: String, required: true },
                issuanceCountry: { type: String, required: true },
                validityCountry: { type: String, required: true },
                holder: { type: Boolean, default: true },
              },
            ],
          },
        ],
      },
    ],

    hotel: [
      {
        quote_id: { type: String, required: true },
        guests: [
          {
            given_name: { type: String, required: true },
            family_name: { type: String, required: true },
          },
        ],
        email: { type: String, required: true },
        stay_special_requests: { type: String, required: false },
        phone_number: { type: String, required: true },
        check_in_date: { type: String },
        check_out_date: { type: String },
        rooms: { type: Number },
        check_in_information: {
          check_out_before_time: { type: String },
          check_in_before_time: { type: String },
          check_in_after_time: { type: String },
        },
        total_currency: { type: String },
        total_amount: { type: String },
        booking_id: { type: String },
      },
    ],
    car: [
      {
        passengers: [
          {
            id: { type: String, required: true },
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
            title: { type: String, required: true },
            contacts: {
              phoneNumber: { type: String, required: true },
              email: { type: String, required: true },
            },
          },
        ],
        carOfferID: { type: String, required: true },
        note: { type: String, default: "No special requests" },
        startConnectedSegment: {
          transportationType: { type: String },
          transportationNumber: { type: String },
          departure: {
            uicCode: { type: String },
            iataCode: { type: String },
            localDateTime: { type: String },
          },
          arrival: {
            uicCode: { type: String },
            iataCode: { type: String },
            localDateTime: { type: String },
          },
        },
        endConnectedSegment: {
          transportationType: { type: String },
          transportationNumber: { type: String },
          departure: {
            uicCode: { type: String },
            iataCode: { type: String },
            localDateTime: { type: String },
          },
          arrival: {
            uicCode: { type: String },
            iataCode: { type: String },
            localDateTime: { type: String },
          },
        },
        // New fields for confirmed booking details
        confirmNbr: { type: String },
        transferType: { type: String },
        distance: {
          value: { type: Number },
          unit: { type: String },
        },
        start: {
          dateTime: { type: String },
          locationCode: { type: String },
          address: {
            countryCode: { type: String },
            line: { type: String },
            zip: { type: String },
            cityName: { type: String },
          },
        },
        end: {
          dateTime: { type: String },
          address: {
            line: { type: String },
            countryCode: { type: String },
            latitude: { type: Number },
            longitude: { type: Number },
            zip: { type: String },
            cityName: { type: String },
          },
        },
        vehicle: {
          code: { type: String },
          category: { type: String },
          description: { type: String },
          baggages: [{ count: { type: Number } }],
          seats: [{ count: { type: Number } }],
          imageURL: { type: String },
        },
        serviceProvider: {
          code: { type: String },
          name: { type: String },
          logoUrl: { type: String },
        },
        quotation: {
          monetaryAmount: { type: String },
          currencyCode: { type: String },
        },
      },
    ],
    vacation: { type: Object, default: null },

    paymentDetails: {
      transactionId: { type: String, required: true },
      paymentStatus: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
      paymentMethod: { type: String, required: true },
      amount: { type: String, required: true },
      currency: { type: String, required: true },
      nowPaymentId: { type: String },
    },

    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "failed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model<IBooking>("Booking", BookingSchema);
export default Booking;

import { Document } from "mongoose";

interface NotificationSettings {
  website: {
    bookings: boolean;
    cheapflight: boolean;
    transaction: boolean;
  };
  email: {
    bookings: boolean;
    cheapflight: boolean;
    transaction: boolean;
  };
}

export interface IUser extends Document {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "user";
  profilePicture: string;
  title?: string;
  gender?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: string;
  nationality?: string;
  birthPlace?: string;
  issuanceDate?: string;
  state?: string;
  city?: string;
  zipcode?: string;
  houseNo?: string;
  houseAddress?: string;
  documenttype?: string;
  issuedby?: string;
  passportNo?: string;
  passportExpiryDate?: string;
  dateOfBirth: string;
  isBlocked: boolean;
  notificationSettings: NotificationSettings;
  emailNotification: boolean;
  twoFa: boolean;
}

export interface INewsletter extends Document {
  email: string;
}

// Booking interfaces
interface Co2Emission {
  weight: number;
  weightUnit: string;
  cabin: string;
}

interface FlightSegment {
  departure: {
    iataCode: string;
    at: string;
  };
  arrival: {
    iataCode: string;
    at: string;
  };
  carrierCode: string;
  number: string;
  aircraft: string;
  operatingCarrierCode: string;
  duration: string;
  segmentId: string;
  numberOfStops: number;
  co2Emissions: Co2Emission[];
}

interface Itinerary {
  segments: FlightSegment[];
}

interface Price {
  currency: string;
  total: string;
  base: string;
  fees: {
    amount: string;
    type: string;
  }[];
  grandTotal: string;
  billingCurrency: string;
}

interface PricingOptions {
  fareType: string[];
  includedCheckedBagsOnly: boolean;
}

interface TravelerPricing {
  travelerId: string;
  fareOption: string;
  travelerType: string;
  price: {
    currency: string;
    total: string;
    base: string;
    taxes: {
      amount: string;
      code: string;
    }[];
    refundableTaxes: string;
  };
  fareDetailsBySegment: {
    segmentId: string;
    cabin: string;
    fareBasis: string;
    class: string;
    includedCheckedBags: {
      quantity: number;
    };
  }[];
}

interface Traveler {
  id: string;
  dateOfBirth: string;
  name: {
    firstName: string;
    lastName: string;
  };
  gender: string;
  contact: {
    email: string;
    phones: {
      deviceType: string;
      countryCallingCode: string;
      number: string;
    }[];
  };
  documents: {
    documentType: string;
    number: string;
    expiryDate: string;
    nationality: string;
    issuanceLocation: string;
    issuanceDate: string;
    issuanceCountry: string;
    validityCountry: string;
    holder: boolean;
  }[];
}


interface FlightOffer {
  flightOrderId: string;
  type: string;
  source: string;
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  paymentCardRequired: boolean;
  lastTicketingDate: string;
  itineraries: Itinerary[];
  price: Price;
  pricingOptions: PricingOptions;
  validatingAirlineCodes: string[];
  travelerPricings: TravelerPricing[];
  travelers: Traveler[];
}



// export interface FlightSegment {
//   departure: {
//     iataCode: string;
//     at: string;
//   };
//   arrival: {
//     iataCode: string;
//     at: string;
//   };
//   carrierCode: string;
//   flightNumber: string;
//   aircraft: string;
//   duration: string;
// }

// interface FlightDetails {
//   id: string;
//   bookingReference: string;
//   price: {
//     currency: string;
//     total: string;
//     base: string;
//   };
//   travelers: Traveler[];
//   flightSegments: FlightSegment[];
// }

// interface Flight {
//   flightOrderId: string;
//   flightDetails: FlightDetails;
// }

interface PaymentDetails {
  transactionId: string;
  paymentStatus: "pending" | "completed" | "failed";
  paymentMethod: string;
  amount: string;
  currency: string;
}

interface Car {
 passengers: [{
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  contacts: {
    phoneNumber: string;
    email: string;
  };
 }]
  carOfferID: string;
  note?: string;
}

// Booking Document Interface
export interface IBooking extends Document {
  userId: string;
  bookingType: "flight" | "hotel" | "car" | "vacation";
  flights: FlightOffer[];
  hotel: Record<string, unknown> | null;
  car: Car[];
  vacation: Record<string, unknown> | null;
  paymentDetails: PaymentDetails;
  bookingStatus: "pending" | "confirmed" | "failed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

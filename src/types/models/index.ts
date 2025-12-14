import { Document, Schema } from "mongoose";

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

interface PaymentDetails {
  transactionId: string;
  paymentStatus: "pending" | "processing" | "completed" | "failed";
  paymentMethod: string;
  amount: string;
  currency: string;
  nowPaymentId: string;
}

interface Car {
  passengers: [
    {
      id: string;
      firstName: string;
      lastName: string;
      title: string;
      contacts: {
        phoneNumber: string;
        email: string;
      };
    },
  ];
  carOfferID: string;
  note?: string;
  startConnectedSegment?: {
    transportationType?: string;
    transportationNumber?: string;
    departure?: {
      uicCode?: string;
      iataCode?: string;
      localDateTime?: string;
    };
    arrival?: {
      uicCode?: string;
      iataCode?: string;
      localDateTime?: string;
    };
  };
  endConnectedSegment?: {
    transportationType?: string;
    transportationNumber?: string;
    departure?: {
      uicCode?: string;
      iataCode?: string;
      localDateTime?: string;
    };
    arrival?: {
      uicCode?: string;
      iataCode?: string;
      localDateTime?: string;
    };
  };
  confirmNbr?: string;
  transferType?: string;
  distance?: {
    value: number;
    unit: string;
  };
  start?: {
    dateTime: string;
    locationCode?: string;
    address: {
      countryCode: string;
      line?: string;
      zip?: string;
      cityName?: string;
    };
  };
  end?: {
    dateTime: string;
    address: {
      line: string;
      countryCode: string;
      latitude?: number;
      longitude?: number;
      zip?: string;
      cityName?: string;
    };
  };
  vehicle?: {
    code: string;
    category: string;
    description: string;
    baggages: { count: number }[];
    seats: { count: number }[];
    imageURL: string;
  };
  serviceProvider?: {
    code: string;
    name: string;
    logoUrl: string;
  };
  quotation?: {
    monetaryAmount: string;
    currencyCode: string;
  };
}

interface Guest {
  given_name: string;
  family_name: string;
}

interface CheckInInformation {
  check_out_before_time: string;
  check_in_before_time: string;
  check_in_after_time: string;
}

interface Hotel {
  quote_id: string;
  name?: string;
  address?: {
    line_one?: string;
    city_name?: string;
    country_code?: string;
    postal_code?: string;
  };
  guests: Guest[];
  email: string;
  stay_special_requests?: string;
  phone_number: string;
  check_in_date: string;
  check_out_date: string;
  rooms: number;
  check_in_information: CheckInInformation;
  total_currency: string;
  total_amount: string;
  booking_id: string;
}

// Booking Document Interface
export interface IBooking extends Document {
  userId: string;
  bookingType: "flight" | "hotel" | "car" | "vacation";
  flights: FlightOffer[];
  hotel: Hotel[];
  car: Car[];
  vacation: Record<string, unknown> | null;
  paymentDetails: PaymentDetails;
  bookingStatus: "pending" | "confirmed" | "failed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

// Notification Document Interface
export interface INotification extends Document {
  userId: Schema.Types.ObjectId;
  title: string;
  message: string;
  read: boolean;
  category: "hotel" | "flight" | "activity" | "car" | "transaction" | "general";
  createdAt: Date;
  updatedAt: Date;
}

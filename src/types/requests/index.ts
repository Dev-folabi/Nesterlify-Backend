import { Request } from "express";

export interface SubscriptionRequest extends Request {
  body: {
    email: string;
  };
}

/**
 * Type definition for One-Way and Round-Trip flight search request.
 */
export interface FlightSearchQuery {
  [key: string]: string | undefined;
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  adults: string;
  children?: string;
  travelClass: string;
  tripType: "one-way" | "round-trip";
  minPrice?: string; // Minimum price filter
  maxPrice?: string; // Maximum price filter
  sortBy?:
    | "low-to-high"
    | "high-to-low"
    | "cheapest-price"
    | "best-price"
    | "quickest"; // Price sorting filter (including new options)
  stops?: "any" | "direct" | "1" | "2"; // Stops filter (Any, Direct, 1 Stop, 2 Stops)
  cancellationPolicy?: "all" | "fully-refundable" | "non-refundable"; // Cancellation policy filter
  airlines?: string; // Filter by airline code (comma-separated values)
  rating?: "1" | "2" | "3" | "4" | "5"; // Restrict rating values to 1-5
}

/**
 * Type definition for Multi-City flight search request.
 */
export interface MultiCityFlightRequest {
  trips: {
    from: string;
    to: string;
    departureDate: string;
  }[]; // Array of trips, each with from, to, and departure date
  adults: string;
  children?: string;
  travelClass: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?:
    | "low-to-high"
    | "high-to-low"
    | "cheapest-price"
    | "best-price"
    | "quickest"; // Price sorting filter (including new options)
  stops?: "any" | "direct" | "1" | "2"; // Stops filter (Any, Direct, 1 Stop, 2 Stops)
  cancellationPolicy?: "all" | "fully-refundable" | "non-refundable"; // Cancellation policy filter
  airlines?: string; // Filter by airline code (comma-separated values)
  rating?: "1" | "2" | "3" | "4" | "5"; // Restrict rating values to 1-5
}

/**
 * Custom request types extending Express Request.
 */
export interface FlightSearchRequest extends Request {
  query: FlightSearchQuery;
}

export interface MultiCityFlightSearchRequest extends Request {
  body: MultiCityFlightRequest;
}

export interface customRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export interface OrderRequest {
  amount: number;
  currency: string;
  orderId: string;
  bookingType: string;
  flightOffers?: any[];
  travelers?: any[];
  passengers?: any[];
  carOfferID?: string;
  note?: string;
}

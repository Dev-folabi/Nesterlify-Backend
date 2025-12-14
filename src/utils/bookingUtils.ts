import { Response } from "express";
import { OrderRequest, customRequest } from "../types/requests";
import User from "../models/user.model";
import { generateOrderId } from "../function";
import {
  processFlightBooking,
  processingHotelBooking,
  processingCarBooking,
} from "../function/bookings";
import logger from "./logger";

export const processCommonBooking = async (
  req: customRequest,
  res: Response,
  paymentMethod: string
) => {
  const {
    amount,
    currency,
    bookingType,
    flightOffers,
    travelers,
    carOfferID,
    passengers,
    note,
    quote_id,
    guests,
    email,
    phone_number,
    stay_special_requests,
    startConnectedSegment,
    endConnectedSegment,
  }: OrderRequest = req.body;

  const userId = req.user?.id;
  if (!userId) {
    return {
      success: false,
      status: 401,
      message: "Unauthorized, pls login",
    };
  }

  const user = await User.findById(userId);
  const orderId = generateOrderId();

  // Booking Logics
  switch (bookingType) {
    case "flight":
      await processFlightBooking(
        userId,
        orderId,
        flightOffers!,
        travelers!,
        amount,
        currency,
        paymentMethod
      );
      break;
    case "hotel":
      await processingHotelBooking(
        userId,
        orderId,
        amount,
        currency,
        paymentMethod,
        quote_id!,
        guests!,
        email!,
        phone_number!,
        stay_special_requests
      );
      break;
    case "car":
      await processingCarBooking(
        userId,
        orderId,
        carOfferID!,
        passengers!,
        amount,
        currency,
        paymentMethod,
        note,
        startConnectedSegment,
        endConnectedSegment
      );
      break;
    case "vacation":
      logger.info("Processing vacation booking...");
      break;
    default:
      return {
        success: false,
        status: 400,
        message: "Invalid booking type",
      };
  }

  return {
    success: true,
    data: {
      orderId,
      user,
      amount,
      currency,
      bookingType,
    },
  };
};

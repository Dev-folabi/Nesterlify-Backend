import { Request, Response, NextFunction } from "express";
import nowpayment from "../service/nowpayment";
import crypto from "crypto";
import { OrderRequest } from "../types/requests";
import Booking from "../models/booking.model";
import { bookFlight, processFlightBooking } from "./flightsController";
import { customRequest } from "../types/requests";
import { bookCarTransfer, processingCarBooking } from "./carsController";
import { bookHotel, processingHotelBooking } from "./hotelsController";

// Get Currencies
export const getNowPaymentCurrencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await nowpayment.getAvailableCurrencies();

    if (!data || !data.currencies) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch currencies",
      });
    }

    const result = data.currencies.map((currency: any) => ({
      id: currency.id,
      code: currency.code,
      name: currency.name,
      enable: currency.enable,
      logo_url: currency.logo_url,
      ticker: currency.ticker,
      network: currency.network,
    }));

    res.status(200).json({
      success: true,
      message: "Currencies get successful",
      data: result,
    });
  } catch (error: any) {
    console.log(error);
    next(error);
  }
};

//  Create Order with Booking Entry
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
      pay_currency,
    }: OrderRequest = req.body;

    if (!amount || !currency || !bookingType || !pay_currency) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Validate flight booking fields
    if (bookingType === "flight" && (!flightOffers || !travelers)) {
      return res
        .status(400)
        .json({ success: false, message: "Flight missing required fields" });
    }

    // Validate hotel booking fields
    if (
      bookingType === "hotel" &&
      (!quote_id || !guests || !email || !phone_number)
    ) {
      return res.status(400).json({
        success: false,
        message: "Hotel booking missing required fields",
      });
    }

    // Validate car booking fields
    if (
      bookingType === "car" &&
      (!carOfferID || !passengers || passengers.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Car Transfer missing required fields",
      });
    }

    // Validate Vacation booking fields
    // Todo: implement Vacation checks

    const userId = (req as customRequest).user?.id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized, pls login" });
    const paymentMethod = "Now Payment";

    const orderId = `ORD- ${crypto.randomBytes(4).toString("hex")}`;

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
          note
        );
        break;
      case "vacation":
        console.log("Processing vacation booking...");
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid booking type" });
    }

    const paymentData = {
      price_amount: parseFloat(amount.toFixed(1)),
      price_currency: currency,
      pay_currency: pay_currency,
      ipn_callback_url: process.env.NOWPAYMENT_WEBHOOK_URL || "",
      order_id: orderId,
      order_description: `Payment for ${bookingType} booking`,
      is_fixed_rate: false,
      is_fee_paid_by_user: true,
    };

    const response = await nowpayment.createPayment(paymentData);

    if (!response || !response.payment_id || !response.payment_status) {
      return res.status(500).json({
        success: false,
        message: "Failed to create payment. Please try again.",
      });
    }

    return res.status(200).json({
      success: response.payment_status === "waiting",
      message:
        response.payment_status === "waiting"
          ? "Now Payment request successful"
          : "Now Payment request failed",
      data: response,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Payment Callback - Confirm Booking
export const nowPaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("NOWPayments Webhook Notification:", req.body);

    // Extract data from request
    const {
      payment_id,
      payment_status,
      order_id,
      actually_paid,
      pay_currency,
    } = req.body;

    // Find the booking with the corresponding transaction ID (order_id)
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": order_id,
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    const bookingType = booking.bookingType;

    if (payment_status === "finished") {
      // Process booking based on type
      switch (bookingType) {
        case "flight":
          await bookFlight(order_id);
          break;
        case "hotel":
          await bookHotel(order_id);
          break;
        case "car":
          await bookCarTransfer(order_id);
          break;
        case "vacation":
          console.log("Processing vacation booking...");
          break;
        default:
          return res
            .status(400)
            .json({ success: false, message: "Invalid booking type" });
      }
      booking.paymentDetails.nowPaymentId = payment_id;
    } else {
      // Handle failed or pending payments
      booking.bookingStatus = "failed";
      booking.paymentDetails.paymentStatus = "failed";
    }

    // Save the updated booking
    await booking.save();

    return res.status(200).json({ returnCode: "SUCCESS" });
  } catch (error) {
    next(error);
  }
};

export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const paymentStatus = await nowpayment.getPaymentStatus(paymentId);

    return res.status(200).json({
      success: true,
      message: "Payment status retrieved successfully",
      data: paymentStatus,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    next(error);
  }
};

import axios from "axios";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { BinanceOrderPayload, PaymentStatusRequest } from "../types/binance";
import { OrderRequest } from "../types/requests";
import Booking from "../models/booking.model";
import { bookFlight, processFlightBooking } from "./flightsController";

import { customRequest } from "../types/requests";
import { bookCarTransfer, processingCarBooking } from "./carsController";
import { bookHotel, processingHotelBooking } from "./hotelsController";
import { sendMail } from "../utils/sendMail";
import User from "../models/user.model";
import Notification from "../models/notification.model";
dotenv.config();

// Environment Variables
const {
  BINANCE_API_KEY,
  BINANCE_SECRET_KEY,
  BINANCE_BASE_URL,
  BINANCE_RETURN_URL,
  BINANCE_CANCEL_URL,
  BINANCE_WEBHOOK_URL,
} = process.env;

if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY || !BINANCE_BASE_URL) {
  throw new Error("Missing required Binance API environment variables");
}

//  Utility Function: Generate Signature
const generateSignature = (
  payload: object
): { signature: string; timestamp: string; nonce: string } => {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payloadString = JSON.stringify(payload);
  const signatureString = `${timestamp}\n${nonce}\n${payloadString}\n`;

  const signature = crypto
    .createHmac("sha512", BINANCE_SECRET_KEY)
    .update(signatureString)
    .digest("hex")
    .toUpperCase();

  return { signature, timestamp, nonce };
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
    }: OrderRequest = req.body;

    if (!amount || !currency || !bookingType) {
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
    const paymentMethod = "Binance Pay";

    const cryptId = crypto.randomBytes(4).toString("hex");
    const orderId = `ORD-${cryptId}`;

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

    const payload: BinanceOrderPayload = {
      env: { terminalType: "WEB" },
      merchantTradeNo: cryptId,
      orderAmount: parseFloat(amount.toFixed(2)),
      currency: "USDT",
      goods: {
        goodsType: "02",
        goodsCategory: "Z000",
        referenceGoodsId: orderId,
        goodsName: "Booking Payment",
        goodsDetail: `Payment for ${bookingType} booking`,
      },
      tradeType: "WEB",
      timeout: 1800,
      returnUrl: BINANCE_RETURN_URL || "",
      cancelUrl: BINANCE_CANCEL_URL || "",
      webhookUrl: BINANCE_WEBHOOK_URL || "",
    };

    const { signature, timestamp, nonce } = generateSignature(payload);

    const response = await axios.post(
      `${BINANCE_BASE_URL}/binancepay/openapi/v2/order`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "BinancePay-Timestamp": timestamp,
          "BinancePay-Nonce": nonce,
          "BinancePay-Certificate-SN": BINANCE_API_KEY,
          "BinancePay-Signature": signature,
        },
        timeout: 20000,
      }
    );

    const user = await User.findById(userId);
    await Promise.all([
      sendMail({
        email: user?.email || "",
        subject:
          response.data.status === "SUCCESS"
            ? `${bookingType.toUpperCase()} - Booking Initiated`
            : `${bookingType.toUpperCase()} - Booking Failed`,
        message: `Dear ${user?.fullName || "Customer"},

    Your ${bookingType} booking has been ${response.data.status === "SUCCESS" ? "successfully initiated, please proceed with payment" : "failed"}. Your order ID is ${orderId}.

    ${response.data.status === "SUCCESS" ? "Thank you for choosing our service." : "Please try again or contact support."}

    Best regards,
    The Nesterlify Team`,
      }),
      Notification.create({
        userId,
        title:
          response.data.status === "SUCCESS"
            ? `${bookingType.toUpperCase()} - Booking Initiated`
            : `${bookingType.toUpperCase()} - Booking Failed`,
        message: `Your ${bookingType} booking with order ID ${orderId} has been ${response.data.status === "SUCCESS" ? "successfully initiated, please proceed with payment" : "failed"}.`,
        category: `${bookingType}`,
      }),
    ]);

    return res.status(200).json({
      success: response.data.status === "SUCCESS",
      message:
        response.data.status === "SUCCESS"
          ? "Binance Pay request successful"
          : "Binance Pay request failed",
      data: response.data,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

//  Payment Callback
export const binanceWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //  Verify Binance Signature
    const binanceSignature = req.headers["x-binancepay-signature"];
    const secretKey = process.env.BINANCE_WEBHOOK_SECRET;
    const requestBody = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secretKey || "")
      .update(requestBody)
      .digest("hex");

    if (binanceSignature !== expectedSignature) {
      console.error(" Invalid Binance webhook signature");
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    // Check if request body contains expected data
    if (!req.body || !req.body.data) {
      console.error(" Invalid webhook payload:", req.body);
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    const { data, bizStatus } = req.body;
    const { merchantTradeNo } = data;

    const orderId = `ORD-${merchantTradeNo}`;
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": orderId,
    });

    if (!booking) {
      console.error(` Booking not found for transaction ID: ${orderId}`);
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    console.log(
      ` Webhook received for booking ID: ${orderId} - Status: ${bizStatus}`
    );

    // Prevent Duplicate Processing
    if (booking.paymentDetails.paymentStatus === "completed") {
      return res.status(200).json({ returnCode: "SUCCESS" });
    }
    const bookingType = booking.bookingType;

    if (bizStatus === "PAY_SUCCESS") {
      switch (bookingType) {
        case "flight":
          await bookFlight(orderId);
          break;
        case "hotel":
          await bookHotel(orderId);
          break;
        case "car":
          await bookCarTransfer(orderId);
          break;
        case "vacation":
          console.log("Processing vacation booking...");
          break;
        default:
          return res
            .status(400)
            .json({ success: false, message: "Invalid booking type" });
      }

      booking.bookingStatus = "confirmed";
      booking.paymentDetails.paymentStatus = "completed";
    } else if (bizStatus === "PAY_PROCESSING") {
      console.log(" Payment is still processing...");
      booking.bookingStatus = "pending";
      booking.paymentDetails.paymentStatus = "processing";
    } else {
      console.log(" Payment failed or expired...");
      booking.bookingStatus = "failed";
      booking.paymentDetails.paymentStatus = "failed";
    }

    // Save updated booking status
    await booking.save();

    // Notify user if payment was successful
    if (bizStatus === "PAY_SUCCESS") {
      const user = await User.findById(booking.userId);

      await Promise.all([
        sendMail({
          email: user?.email || "",
          subject: "Payment Successful",
          message: `Dear ${user?.fullName || "Customer"},
          
          Your payment for ${bookingType} booking with order ID ${orderId} has been successfully processed.

          Thank you for choosing our service.

          Best regards,
          The Nesterlify Team`,
        }),
        Notification.create({
          userId: booking.userId,
          title: "Payment Successful",
          message: `Your payment for ${bookingType} booking with order ID ${orderId} has been successfully processed.`,
          category: `${bookingType}`,
        }),
      ]);
    }

    return res.status(200).json({ returnCode: "SUCCESS" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    next(error);
  }
};

//  Check Payment Status
export const checkPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orderId } = req.query as unknown as PaymentStatusRequest;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing orderId" });
    }

    const payload = { merchantTradeNo: orderId };
    const { signature, timestamp, nonce } = generateSignature(payload);

    const response = await axios.post(
      `${BINANCE_BASE_URL}/binancepay/openapi/v2/order/query`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "BinancePay-Timestamp": timestamp,
          "BinancePay-Nonce": nonce,
          "BinancePay-Certificate-SN": BINANCE_API_KEY,
          "BinancePay-Signature": signature,
        },
        timeout: 20000,
      }
    );

    if (response.data.status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: response.data.data.status,
        data: response.data.data,
      });
    }

    return res.status(400).json({
      success: false,
      message: response.data.errorMessage || "Failed to query payment status",
      data: response.data,
    });
  } catch (error) {
    next(error);
  }
};

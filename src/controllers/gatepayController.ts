import axios from "axios";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { GatePayOrderPayload, PaymentStatusRequest } from "../types/gatepay";
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
  GATEPAY_CLIENT_ID,
  GATEPAY_SECRET_KEY,
  GATEPAY_API_KEY,
  GATEPAY_MERCHANT_USERID,
  GATEPAY_CHAIN,
  GATEPAY_FULL_CURR_TYPE,
  GATEPAY_BASE_URL,
  GATEPAY_RETURN_URL,
  GATEPAY_CANCEL_URL,
} = process.env;

if (
  !GATEPAY_CLIENT_ID ||
  !GATEPAY_SECRET_KEY ||
  !GATEPAY_BASE_URL ||
  !GATEPAY_API_KEY
) {
  throw new Error("Missing required GatePay API environment variables");
}

// Generate Nonce (Random String)
const generateNonce = (length: number = 16): string => {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};

// Generate Signature
const generateSignature = (
  timestamp: string,
  nonce: string,
  body: string
): string => {
  if (!GATEPAY_API_KEY) {
    throw new Error("GATEPAY_SECRET_KEY is missing");
  }
  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  return crypto
    .createHmac("sha512", `${GATEPAY_API_KEY}=`)
    .update(payload)
    .digest("hex");
};

// Create Order with Booking Entry
export const createGatePayOrder = async (
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
    const paymentMethod = "Gate Pay";

    const orderId = `ORD-${crypto.randomBytes(4).toString("hex")}`;

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

    //  Construct Order Payload
    const payload = {
      merchantTradeNo: orderId,
      currency: "USDT",
      orderAmount: Number(amount).toFixed(8),
      env: { terminalType: "WEB" },
      goods: {
        goodsType: bookingType,
        goodsName: `${bookingType} - ${orderId}`,
        goodsDetail: `Payment for ${bookingType} booking`,
      },
      orderExpireTime: Date.now() + 3600000,
      returnUrl: GATEPAY_RETURN_URL!,
      cancelUrl: GATEPAY_CANCEL_URL!,
      merchantUserId: Number(GATEPAY_MERCHANT_USERID),
      chain: GATEPAY_CHAIN, 
      fullCurrType: GATEPAY_FULL_CURR_TYPE, 
    };

    const bodyString = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const nonce = generateNonce(16);
    const signature = generateSignature(timestamp, nonce, bodyString);

    //  Make API Request to GatePay
    const response = await axios.post(
      `${GATEPAY_BASE_URL}/v1/pay/checkout/order`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-GatePay-Certificate-ClientId": GATEPAY_CLIENT_ID!,
          "X-GatePay-Timestamp": timestamp,
          "X-GatePay-Nonce": nonce,
          "X-GatePay-Signature": signature,
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
            ? "Booking Initiated, please proceed with payment"
            : "Booking Failed",
        message: `Dear Customer,

    Your booking has been ${response.data.status === "SUCCESS" ? "successfully initiated" : "failed"}. Your order ID is ${orderId}.

    ${response.data.status === "SUCCESS" ? "Thank you for choosing our service." : "Please try again or contact support."}

    Best regards,
    The Nesterlify Team`,
      }),
      Notification.create({
        userId,
        title:
          response.data.status === "SUCCESS"
            ? "Booking Initiated"
            : "Booking Failed",
        message: `Your booking with order ID ${orderId} has been ${response.data.status === "SUCCESS" ? "successfully initiated, please proceed with payment" : "failed"}.`,
        category: `${bookingType} Booking`,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        response.data.status === "SUCCESS"
          ? "GatePay order created successfully"
          : "GatePay order creation failed",
      data: response.data,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const verifyGatePaySignature = (req: Request) => {
  const gatePaySecret = process.env.GATEPAY_WEBHOOK_SECRET!;
  const receivedSignature = req.headers["x-gatepay-signature"];

  const computedSignature = crypto
    .createHmac("sha256", gatePaySecret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  return receivedSignature === computedSignature;
};

// Payment Callback - Confirm Booking
export const gatePayWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("GatePay Webhook Notification:", req.body);

    // Verify Signature
    if (!verifyGatePaySignature(req)) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid signature" });
    }

    const { bizStatus, data } = req.body;

    // Ensure `data` Exists
    if (!data || !data.merchantTradeNo) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    const orderId = data.merchantTradeNo;

    // Find the booking
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": orderId,
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // Prevent Duplicate Processing
    if (booking.paymentDetails.paymentStatus === "completed") {
      return res.status(200).json({ returnCode: "SUCCESS" });
    }

    // Process Payment Status
    if (bizStatus === "PAY_SUCCESS") {
      switch (booking.bookingType) {
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
          await console.log("Processing vacation booking...");
          break;
        default:
          return res
            .status(400)
            .json({ success: false, message: "Invalid booking type" });
      }

      // Update Booking Status
      booking.bookingStatus = "confirmed";
      booking.paymentDetails.paymentStatus = "completed";
    } else {
      booking.bookingStatus = "failed";
      booking.paymentDetails.paymentStatus = "failed";
    }

    await booking.save();

    // Notify the User
    const user = await User.findById(booking.userId);

    await Promise.all([
      sendMail({
        email: user?.email || "",
        subject:
          bizStatus === "PAY_SUCCESS" ? "Payment Successful" : "Payment Failed",
        message: `Dear ${user?.fullName || "Customer"},
    
        Your payment for booking with order ID ${orderId} has been ${bizStatus === "PAY_SUCCESS" ? "successfully processed" : "failed"}.

        Thank you for choosing our service.

        Best regards,
        The Nesterlify Team`,
      }),
      Notification.create({
        userId: booking.userId,
        title:
          bizStatus === "PAY_SUCCESS" ? "Payment Successful" : "Payment Failed",
        message: `Your payment for booking with order ID ${orderId} has been ${bizStatus === "PAY_SUCCESS" ? "processed successfully" : "failed"}.`,
        category: `${booking.bookingType} Booking`,
      }),
    ]);

    return res.status(200).json({ returnCode: "SUCCESS" });
  } catch (error) {
    next(error);
  }
};

// Check Payment Status
export const checkGatePayStatus = async (
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

    const payload = { orderId };

    const bodyString = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const nonce = generateNonce(16);
    const signature = generateSignature(timestamp, nonce, bodyString);

    const response = await axios.post(
      `${GATEPAY_BASE_URL}/api/order/status`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-GatePay-API-Key": GATEPAY_API_KEY!,
          "X-GatePay-Signature": signature,
        },
        timeout: 10000,
      }
    );

    return res.status(200).json({
      success: true,
      message: response.data.status,
      data: response.data,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

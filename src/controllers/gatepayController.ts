import axios from "axios";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import {
  GatePayOrderPayload,
  PaymentStatusRequest,
} from "../types/gatepay";
import { OrderRequest } from "../types/requests";
import Booking from "../models/booking.model";
import { bookFlight, processFlightBooking } from "./flightsController";
import { customRequest } from "../types/requests";
import { bookCarTransfer, processingCarBooking } from "./carsController";
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
    // Todo: implement hotel check

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
        console.log("Processing hotel booking...");
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

    // ✅ Construct Order Payload
    const payload = {
      merchantTradeNo: orderId,
      currency: "USDT",
      orderAmount: Number(amount).toFixed(8),
      env: { terminalType: "WEB" },
      goods: {
        goodsType: "02",
        goodsName: `${bookingType} - ${orderId}`,
        goodsDetail: `Order No: ${orderId}`,
      },
      orderExpireTime: Date.now() + 3600000,
      returnUrl: GATEPAY_RETURN_URL!,
      cancelUrl: GATEPAY_CANCEL_URL!,
      merchantUserId: Number(GATEPAY_MERCHANT_USERID), // Ensure it's a number
      chain: GATEPAY_CHAIN, // Ensure valid value
      fullCurrType: GATEPAY_FULL_CURR_TYPE, // Ensure valid value
    };

    const bodyString = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const nonce = generateNonce(16);
    const signature = generateSignature(timestamp, nonce, bodyString);

    // ✅ Make API Request to GatePay
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

// Payment Callback - Confirm Booking
export const gatePayWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bizStatus, data } = req.body;
    console.log("GatePay Webhook Notification:", req.body);

    const orderId = data.merchantTradeNo;

    const booking = await Booking.findOne({
      "paymentDetails.transactionId": orderId,
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    const bookingType = booking.bookingType;

    if (bizStatus === "PAY_SUCCESS") {
      switch (bookingType) {
        case "flight":
          await bookFlight(orderId);
          break;
        case "hotel":
          console.log("Processing hotel booking...");
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
    } else {
      booking.bookingStatus = "failed";
      booking.paymentDetails.paymentStatus = "failed";
      await booking.save();
      return res.status(200).json({
        returnCode: "FAIL",
      });
    }

    //  Save the booking with updated flight details and payment status
    await booking.save();

    return res.status(200).json({
      returnCode: "SUCCESS",
    });
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
    const { orderId }: PaymentStatusRequest = req.body;
    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing orderId" });
    }

    const payload = { orderId };
    // const { signature } = generateSignature(payload);

    const response = await axios.post(
      `${GATEPAY_BASE_URL}/api/order/status`,
      payload
      // {
      //   headers: {
      //     "Content-Type": "application/json",
      //     "X-GatePay-API-Key": GATEPAY_API_KEY!,
      //     "X-GatePay-Signature": signature,
      //   },
      //   timeout: 10000,
      // }
    );

    return res.status(200).json({
      success: true,
      message: response.data.status,
      data: response.data,
    });
  } catch (error) {
    next(error);
  }
};

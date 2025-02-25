import axios from "axios";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import {
  BinanceOrderPayload,
  PaymentStatusRequest,
} from "../types/requests/binance";
import { OrderRequest } from "../types/requests";
import Booking from "../models/booking.model";
import { bookFlight, processFlightBooking } from "./flightsController";

import { customRequest } from "../types/requests";
import { bookCarTransfer, processingCarBooking } from "./carsController";
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
    const paymentMethod = "Binance Pay";

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

    const payload: BinanceOrderPayload = {
      env: { terminalType: "WEB" },
      merchantTradeNo: orderId,
      orderAmount: parseFloat(amount.toFixed(2)),
      currency: "USDT",
      goods: {
        goodsType: "01",
        goodsCategory: "0000",
        referenceGoodsId: orderId,
        goodsName: "Booking Payment",
        goodsDetail: "Payment for booking services",
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
export const paymentCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { data, bizStatus } = req.body;
    const { merchantTradeNo } = data;
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": merchantTradeNo,
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
          await bookFlight(merchantTradeNo);
          break;
        case "hotel":
          console.log("Processing hotel booking...");
          break;
        case "car":
          await bookCarTransfer(merchantTradeNo);
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

//  Check Payment Status
export const checkPaymentStatus = async (
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
        timeout: 10000,
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

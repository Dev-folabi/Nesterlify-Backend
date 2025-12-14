import axios from "axios";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { BinanceOrderPayload, PaymentStatusRequest } from "../types/binance";
import Booking from "../models/booking.model";
import { bookCarTransfer, bookFlight, bookHotel } from "../function/bookings";
import { customRequest } from "../types/requests";
import { sendMail } from "../utils/sendMail";
import User from "../models/user.model";
import Notification from "../models/notification.model";
import logger from "../utils/logger";
import { processCommonBooking } from "../utils/bookingUtils";
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
    const bookingResult = await processCommonBooking(
      req as customRequest,
      res,
      "Binance Pay"
    );

    if (!bookingResult.success) {
      return res.status(bookingResult.status!).json({
        success: false,
        message: bookingResult.message,
      });
    }

    const { orderId, user, amount, currency, bookingType } =
      bookingResult.data!;

    const payload: BinanceOrderPayload = {
      env: { terminalType: "WEB" },
      merchantTradeNo: orderId,
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

    await Promise.all([
      sendMail({
        email: user?.email || "",
        subject:
          response.data.status === "SUCCESS"
            ? `${bookingType.toUpperCase()} - Booking Initiated`
            : `${bookingType.toUpperCase()} - Booking Failed`,
        message: `Dear ${user?.firstName || "Customer"},

    Your ${bookingType} booking has been ${response.data.status === "SUCCESS" ? "successfully initiated, please proceed with payment" : "failed"}. Your order ID is ${orderId}.

    ${response.data.status === "SUCCESS" ? "Thank you for choosing our service." : "Please try again or contact support."}

    Best regards,
    The Nesterlify Team`,
      }),
      Notification.create({
        userId: user?._id,
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
  } catch (error: any) {
    if (error.response) {
      logger.error(
        "Binance API Error Response:",
        JSON.stringify(
          {
            status: error.response.status,
            data: error.response.data,
          },
          null,
          2
        )
      );
    } else {
      logger.error("Binance API Error:", error.message);
    }
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
      logger.error(" Invalid Binance webhook signature");
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    // Check if request body contains expected data
    if (!req.body || !req.body.data) {
      logger.error(`Invalid webhook payload: ${JSON.stringify(req.body)}`);
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
      logger.error(` Booking not found for transaction ID: ${orderId}`);
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    logger.info(
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
          logger.info("Processing vacation booking...");
          break;
        default:
          return res
            .status(400)
            .json({ success: false, message: "Invalid booking type" });
      }

      booking.bookingStatus = "confirmed";
      booking.paymentDetails.paymentStatus = "completed";
    } else if (bizStatus === "PAY_PROCESSING") {
      logger.info(" Payment is still processing...");
      booking.bookingStatus = "pending";
      booking.paymentDetails.paymentStatus = "processing";
    } else {
      logger.info(" Payment failed or expired...");
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
          message: `Dear ${user?.firstName || "Customer"},
          
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
    logger.error("Webhook processing error:", error);
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

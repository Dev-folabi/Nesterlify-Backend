import axios from "axios";
import crypto from "crypto";
import Booking from "../models/booking.model";
import User from "../models/user.model";
import Notification from "../models/notification.model";
import { sendMail } from "../utils/sendMail";
import logger from "../utils/logger";
import { bookFlight, bookHotel, bookCarTransfer } from "../function/bookings";
import { sendPaymentSuccessEmail } from "../utils/emailUtils";

// Environment Variables
const { GATEPAY_API_KEY, GATEPAY_BASE_URL, GATEPAY_CLIENT_ID } = process.env;

// Generate Nonce (Random String)
export const generateNonce = (length: number = 16): string => {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};

// Generate Signature
export const generateSignature = (
  timestamp: string,
  nonce: string,
  body: string
): string => {
  if (!GATEPAY_API_KEY) {
    throw new Error("GATEPAY_API_KEY is missing");
  }
  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  return crypto
    .createHmac("sha512", `${GATEPAY_API_KEY}=`)
    .update(payload)
    .digest("hex");
};

// Query GatePay Order Status
export const queryGatePayOrder = async (orderId: string) => {
  try {
    const payload = { orderId };
    const bodyString = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const nonce = generateNonce(16);
    const signature = generateSignature(timestamp, nonce, bodyString);

    const response = await axios.post(
      `${GATEPAY_BASE_URL}/v1/pay/order/query`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-GatePay-API-Key": GATEPAY_API_KEY!,
          "X-GatePay-Certificate-ClientId": GATEPAY_CLIENT_ID!,
          "X-GatePay-Timestamp": timestamp,
          "X-GatePay-Nonce": nonce,
          "X-GatePay-Signature": signature,
        },
        timeout: 10000,
      }
    );
    logger.info(`Querying GatePay order ${orderId}:`, response.data);
    return response.data;
  } catch (error) {
    logger.error(`Error querying GatePay order ${orderId}:`, error);
    return null;
  }
};

// Close GatePay Order
export const closeGatePayOrder = async (orderId: string) => {
  try {
    const payload = { orderId };
    const bodyString = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const nonce = generateNonce(16);
    const signature = generateSignature(timestamp, nonce, bodyString);

    const response = await axios.post(
      `${GATEPAY_BASE_URL}/v1/pay/order/close`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-GatePay-API-Key": GATEPAY_API_KEY!,
          "X-GatePay-Certificate-ClientId": GATEPAY_CLIENT_ID!,
          "X-GatePay-Timestamp": timestamp,
          "X-GatePay-Nonce": nonce,
          "X-GatePay-Signature": signature,
        },
        timeout: 10000,
      }
    );
    logger.info(`Closing GatePay order ${orderId}:`, response.data);
    return response.data;
  } catch (error) {
    logger.error(`Error closing GatePay order ${orderId}:`, error);
    return null;
  }
};

// Process Successful Payment
export const processSuccessfulPayment = async (
  booking: any,
  orderId: string
) => {
  try {
    if (booking.paymentDetails.paymentStatus === "completed") return;

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
        logger.info("Processing vacation booking...");
        break;
    }

    booking.bookingStatus = "confirmed";
    booking.paymentDetails.paymentStatus = "completed";
    await booking.save();

    const user = await User.findById(booking.userId);
    await sendPaymentSuccessEmail({
      user,
      booking,
      orderId,
    });
  } catch (error) {
    logger.error(
      `Error processing successful payment for order ${orderId}:`,
      error
    );
  }
};

// Poll Pending Orders
export const pollPendingOrders = async () => {
  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Find pending orders created in the last 10 minutes
    const pendingBookings = await Booking.find({
      "paymentDetails.paymentStatus": "pending",
      "paymentDetails.paymentMethod": "Gate Pay",
      createdAt: { $gte: tenMinutesAgo },
    });

    if (pendingBookings.length === 0) {
      logger.info("No pending GatePay orders found");
      return;
    }

    for (const booking of pendingBookings) {
      try {
        const orderId = booking.paymentDetails.transactionId;
        const response = await queryGatePayOrder(orderId);
        if (
          response &&
          (response.status === "PAY_SUCCESS" ||
            response.status === "SUCCESS" ||
            response.data?.status === "PAY_SUCCESS")
        ) {
          await processSuccessfulPayment(booking, orderId);
        }
      } catch (err) {
        logger.error(`Error processing pending order ${booking._id}:`, err);
      }
    }

    // Handle expired orders (older than 10 mins and still pending)
    const expiredBookings = await Booking.find({
      "paymentDetails.paymentStatus": "pending",
      "paymentDetails.paymentMethod": "Gate Pay",
      createdAt: { $lt: tenMinutesAgo },
    });

    if (expiredBookings.length > 0) {
      logger.info(
        `Closing ${expiredBookings.length} expired GatePay orders...`
      );
      for (const booking of expiredBookings) {
        try {
          const orderId = booking.paymentDetails.transactionId;
          logger.info(
            `Closing expired order ${orderId} (created at: ${booking.createdAt})`
          );
          await closeGatePayOrder(orderId);

          booking.bookingStatus = "cancelled";
          booking.paymentDetails.paymentStatus = "failed";
          // Skip validation when saving cancelled bookings to avoid errors with incomplete data
          await booking.save({ validateBeforeSave: false });
          logger.info(`Successfully closed expired order ${orderId}`);
        } catch (err) {
          logger.error(`Error closing expired order ${booking._id}:`, err);
        }
      }
    }
  } catch (error) {
    logger.error("Error in GatePay polling job:", error);
  }
};

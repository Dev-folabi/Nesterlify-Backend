import { Request, Response, NextFunction } from "express";
import nowpayment from "../service/nowpayment";
import crypto from "crypto";
import { OrderRequest } from "../types/requests";
import Booking from "../models/booking.model";
import { bookFlight, bookCarTransfer, bookHotel } from "../function/bookings";
import { customRequest } from "../types/requests";
import { sendMail } from "../utils/sendMail";
import User from "../models/user.model";
import Notification from "../models/notification.model";
import dotenv from "dotenv";
import logger from "../utils/logger";
import { processCommonBooking } from "../utils/bookingUtils";
import { sendPaymentSuccessEmail } from "../utils/emailUtils";

dotenv.config();

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
    logger.error(error);
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
    const bookingResult = await processCommonBooking(
      req as customRequest,
      res,
      "Now Payment"
    );

    if (!bookingResult.success) {
      return res.status(bookingResult.status!).json({
        success: false,
        message: bookingResult.message,
      });
    }

    const { orderId, user, amount, currency, bookingType } =
      bookingResult.data!;

    const paymentData = {
      price_amount: parseFloat(amount.toFixed(1)),
      price_currency: currency,
      pay_currency: req.body.pay_currency,
      ipn_callback_url: process.env.NOWPAYMENT_WEBHOOK_URL || "",
      order_id: orderId,
      order_description: `Payment for ${bookingType} booking`,
      customer_email: user?.email,
    };

    const response = await nowpayment.createPayment(paymentData);

    if (!response || !response.payment_id || !response.payment_status) {
      return res.status(500).json({
        success: false,
        message: response || "Failed to create payment. Please try again.",
      });
    }

    await Promise.all([
      sendMail({
        email: user?.email || "",
        subject:
          response.payment_status === "waiting"
            ? `${bookingType.toUpperCase()} - Booking Initiated`
            : `${bookingType.toUpperCase()} - Booking Failed`,
        message: `Dear ${user?.firstName || "Customer"},
    
        Your ${bookingType} booking has been ${response.payment_status === "waiting" ? "successfully initiated, please proceed with payment" : "failed"}. Your order ID is ${orderId}.
    
        ${response.payment_status === "waiting" ? "Thank you for choosing our service." : "Please try again or contact support."}
    
        Best regards,
        The Nesterlify Team`,
      }),
      Notification.create({
        userId: user?._id,
        title:
          response.payment_status === "waiting"
            ? `${bookingType.toUpperCase()} - Booking Initiated`
            : `${bookingType.toUpperCase()} - Booking Failed`,
        message: `Your ${bookingType} booking with order ID ${orderId} has been ${response.payment_status === "waiting" ? "successfully initiated, please proceed with payment" : "failed"}.`,
        category: `${bookingType}`,
      }),
    ]);

    return res.status(200).json({
      success: response.payment_status === "waiting",
      message:
        response.payment_status === "waiting"
          ? "Now Payment request successful"
          : "Now Payment request failed",
      data: response,
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

// Payment webhook - Confirm Booking
export const nowPaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info(
      `NOWPayments Webhook Notification: ${JSON.stringify(req.body)}`
    );

    const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET!;

    // Extract signature from headers
    const nowPaymentsSig = req.headers["x-nowpayments-sig"] as string;

    if (!nowPaymentsSig) {
      return res
        .status(400)
        .json({ success: false, message: "Missing signature" });
    }

    // Helper function to recursively sort JSON keys
    const sortObject = (obj: any): any => {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(sortObject);
      }
      return Object.keys(obj)
        .sort()
        .reduce((result: any, key: string) => {
          result[key] = sortObject(obj[key]);
          return result;
        }, {});
    };

    // Generate the HMAC signature with properly sorted JSON
    const sortedBody = sortObject(req.body);
    const sortedParams = JSON.stringify(sortedBody);
    const generatedSignature = crypto
      .createHmac("sha512", IPN_SECRET)
      .update(sortedParams)
      .digest("hex");

    if (generatedSignature !== nowPaymentsSig) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid signature" });
    }

    const { payment_id, payment_status, order_id } = req.body;

    if (!payment_id || !payment_status || !order_id) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    // Find the booking and populate the user details
    const booking = await Booking.findOne({
      "paymentDetails.transactionId": order_id,
    }).populate("userId");

    const user = await User.findById(booking?.userId);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // Prevent duplicate booking confirmation
    if (
      booking.paymentDetails.nowPaymentId === String(payment_id) &&
      booking.paymentDetails.paymentStatus === "completed"
    ) {
      return res.status(200).json({ returnCode: "SUCCESS" });
    }

    const bookingType = booking.bookingType;

    switch (payment_status) {
      case "waiting":
        booking.paymentDetails.paymentStatus = "pending";
        booking.bookingStatus = "pending";
        await booking.save(); // Save immediately
        break;

      case "confirming":
        booking.paymentDetails.paymentStatus = "processing";
        booking.bookingStatus = "pending";
        await booking.save();
        break;

      case "finished":
        try {
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
              logger.info("Processing vacation booking...");
              break;
            default:
              return res
                .status(400)
                .json({ success: false, message: "Invalid booking type" });
          }
        } catch (err) {
          logger.error("Booking processing error:", err);
          return res
            .status(500)
            .json({ success: false, message: "Booking processing failed" });
        }

        booking.paymentDetails.nowPaymentId = payment_id;
        booking.paymentDetails.paymentStatus = "completed";
        await booking.save();

        // Send email and notification
        if (user) {
          // Refetch booking to get the updated details (e.g. confirmed car/hotel info)
          const updatedBooking = await Booking.findById(booking._id);
          if (updatedBooking) {
            await sendPaymentSuccessEmail({
              user,
              booking: updatedBooking,
              orderId: order_id,
            });
          }
        }
        break;

      case "failed":
        booking.paymentDetails.paymentStatus = "failed";
        booking.bookingStatus = "failed";
        await booking.save();
        return res.status(200).json({ returnCode: "SUCCESS" });

      default:
        return res
          .status(400)
          .json({ success: false, message: "Unknown payment status" });
    }

    return res.status(200).json({ returnCode: "SUCCESS" });
  } catch (error) {
    logger.error("NOWPayments Webhook Error:", error);
    next(error);
  }
};

export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paymentId } = req.query;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const paymentStatus = await nowpayment.getPaymentStatus(
      paymentId as string
    );

    return res.status(200).json({
      success: true,
      message: "Payment status retrieved successfully",
      data: paymentStatus,
    });
  } catch (error) {
    logger.error("Error fetching payment status:", error);
    next(error);
  }
};

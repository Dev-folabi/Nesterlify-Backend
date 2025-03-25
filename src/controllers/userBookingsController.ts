import { NextFunction, Request, Response } from "express";
import Booking from "../models/booking.model";
import { customRequest } from "../types/requests";
import { paginateResults } from "../function";

// Get all bookings for a particular user with filters
export const getUserBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as customRequest).user?.id;

    const { bookingType, bookingStatus } = req.query;

    const query: any = { userId };

    if (bookingType) {
      query.bookingType = bookingType;
    }

    if (bookingStatus) {
      query.bookingStatus = bookingStatus;
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: paginateResults(
        bookings,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error) {
    console.log({ message: "Error fetching bookings", error });
    next(error);
  }
};

// Get a single booking by ID
export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully",
      data: booking,
    });
  } catch (error) {
    console.log({ message: "Error fetching booking", error });
    next(error);
  }
};

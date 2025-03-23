import { Router } from "express";
import {
  getUserBookings,
  getBookingById,
} from "../controllers/userBookingsController";
import {
  validateBookingById,
  validateUserBookings,
} from "../middleware/validators/userValidator";

const router = Router();

// Route to get all bookings for a particular user with filters
router.get("/", validateUserBookings, getUserBookings);

// Route to get a single booking by ID
router.get("/:bookingId", validateBookingById, getBookingById);

export default router;

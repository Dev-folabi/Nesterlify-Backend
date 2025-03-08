import { Router } from "express";
import { findHotels, fetchRoomRates, quoteBooking, } from "../controllers/hotelsController";
import { validateHotelSearch } from "../middleware/validators/flightValidator";

const router: Router = Router();

router.post("/", validateHotelSearch, findHotels);
router.get("/rooms-rate/:id", fetchRoomRates);
router.get("/quote/:rate_id", quoteBooking);

export default router;

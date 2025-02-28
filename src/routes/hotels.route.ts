import { Router } from "express";
import { findHotels, fetchRoomRates, quoteBooking, } from "../controllers/hotelsController";

const router: Router = Router();

router.post("/", findHotels);
router.get("/rooms-rate/:id", fetchRoomRates);
router.get("/quote/:rate_id", quoteBooking);

export default router;

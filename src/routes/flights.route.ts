import { Router } from "express";
import {
  searchLocation,
  searchFlights,
  searchMultiCityFlights,
  confirmFlightPricing,
  trackFlight,
} from "../controllers/flightsController";
import {
  validateMultiCityFlights,
  validateSearchFlights,
  validateLocationSearch,
  validateTrackFlight,
} from "../middleware/validators/flightValidator";

const router: Router = Router();

router.get("/search", validateLocationSearch, searchLocation);
router.get("/", validateSearchFlights, searchFlights);
router.post("/multi-city", validateMultiCityFlights, searchMultiCityFlights);
router.post("/price", confirmFlightPricing);
router.get("/track", validateTrackFlight, trackFlight);
export default router;

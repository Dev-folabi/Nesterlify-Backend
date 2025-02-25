import { Router } from "express";
import {
    searchLocation,
  searchFlights,
  searchMultiCityFlights,
  confirmFlightPricing,
} from "../controllers/flightsController";
import {
  validateMultiCityFlights,
  validateSearchFlights,
  validateLocationSearch,
} from "../middleware/validators/flightValidator";
import { get } from "lodash";

const router: Router = Router();

router.get("/search", validateLocationSearch, searchLocation);
router.get("/", validateSearchFlights, searchFlights);
router.post("/multi-city", validateMultiCityFlights, searchMultiCityFlights);
router.post("/price", confirmFlightPricing);
export default router;

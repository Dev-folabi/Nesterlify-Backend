import { Router } from "express";
import { findCars, getMatchingAirports } from "../controllers/carsController";

import { validateFindCars } from "../middleware/validators/carsValidator";

const router: Router = Router();

router.get("/matching-airports", getMatchingAirports);
router.post("/", validateFindCars, findCars);

export default router;

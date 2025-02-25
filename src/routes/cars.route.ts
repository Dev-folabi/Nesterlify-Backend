import { Router } from "express";
import { findCars, getMatchingAirports } from "../controllers/carsController";

const router: Router = Router();

router.get("/matching-airports", getMatchingAirports);
router.post("/", findCars);


export default router;

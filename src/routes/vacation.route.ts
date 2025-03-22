import { Router } from "express";
import {
  getCoordinates,
  getVacations,
  getVacationById,
  bookVacation
} from "../controllers/vacationController";

const router = Router();

router.get("/getCoordinates", getCoordinates);
router.get("/", getVacations);
router.get("/getVacationById/:activityId", getVacationById);
// router.post("/", bookVacation);
export default router;

import { Router } from "express";
import authRoutes from "./auth.route";
import userRoutes from "./user.route";
import carRoutes from "./cars.route";
import hotelRoutes from "./hotels.route";
import flightRoutes from "./flights.route";
import binanceRoutes from "./binance.route";
import newsletterRoutes from "./newsletter.route";
import gatepayRoutes from "./gatepay.route";
import vacationRoutes from "./vacation.route";
const router: Router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/cars", carRoutes);
router.use("/hotels", hotelRoutes);
router.use("/flights", flightRoutes);
router.use("/binance", binanceRoutes);
router.use("/gatepay", gatepayRoutes);
router.use("/vacation", vacationRoutes);
router.use("/newsletter", newsletterRoutes);

export default router;

import { Router } from "express";
import {
  createOrder,
  paymentCallback,
  checkPaymentStatus,
} from "../controllers/binanceController";
import { verifyToken } from "../middleware/verify";
import { validateCreateOrder } from "../middleware/validators/payment";

const router: Router = Router();

router.post("/create-order", verifyToken, validateCreateOrder, createOrder);
router.post("/webhook", paymentCallback);
router.post("/status", checkPaymentStatus);

export default router;

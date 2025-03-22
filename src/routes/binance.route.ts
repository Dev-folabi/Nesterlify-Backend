import { Router } from "express";
import {
  createOrder,
  binanceWebhook,
  checkPaymentStatus,
} from "../controllers/binanceController";
import { verifyToken } from "../middleware/verify";
import { validateCreateOrder } from "../middleware/validators/payment";

const router: Router = Router();

router.post("/create-order", verifyToken, validateCreateOrder, createOrder);
router.post("/webhook", binanceWebhook);
router.get("/status", checkPaymentStatus);

export default router;

import { Router } from "express";
import {
  getNowPaymentCurrencies,
  createOrder,
  nowPaymentWebhook,
  getPaymentStatus,
} from "../controllers/nowpaymentController";
import { verifyToken } from "../middleware/verify";
import { validateCreateOrder } from "../middleware/validators/payment";

const router = Router();

router.get("/", getNowPaymentCurrencies);
router.post("/create-order", verifyToken, validateCreateOrder, createOrder);
router.post("/webhook", nowPaymentWebhook);
router.get("/status/:paymentId", getPaymentStatus);

export default router;

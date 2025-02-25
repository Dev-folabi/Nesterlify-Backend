import express from "express";
import { 
  createGatePayOrder, 
  gatePayWebhook, 
  checkGatePayStatus 
} from "../controllers/gatepayController";
import { verifyToken } from "../middleware/verify";
import { validateCreateOrder } from "../middleware/validators/payment";

const router = express.Router();

//  Route to create a GatePay order
router.post("/create-order", validateCreateOrder, verifyToken, createGatePayOrder);

//  Route to handle GatePay webhook notifications
router.post("/webhook", gatePayWebhook);

//  Route to check payment status
router.post("/status", checkGatePayStatus);

export default router;

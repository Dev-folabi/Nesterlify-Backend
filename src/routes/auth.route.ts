import { Router } from "express";
import {
  validateSignup,
  validateActivate,
  validateResendOTP,
  validateSignin,
  validateRequestPasswordReset,
  validateVerifyPasswordOTP,
  validateVerifyOTP,
} from "../middleware/validators/authValidator";

import {
  signup,
  activate,
  resendOTP,
  requestPasswordReset,
  verifyPasswordOTP,
  signin,
  verifyOTP,
} from "../controllers/authController";

const router: Router = Router();

router.post("/signup", validateSignup, signup);
router.post("/activate", validateActivate, activate);
router.post("/resend-otp", validateResendOTP, resendOTP);
router.post("/signin", validateSignin, signin);

router.post(
  "/password-reset/request",
  validateRequestPasswordReset,
  requestPasswordReset
);

router.get("/verify/:otpCode", validateVerifyOTP, verifyOTP);

router.post(
  "/password-reset/verify-otp",
  validateVerifyPasswordOTP,
  verifyPasswordOTP
);

export default router;

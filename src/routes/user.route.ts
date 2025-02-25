import { Router } from "express";
import {
  editProfile,
  getUser,
  users,
  deleteUser,
  admins,
  blockUser,
  deleteSelectedUsers,
  twoFA,
  webNotification,
  emailToggle,
  emailNotification,
  changePassword,
  verifyChangePasswordOTP,
} from "../controllers/userController";
import { verifyToken } from "../middleware/verify";
import {
  validateEditProfile,
  validateEmailNotification,
  validateWebNotification,
  validateChangePassword,
  validateVerifyChangePasswordOTP,
  validateDeleteUser,
  validateBlockUser,
  validateDeleteSelectedUsers,
  validateTwoFA,
  validateEmailToggle,
} from "../middleware/validators/userValidator";

const router: Router = Router();

router.get("/profile", verifyToken, getUser);
router.post(
  "/editProfile",
  verifyToken,
  validateEditProfile,
  editProfile
);
router.get("/", verifyToken, users);
router.post("/two-fa", verifyToken, validateTwoFA, twoFA);
router.post("/email-toggle", verifyToken, validateEmailToggle, emailToggle);
router.post(
  "/email-notification",
  verifyToken,
  validateEmailNotification,
  emailNotification
);
router.post(
  "/web-notification",
  verifyToken,
  validateWebNotification,
  webNotification
);
router.post(
  "/change-password",
  verifyToken,
  validateChangePassword,
  changePassword
);
router.post(
  "/change-password/verify",
  verifyToken,
  validateVerifyChangePasswordOTP,
  verifyChangePasswordOTP
);
router.delete("/delete-user/:id", verifyToken, validateDeleteUser, deleteUser);
router.delete(
  "/delete/selected",
  verifyToken,
  validateDeleteSelectedUsers,
  deleteSelectedUsers
);
router.get("/all/admins/", verifyToken, admins);
router.patch("/block-user/:id", verifyToken, validateBlockUser, blockUser);

export default router;

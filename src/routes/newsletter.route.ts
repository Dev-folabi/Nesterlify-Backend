import { Router } from "express";
import { subscribe } from "../controllers/newsletterController";
import { validateSubscription } from "../middleware/validators/newsletterValidator";

const router: Router = Router();

router.post("/subscribe", validateSubscription, subscribe);

export default router;

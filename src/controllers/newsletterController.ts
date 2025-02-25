import { Request, Response, NextFunction } from "express";
import Newsletter from "../models/newsletter.model";
import { errorHandler } from "../middleware/errorHandler";
import { SubscriptionRequest } from "../types/requests";


// Subscription Controller
export const subscribe = async (
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    // Check if email is already subscribed
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      return errorHandler(
        res,
        400,
        "You're already subscribed to our newsletter."
      );
    }

    // Save new subscription
    const newSubscription = new Newsletter({ email });
    await newSubscription.save();

    res.status(201).json({
      success: true,
      message:
        "Welcome aboard! You're now officially part of our community and will receive the latest updates straight to your inbox. Thanks for subscribing!",
      data: { email },
    });
  } catch (error) {
    next(
      errorHandler(
        res,
        500,
        "Unable to subscribe to our newsletter. Please try again later."
      )
    );
  }
};

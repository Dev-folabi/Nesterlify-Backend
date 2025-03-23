import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { errorHandler } from "./errorHandler";
import User from "../models/user.model";
import rateLimit from "express-rate-limit";

// Define a custom request type to include user data
export interface CustomRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

interface DecodedToken {
  id: string;
}

// Verify JWT Token
export const verifyToken = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorHandler(res, 401, "You are not authenticated!");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return errorHandler(res, 401, "Token not provided");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as DecodedToken;
    const user = await User.findById(decoded.id);

    if (!user) {
      return errorHandler(res, 404, "User not found");
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    return errorHandler(res, 403, "Token is not valid!");
  }
};

// Check if user has admin role or specific roles
export const isAdmin = (...roles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction): void => {
    console.log("User Data:", req.user);

    if (!req.user || !roles.includes(req.user.role)) {
      return errorHandler(
        res,
        403,
        `${req.user ? req.user.role : "user"} cannot access this resource`
      );
    }

    next();
  };
};

// Rate Limit
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  headers: true, // Send rate limit info in response headers
});

// Block Bots and Crawlers
const blockedBots = [
  /googlebot/i, // Google crawler
  /bingbot/i, // Bing crawler
  /yandexbot/i, // Yandex crawler
  /baiduspider/i, // Baidu crawler
  /duckduckbot/i, // DuckDuckGo bot
  /facebookexternalhit/i, // Facebook preview bot
  /twitterbot/i, // Twitter preview bot
  /slurp/i, // Yahoo crawler
  /mj12bot/i, // Majestic SEO bot
  /semrushbot/i, // Semrush SEO bot
  /ahrefsbot/i, // Ahrefs SEO bot
  /petalbot/i, // Huawei search bot
  /telegrambot/i, // Telegram link preview bot
  /discordbot/i, // Discord preview bot
  /whatsapp/i, // WhatsApp preview bot
  /linkedinbot/i, // LinkedIn preview bot
  /pinterest/i, // Pinterest bot
  /redditbot/i, // Reddit bot
  /skypeuripreview/i, // Skype preview bot
  /mastodonbot/i, // Mastodon bot
  /slackbot/i, // Slack bot
  /applebot/i, // Apple search bot
  /sogou/i, // Sogou bot
  /curl/i, // Curl requests
  /wget/i, // Wget requests
  /python-requests/i, // Python requests module
  /java/i, // Java-based scrapers
  /Go-http-client/i, // Go-based scrapers
  /httpclient/i, // Generic HTTP clients
  /node/i, // Node.js requests
];

export const blockBots = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers["user-agent"] || "";

  if (blockedBots.some((botRegex) => botRegex.test(userAgent))) {
    console.warn(`Blocked bot access: ${userAgent}`);
    return res
      .status(403)
      .json({ success: false, message: "Bots are not allowed" });
  }

  next();
};

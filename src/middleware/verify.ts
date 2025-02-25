import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { errorHandler } from "./errorHandler";
import User from "../models/user.model";

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
export const verifyToken = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorHandler(res, 401, "You are not authenticated!");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return errorHandler(res, 401, "Token not provided");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
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

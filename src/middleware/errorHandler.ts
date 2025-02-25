import { Response } from "express";

export const errorHandler = <T = any>(
  res: Response,
  statusCode: number,
  message: string,
  data: T | null = null
) => {
  res.status(statusCode).json({ success: false, message, data });
};

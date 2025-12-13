import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const { method, url, query, body } = req;

  // Sanitize body to remove sensitive information
  const sanitizedBody = { ...body };
  const sensitiveFields = ["password", "token", "creditCard", "cvv"];
  sensitiveFields.forEach((field) => {
    if (sanitizedBody[field]) {
      sanitizedBody[field] = "***";
    }
  });

  logger.http(`Request: ${method} ${url}`);
  if (Object.keys(query).length > 0) {
    logger.debug(`Query: ${JSON.stringify(query)}`);
  }
  if (Object.keys(sanitizedBody).length > 0) {
    logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`);
  }

  // Log response status
  const originalSend = res.send;
  res.send = function (body) {
    logger.http(`Response Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };

  next();
};

export default requestLogger;

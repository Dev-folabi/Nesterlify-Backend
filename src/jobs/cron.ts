import cron from "node-cron";
import { pollPendingOrders } from "../service/gatepayService";
import logger from "../utils/logger";

export const startCronJobs = () => {
  // Schedule GatePay polling every 30 seconds
  cron.schedule("*/30 * * * * *", async () => {
    try {
      logger.info("Running GatePay polling cron job...");
      await pollPendingOrders();
    } catch (error) {
      logger.error("Error running GatePay polling cron job:", error);
    }
  });

  logger.info("Cron jobs started: GatePay polling every 30s");
};

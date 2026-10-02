import cron from "node-cron";
import { expireDuePermits } from "../services/expiryService";

/** Runs every minute on the server, whether or not anyone has the website open. */
export function startExpiryJob() {
  return cron.schedule("* * * * *", async () => {
    try {
      const n = await expireDuePermits(new Date());
      if (n > 0) console.log(`[expiry] expired ${n} permit(s)`);
    } catch (e) {
      console.error("[expiry] job failed", e);
    }
  });
}

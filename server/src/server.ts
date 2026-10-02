import { createApp } from "./app";
import { env } from "./config/env";
import { startExpiryJob } from "./jobs/expiryJob";

createApp().listen(env.PORT, () => {
  console.log(`PTW API listening on port ${env.PORT}`);
  if (env.RUN_EXPIRY_JOB) {
    startExpiryJob();
    console.log("Expiry job started (every minute).");
  }
});

import { getAppConfig } from './config/app-config.js';
import { createApp } from './create-app.js';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(getAppConfig().port);
}
await bootstrap();

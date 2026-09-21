import { JarvisSecurityClient } from './core/client.js';
import { ApiServer } from './api/server.js';
import { db } from './database/db.js';
import { Logger } from './utils/logger.js';
import { rateLimiter } from './utils/slidingWindow.js';

const client = new JarvisSecurityClient();
const apiServer = new ApiServer(client);

// Manejo robusto de errores para garantizar que el bot y la API NUNCA caigan durante un ataque
process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled Promise Rejection detectado:', reason, 'Process');
});

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught Exception detectada:', err, 'Process');
});

// Cierre elegante (Graceful Shutdown)
const shutdown = async () => {
  Logger.log('Iniciando cierre seguro de J.A.R.V.I.S Security y Dashboard API...', 'Process');
  await apiServer.stop();
  rateLimiter.destroy();
  db.close();
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Iniciar simultáneamente el bot de Discord y el Web Dashboard con API REST
async function bootstrap() {
  try {
    await apiServer.start();
    await client.start();
  } catch (err) {
    Logger.error('Error crítico al iniciar J.A.R.V.I.S Security:', err, 'Bootstrap');
  }
}

bootstrap();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { JarvisSecurityClient } from '../core/client.js';
import { config } from '../config/config.js';
import { Logger } from '../utils/logger.js';
import { createAuthRouter } from './routes/auth.js';
import { createGuildsRouter } from './routes/guilds.js';
import { createStatsRouter } from './routes/stats.js';

export class ApiServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private client: JarvisSecurityClient;

  constructor(client: JarvisSecurityClient) {
    this.client = client;
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(cors({ origin: true, credentials: true }));
    this.app.use(cookieParser());
    this.app.use(express.json());
  }

  private configureRoutes(): void {
    // 1. Rutas de la API REST
    this.app.use('/api/auth', createAuthRouter(this.client));
    this.app.use('/api/guilds', createGuildsRouter(this.client));
    this.app.use('/api/stats', createStatsRouter(this.client));

    // 2. Servir el Dashboard Frontend estático
    let staticDir = path.join(process.cwd(), 'src', 'dashboard', 'public');
    if (!fs.existsSync(staticDir)) {
      staticDir = path.join(process.cwd(), 'dashboard', 'public');
    }

    this.app.use(express.static(staticDir));

    // SPA Fallback para cualquier ruta web no coincidente
    this.app.get(/^(?!\/api).*/, (req, res) => {
      const indexPath = path.join(staticDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Dashboard en construcción o archivos estáticos no encontrados.');
      }
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      const port = config.port;
      this.server = this.app.listen(port, () => {
        Logger.log(`🌐 Web Dashboard & REST API en línea en http://localhost:${port}`, 'ApiServer');
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          Logger.log('Servidor Web Dashboard detenido.', 'ApiServer');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

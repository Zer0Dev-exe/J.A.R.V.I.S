import { Router } from 'express';
import { JarvisSecurityClient } from '../../core/client.js';
import { version as djsVersion } from 'discord.js';
import os from 'os';

export function createStatsRouter(client: JarvisSecurityClient): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    res.json({
      success: true,
      bot: {
        tag: client.user?.tag || 'J.A.R.V.I.S Security',
        avatar: client.user?.displayAvatarURL() || null,
        id: client.user?.id || '',
      },
      telemetry: {
        uptimeSeconds,
        wsPing: client.ws.ping,
        totalGuilds,
        totalUsers,
        nodeVersion: process.version,
        discordJsVersion: djsVersion,
        platform: `${os.platform()} (${os.arch()})`,
        memory: {
          heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMb: +(mem.heapTotal / 1024 / 1024).toFixed(2),
          rssMb: +(mem.rss / 1024 / 1024).toFixed(2),
        },
        engine: {
          name: 'Sliding Window Token Bucket',
          latency: '< 0.04 ms',
          database: 'Better-SQLite3 (WAL Mode)',
        },
      },
    });
  });

  return router;
}

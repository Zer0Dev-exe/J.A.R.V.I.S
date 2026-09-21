import { Request, Response, Router } from 'express';
import { JarvisSecurityClient } from '../../core/client.js';
import { getSession } from './auth.js';
import { db } from '../../database/db.js';
import { WhitelistManager } from '../../modules/whitelist/whitelistManager.js';
import { RaidDetector } from '../../modules/antiraid/raidDetector.js';
import { config } from '../../config/config.js';
import { ChannelType } from 'discord.js';

export function createGuildsRouter(client: JarvisSecurityClient): Router {
  const router = Router();

  // Middleware de autenticación
  const requireAuth = (req: Request, res: Response, next: () => void): void => {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión primero.' });
      return;
    }
    (req as any).userSession = session;
    next();
  };

  // Helper para verificar si el usuario tiene permisos de administración sobre la guild
  const canManageGuild = (session: any, guildId: string): boolean => {
    // Si es desarrollador global del bot
    if (client.isBotDeveloper(session.userId)) return true;

    // Buscar en los servidores del usuario
    const userGuild = session.guilds?.find((g: any) => g.id === guildId);
    if (!userGuild) return false;

    if (userGuild.owner) return true;

    try {
      const perms = BigInt(userGuild.permissions || '0');
      const ADMIN = 0x8n;
      const MANAGE_GUILD = 0x20n;
      return (perms & ADMIN) === ADMIN || (perms & MANAGE_GUILD) === MANAGE_GUILD;
    } catch {
      return false;
    }
  };

  // 1. Listar todos los servidores administrables por el usuario
  router.get('/', requireAuth, (req: Request, res: Response) => {
    const session = (req as any).userSession;
    const userGuilds = session.guilds || [];

    const manageable = userGuilds.filter((ug: any) => {
      if (ug.owner) return true;
      try {
        const perms = BigInt(ug.permissions || '0');
        return (perms & 0x8n) === 0x8n || (perms & 0x20n) === 0x20n;
      } catch {
        return false;
      }
    });

    const enriched = manageable.map((ug: any) => {
      const botGuild = client.guilds.cache.get(ug.id);
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${ug.id}`;

      return {
        id: ug.id,
        name: ug.name,
        icon: ug.icon
          ? `https://cdn.discordapp.com/icons/${ug.id}/${ug.icon}.png`
          : null,
        owner: ug.owner,
        hasBot: !!botGuild,
        memberCount: botGuild?.memberCount || null,
        inviteUrl,
      };
    });

    res.json({ success: true, guilds: enriched });
  });

  // 2. Obtener ajustes y metadatos de un servidor específico
  router.get('/:guildId/settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const guildId = req.params.guildId as string;
    const session = (req as any).userSession;

    if (!canManageGuild(session, guildId)) {
      res.status(403).json({ error: 'No tienes permisos de administrador en este servidor.' });
      return;
    }

    const botGuild = client.guilds.cache.get(guildId);
    if (!botGuild) {
      res.status(404).json({ error: 'El bot no se encuentra en este servidor.' });
      return;
    }

    const settings = db.getGuildSettings(guildId);
    const isLockedDown = RaidDetector.isLockedDown(guildId);

    // Obtener canales de texto y roles para selectors en la UI
    const channels = botGuild.channels.cache
      .filter((c) => c.type === ChannelType.GuildText)
      .map((c) => ({ id: c.id, name: c.name }));

    const botHighestRole = botGuild.members.me?.roles.highest.position || 0;
    const roles = botGuild.roles.cache
      .filter((r) => r.id !== guildId && r.position < botHighestRole)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

    res.json({
      success: true,
      guild: {
        id: botGuild.id,
        name: botGuild.name,
        icon: botGuild.iconURL(),
        memberCount: botGuild.memberCount,
        ownerId: botGuild.ownerId,
        isLockedDown,
      },
      settings,
      channels,
      roles,
    });
  });

  // 3. Actualizar configuración de seguridad
  router.patch('/:guildId/settings', requireAuth, (req: Request, res: Response) => {
    const guildId = req.params.guildId as string;
    const session = (req as any).userSession;

    if (!canManageGuild(session, guildId)) {
      res.status(403).json({ error: 'No tienes permisos de administrador en este servidor.' });
      return;
    }

    const updates = req.body;
    db.updateGuildSettings(guildId, updates);
    const updatedSettings = db.getGuildSettings(guildId);

    res.json({ success: true, message: 'Configuración actualizada correctamente', settings: updatedSettings });
  });

  // 4. Lista Blanca (Whitelist)
  router.get('/:guildId/whitelist', requireAuth, (req: Request, res: Response) => {
    const guildId = req.params.guildId as string;
    const session = (req as any).userSession;

    if (!canManageGuild(session, guildId)) {
      res.status(403).json({ error: 'Acceso denegado.' });
      return;
    }

    const list = db.getWhitelist(guildId);
    res.json({ success: true, whitelist: list });
  });

  // Añadir usuario a Whitelist (exclusivo para el dueño o dev del bot)
  router.post('/:guildId/whitelist', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const guildId = req.params.guildId as string;
    const session = (req as any).userSession;

    const botGuild = client.guilds.cache.get(guildId);
    if (!botGuild) {
      res.status(404).json({ error: 'Servidor no encontrado' });
      return;
    }

    const isServerOwner = botGuild.ownerId === session.userId;
    const isBotDev = client.isBotDeveloper(session.userId);

    if (!isServerOwner && !isBotDev) {
      res.status(403).json({ error: 'Únicamente el Dueño del Servidor puede alterar la Whitelist.' });
      return;
    }

    const { userId, type } = req.body;
    if (!userId || !type) {
      res.status(400).json({ error: 'userId y type son requeridos' });
      return;
    }

    WhitelistManager.add(guildId, userId, type, session.userId);
    res.json({ success: true, message: 'Usuario añadido a la whitelist' });
  });

  // Eliminar usuario de Whitelist
  router.delete('/:guildId/whitelist/:userId', requireAuth, (req: Request, res: Response) => {
    const guildId = req.params.guildId as string;
    const userId = req.params.userId as string;
    const session = (req as any).userSession;

    const botGuild = client.guilds.cache.get(guildId);
    if (!botGuild) {
      res.status(404).json({ error: 'Servidor no encontrado' });
      return;
    }

    const isServerOwner = botGuild.ownerId === session.userId;
    const isBotDev = client.isBotDeveloper(session.userId);

    if (!isServerOwner && !isBotDev) {
      res.status(403).json({ error: 'Únicamente el Dueño del Servidor puede alterar la Whitelist.' });
      return;
    }

    const removed = WhitelistManager.remove(guildId, userId);
    res.json({ success: removed, message: removed ? 'Inmunidad revocada' : 'El usuario no estaba en la whitelist' });
  });

  // 5. Historial de Incidentes y Logs
  router.get('/:guildId/logs', requireAuth, (req: Request, res: Response) => {
    const guildId = req.params.guildId as string;
    const session = (req as any).userSession;

    if (!canManageGuild(session, guildId)) {
      res.status(403).json({ error: 'Acceso denegado.' });
      return;
    }

    const limit = parseInt(req.query.limit as string || '50', 10);
    const logs = db.getRecentSecurityLogs(guildId, limit);
    res.json({ success: true, logs });
  });

  // 6. Activar o desactivar Lockdown de emergencia
  router.post('/:guildId/lockdown', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const guildId = req.params.guildId as string;
    const session = (req as any).userSession;

    if (!canManageGuild(session, guildId)) {
      res.status(403).json({ error: 'Acceso denegado.' });
      return;
    }

    const botGuild = client.guilds.cache.get(guildId);
    if (!botGuild) {
      res.status(404).json({ error: 'Servidor no encontrado' });
      return;
    }

    const { enable, reason } = req.body;

    if (enable) {
      const count = await RaidDetector.enableLockdown(botGuild, reason || `Activado desde el Dashboard Web por ${session.username}`);
      res.json({ success: true, isLockedDown: true, affectedChannels: count });
    } else {
      const count = await RaidDetector.disableLockdown(botGuild);
      res.json({ success: true, isLockedDown: false, affectedChannels: count });
    }
  });

  return router;
}

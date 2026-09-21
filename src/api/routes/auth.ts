import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { config } from '../../config/config.js';
import { JarvisSecurityClient } from '../../core/client.js';
import { Logger } from '../../utils/logger.js';

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface UserSession {
  userId: string;
  username: string;
  avatar: string | null;
  accessToken: string;
  guilds: UserGuild[];
  expiresAt: number;
}

export const sessionStore = new Map<string, UserSession>();

export function getSession(req: Request): UserSession | null {
  const token = req.cookies?.jarvis_session;
  if (!token) return null;

  const session = sessionStore.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

export function createAuthRouter(client: JarvisSecurityClient): Router {
  const router = Router();

  // Endpoint para iniciar el flujo de autenticación OAuth2 de Discord
  router.get('/login', (req: Request, res: Response) => {
    if (!config.clientId) {
      res.status(500).json({ error: 'CLIENT_ID no configurado en el archivo .env' });
      return;
    }

    if (!config.clientSecret) {
      // Si el usuario aún no configuró CLIENT_SECRET en .env, redirigir con flag para modo demostración / dev
      res.redirect('/?oauth_notice=missing_secret');
      return;
    }

    const redirectUri = encodeURIComponent(`${config.dashboardUrl}/api/auth/callback`);
    const scopes = encodeURIComponent('identify guilds');
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

    res.redirect(discordAuthUrl);
  });

  // Callback de OAuth2 que recibe el código de Discord
  router.get('/callback', async (req: Request, res: Response): Promise<void> => {
    const code = req.query.code as string;
    if (!code) {
      res.redirect('/?error=missing_code');
      return;
    }

    try {
      // 1. Intercambiar código por Access Token
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${config.dashboardUrl}/api/auth/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        Logger.error('Error al intercambiar token OAuth2 de Discord:', errBody, 'Auth');
        res.redirect('/?error=token_exchange_failed');
        return;
      }

      const tokenData = (await tokenResponse.json()) as { access_token: string };
      const accessToken = tokenData.access_token;

      // 2. Obtener datos del usuario
      const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = (await userRes.json()) as { id: string; username: string; avatar: string | null };

      // 3. Obtener servidores del usuario
      const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userGuilds = guildsRes.ok ? ((await guildsRes.json()) as UserGuild[]) : [];

      // 4. Crear sesión
      const sessionId = crypto.randomBytes(32).toString('hex');
      sessionStore.set(sessionId, {
        userId: userData.id,
        username: userData.username,
        avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
        accessToken,
        guilds: userGuilds,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
      });

      res.cookie('jarvis_session', sessionId, {
        httpOnly: true,
        secure: false, // true en HTTPS de producción
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });

      res.redirect('/');
    } catch (err) {
      Logger.error('Error en el callback OAuth2:', err, 'Auth');
      res.redirect('/?error=oauth_internal_error');
    }
  });

  // Login de prueba / simulación de desarrollo local
  router.post('/dev-login', (req: Request, res: Response) => {
    // Si el usuario no tiene configurado CLIENT_SECRET, le permitimos acceder con rol de administrador en los servidores locales del bot
    const botGuilds = client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL() || null,
      owner: true,
      permissions: '8', // Administrador
    }));

    const devUserId = '000000000000000000';
    client.botOwnerIds.add(devUserId);

    const sessionId = crypto.randomBytes(32).toString('hex');
    sessionStore.set(sessionId, {
      userId: devUserId,
      username: 'Operador J.A.R.V.I.S (Dev)',
      avatar: client.user?.displayAvatarURL() || null,
      accessToken: 'dev_token',
      guilds: botGuilds,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.cookie('jarvis_session', sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({ success: true, message: 'Sesión local de desarrollo iniciada' });
  });

  // Datos del usuario logueado actualmente
  router.get('/me', (req: Request, res: Response) => {
    const session = getSession(req);
    res.json({
      authenticated: !!session,
      hasClientSecret: Boolean(config.clientSecret),
      user: session
        ? {
            id: session.userId,
            username: session.username,
            avatar: session.avatar,
          }
        : null,
    });
  });

  // Cerrar sesión
  router.post('/logout', (req: Request, res: Response) => {
    const token = req.cookies?.jarvis_session;
    if (token) {
      sessionStore.delete(token);
    }
    res.clearCookie('jarvis_session');
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  });

  return router;
}

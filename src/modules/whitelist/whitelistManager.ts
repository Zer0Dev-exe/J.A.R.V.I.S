import { Guild } from 'discord.js';
import { db } from '../../database/db.js';

export class WhitelistManager {
  /**
   * Comprueba si un usuario es inmune a las restricciones de seguridad.
   * La comprobación es 100% multiguild y dinámica:
   * 1. Dueño dinámico del servidor actual (guild.ownerId - cambia automáticamente en cada servidor)
   * 2. Desarrolladores / Dueños de la aplicación de Discord (resueltos dinámicamente por la API)
   * 3. El propio bot (guild.client.user.id)
   * 4. Whitelist en base de datos SQLite específica para este guild_id
   */
  public static isImmune(guild: Guild, userId: string, moduleType?: 'CHANNELS' | 'ROLES' | 'MEMBERS' | 'BOTS' | 'WEBHOOKS'): boolean {
    // 1. Dueño dinámico del servidor actual en Discord
    if (guild.ownerId === userId) {
      return true;
    }

    // 2. El propio cliente del bot
    if (guild.client.user && guild.client.user.id === userId) {
      return true;
    }

    // 3. Desarrolladores globales de la aplicación detectados dinámicamente
    const client = guild.client as any;
    if (typeof client.isBotDeveloper === 'function' && client.isBotDeveloper(userId)) {
      return true;
    }

    // 4. Base de datos SQLite aislada por cada guild
    return db.isWhitelisted(guild.id, userId, moduleType);
  }

  /**
   * Añade un usuario a la lista blanca del servidor.
   */
  public static add(guildId: string, userId: string, type: 'FULL' | 'CHANNELS' | 'ROLES' | 'MEMBERS' | 'BOTS' | 'WEBHOOKS', addedBy: string): void {
    db.addWhitelist(guildId, userId, type, addedBy);
  }

  /**
   * Elimina un usuario de la lista blanca del servidor.
   */
  public static remove(guildId: string, userId: string, type?: string): boolean {
    return db.removeWhitelist(guildId, userId, type);
  }

  /**
   * Lista todos los registros de whitelist de una guild.
   */
  public static list(guildId: string) {
    return db.getWhitelist(guildId);
  }
}

import { Guild, PermissionFlagsBits, TextChannel } from 'discord.js';
import { Logger } from '../../utils/logger.js';

export class RaidDetector {
  private static activeLockdowns: Set<string> = new Set();

  public static isLockedDown(guildId: string): boolean {
    return this.activeLockdowns.has(guildId);
  }

  /**
   * Bloquea todos los canales de texto impidiendo que @everyone envíe mensajes.
   */
  public static async enableLockdown(guild: Guild, reason: string = 'Ataque de raid masivo detectado'): Promise<number> {
    this.activeLockdowns.add(guild.id);
    let lockedCount = 0;

    try {
      const channels = await guild.channels.fetch();
      for (const [, channel] of channels) {
        if (channel && channel instanceof TextChannel) {
          await channel.permissionOverwrites.edit(guild.id, {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
          }, { reason: `[J.A.R.V.I.S LOCKDOWN] ${reason}` }).catch(() => null);
          lockedCount++;
        }
      }

      Logger.warn(`Modo LOCKDOWN activado en ${guild.name}. ${lockedCount} canales asegurados.`, 'RaidDetector');
    } catch (err) {
      Logger.error(`Error al activar lockdown en ${guild.name}:`, err, 'RaidDetector');
    }

    return lockedCount;
  }

  /**
   * Desbloquea los canales de texto restaurando los permisos estándar para @everyone.
   */
  public static async disableLockdown(guild: Guild): Promise<number> {
    this.activeLockdowns.delete(guild.id);
    let unlockedCount = 0;

    try {
      const channels = await guild.channels.fetch();
      for (const [, channel] of channels) {
        if (channel && channel instanceof TextChannel) {
          await channel.permissionOverwrites.edit(guild.id, {
            SendMessages: null,
            AddReactions: null,
            CreatePublicThreads: null,
            CreatePrivateThreads: null,
          }, { reason: '[J.A.R.V.I.S LOCKDOWN] Fin de la alerta de raid - Servidor normalizado' }).catch(() => null);
          unlockedCount++;
        }
      }

      Logger.log(`Modo LOCKDOWN desactivado en ${guild.name}. ${unlockedCount} canales restaurados.`, 'RaidDetector');
    } catch (err) {
      Logger.error(`Error al desactivar lockdown en ${guild.name}:`, err, 'RaidDetector');
    }

    return unlockedCount;
  }
}

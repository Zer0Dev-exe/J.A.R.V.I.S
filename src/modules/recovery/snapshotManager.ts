import {
  ChannelType,
  Guild,
  GuildChannel,
  NonThreadGuildBasedChannel,
  OverwriteResolvable,
  PermissionOverwrites,
} from 'discord.js';
import { db, ChannelBackupEntry } from '../../database/db.js';
import { Logger } from '../../utils/logger.js';

export class SnapshotManager {
  /**
   * Guarda o actualiza el backup de un canal en la base de datos SQLite.
   */
  public static async backupChannel(channel: GuildChannel): Promise<void> {
    try {
      if (!channel.guild) return;

      const overwrites = channel.permissionOverwrites.cache.map((ow) => ({
        id: ow.id,
        type: ow.type,
        allow: ow.allow.bitfield.toString(),
        deny: ow.deny.bitfield.toString(),
      }));

      const backup: ChannelBackupEntry = {
        guild_id: channel.guild.id,
        channel_id: channel.id,
        name: channel.name,
        type: channel.type,
        parent_id: channel.parentId,
        position: channel.rawPosition,
        topic: 'topic' in channel ? (channel.topic as string) || null : null,
        nsfw: 'nsfw' in channel ? (channel.nsfw ? 1 : 0) : 0,
        rate_limit_per_user: 'rateLimitPerUser' in channel ? (channel.rateLimitPerUser as number) || 0 : 0,
        permission_overwrites: JSON.stringify(overwrites),
        updated_at: Date.now(),
      };

      db.saveChannelBackup(backup);
    } catch (err) {
      Logger.warn(`Error al respaldar canal ${channel.name}: ${err}`, 'SnapshotManager');
    }
  }

  /**
   * Toma un snapshot completo de todos los canales del servidor.
   */
  public static async backupGuildChannels(guild: Guild): Promise<number> {
    let count = 0;
    const channels = await guild.channels.fetch();
    for (const [, channel] of channels) {
      if (channel && channel instanceof GuildChannel) {
        await this.backupChannel(channel);
        count++;
      }
    }
    Logger.log(`Respaldados ${count} canales en ${guild.name}`, 'SnapshotManager');
    return count;
  }

  /**
   * Reconstruye y restaura un canal eliminado utilizando los datos almacenados en SQLite.
   */
  public static async restoreDeletedChannel(guild: Guild, channelId: string): Promise<NonThreadGuildBasedChannel | null> {
    try {
      const backup = db.getChannelBackup(guild.id, channelId);
      if (!backup) {
        Logger.warn(`No se encontró backup para el canal eliminado ${channelId}`, 'SnapshotManager');
        return null;
      }

      let parsedOverwrites: OverwriteResolvable[] = [];
      if (backup.permission_overwrites) {
        try {
          const raw = JSON.parse(backup.permission_overwrites);
          parsedOverwrites = raw.map((ow: any) => ({
            id: ow.id,
            type: ow.type,
            allow: BigInt(ow.allow),
            deny: BigInt(ow.deny),
          }));
        } catch (e) {
          Logger.error(`Error al parsear permisos de backup del canal:`, e, 'SnapshotManager');
        }
      }

      const createdChannel = await guild.channels.create({
        name: backup.name,
        type: backup.type as any,
        parent: backup.parent_id || undefined,
        position: backup.position,
        topic: backup.topic || undefined,
        nsfw: backup.nsfw === 1,
        rateLimitPerUser: backup.rate_limit_per_user,
        permissionOverwrites: parsedOverwrites,
        reason: '[J.A.R.V.I.S SECURITY] Auto-restauración de canal destruido por ataque',
      });

      // Actualizar el nuevo ID en el backup para futuras referencias
      db.removeChannelBackup(guild.id, channelId);
      await this.backupChannel(createdChannel);

      Logger.log(`Canal #${backup.name} restaurado con éxito en ${guild.name}`, 'SnapshotManager');
      return createdChannel;
    } catch (err) {
      Logger.error(`Fallo al auto-restaurar canal ${channelId}:`, err, 'SnapshotManager');
      return null;
    }
  }
}

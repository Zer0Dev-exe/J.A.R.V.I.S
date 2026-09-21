import { AuditLogEvent, Guild, GuildAuditLogsEntry, User } from 'discord.js';
import { Logger } from './logger.js';

export class AuditLogHelper {
  private static processedLogIds: Set<string> = new Set();

  /**
   * Intenta resolver de forma fiable y rápida quién ejecutó una acción consultando los Audit Logs.
   * Cuenta con reintentos con intervalo para esperar la propagación de Discord (100-300ms).
   */
  public static async fetchExecutor(
    guild: Guild,
    actionType: AuditLogEvent,
    targetId?: string,
    maxRetries: number = 3,
    delayMs: number = 200
  ): Promise<User | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const logs = await guild.fetchAuditLogs({
          limit: 5,
          type: actionType,
        });

        const now = Date.now();
        const entry = logs.entries.find((e) => {
          // No debe haber sido procesado ya
          if (this.processedLogIds.has(e.id)) return false;

          // Debe haber ocurrido en los últimos 10 segundos
          const logAge = now - e.createdTimestamp;
          if (logAge > 10_000) return false;

          // Si se especificó un targetId, verificar coincidencia
          if (targetId && e.targetId && e.targetId !== targetId) {
            return false;
          }

          return true;
        });

        if (entry && entry.executor) {
          this.markProcessed(entry.id);
          const executor = entry.executor.partial
            ? await entry.executor.fetch().catch(() => entry.executor as User)
            : (entry.executor as User);
          return executor;
        }
      } catch (err) {
        Logger.warn(`Error al obtener Audit Logs en intento ${attempt + 1}: ${err}`, 'AuditLogHelper');
      }

      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    return null;
  }

  private static markProcessed(logId: string): void {
    this.processedLogIds.add(logId);
    // Limpieza automática tras 60 segundos
    setTimeout(() => {
      this.processedLogIds.delete(logId);
    }, 60_000);
  }
}

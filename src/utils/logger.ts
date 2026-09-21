import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { db, SecurityLogEntry } from '../database/db.js';

export class Logger {
  public static log(message: string, context?: string): void {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}] ` : '';
    console.log(`\x1b[36m[${timestamp}]\x1b[0m \x1b[32m[INFO]\x1b[0m ${ctx}${message}`);
  }

  public static warn(message: string, context?: string): void {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}] ` : '';
    console.warn(`\x1b[36m[${timestamp}]\x1b[0m \x1b[33m[WARN]\x1b[0m ${ctx}${message}`);
  }

  public static error(message: string, error?: unknown, context?: string): void {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}] ` : '';
    console.error(`\x1b[36m[${timestamp}]\x1b[0m \x1b[31m[ERROR]\x1b[0m ${ctx}${message}`, error || '');
  }

  public static async dispatchSecurityAlert(
    guild: Guild,
    options: {
      module: string;
      action: string;
      userId: string;
      userTag?: string;
      penaltyApplied: string;
      reason: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      details?: { name: string; value: string; inline?: boolean }[];
    }
  ): Promise<void> {
    const settings = db.getGuildSettings(guild.id);

    // Registrar en base de datos SQLite
    const logEntry: SecurityLogEntry = {
      guild_id: guild.id,
      user_id: options.userId,
      module: options.module,
      action: options.action,
      details: options.reason,
      penalty_applied: options.penaltyApplied,
      timestamp: Date.now(),
    };
    db.logSecurityAction(logEntry);

    // Enviar al canal de alertas de seguridad si está configurado
    if (!settings.alert_channel_id) return;

    try {
      const channel = await guild.channels.fetch(settings.alert_channel_id).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const colors: Record<string, number> = {
        CRITICAL: 0xed4245, // Rojo Discord
        HIGH: 0xe67e22,     // Naranja intenso
        MEDIUM: 0xfee75c,   // Amarillo
        LOW: 0x5865f2,      // Azul Blurple
      };

      const embed = new EmbedBuilder()
        .setColor(colors[options.severity] || 0xed4245)
        .setTitle(`🛡️ [ALERTA DE SEGURIDAD] - Módulo ${options.module}`)
        .setDescription(`Se ha detectado una amenaza y se ha mitigado automáticamente.`)
        .addFields(
          { name: '👤 Agresor / Usuario', value: `<@${options.userId}> (\`${options.userId}\`${options.userTag ? ` - ${options.userTag}` : ''})`, inline: true },
          { name: '⚡ Acción Detectada', value: `\`${options.action}\``, inline: true },
          { name: '🔨 Penalización', value: `**${options.penaltyApplied}**`, inline: true },
          { name: '🚨 Severidad', value: `\`${options.severity}\``, inline: true },
          { name: '📋 Motivo', value: options.reason, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'J.A.R.V.I.S Security Shield' });

      if (options.details) {
        embed.addFields(options.details);
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      Logger.error(`Error al despachar alerta de seguridad en la guild ${guild.id}:`, err, 'Logger');
    }
  }
}

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  version as djsVersion,
} from 'discord.js';
import os from 'os';
import { Command } from './types.js';
import { db } from '../database/db.js';

export const statsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Muestra el HUD holográfico y la telemetría del sistema en tiempo real'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client;
    const guild = interaction.guild;

    // Calcular Uptime
    const uptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;

    // Métricas de Memoria y CPU
    const memUsage = process.memoryUsage();
    const heapUsedMb = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMb = (memUsage.heapTotal / 1024 / 1024).toFixed(1);
    const rssMb = (memUsage.rss / 1024 / 1024).toFixed(1);

    // Latencia
    const wsPing = client.ws.ping;
    const sentTime = Date.now();
    await interaction.deferReply();
    const restPing = Date.now() - sentTime;

    // Conteo de miembros y servidores
    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    // Amenazas neutralizadas en este servidor
    let localThreats = 0;
    let serverSettingsInfo = 'No disponible';
    if (guild) {
      const logs = db.getRecentSecurityLogs(guild.id, 100);
      localThreats = logs.length;
      const settings = db.getGuildSettings(guild.id);
      serverSettingsInfo = [
        `• Anti-Nuke: ${settings.antinuke_enabled ? '🟢 **ONLINE**' : '🔴 OFFLINE'}`,
        `• Anti-Raid: ${settings.antiraid_enabled ? '🟢 **ONLINE**' : '🔴 OFFLINE'}`,
        `• Anti-Scam: ${settings.antiscam_enabled ? '🟢 **ONLINE**' : '🔴 OFFLINE'}`,
      ].join('\n');
    }

    const embed = new EmbedBuilder()
      .setColor(0x00f0ff) // Cyan Neón Cibernético
      .setTitle('⚡ J.A.R.V.I.S CYBER-DEFENSE HUD • DIAGNÓSTICO DEL SISTEMA')
      .setDescription(
        '```ansi\n' +
        '\u001b[1;36m[SISTEMA OPERATIVO]:\u001b[0m \u001b[1;32mÓPTIMO (100%)\u001b[0m\n' +
        '\u001b[1;36m[ESCUDO CENTINELA]:\u001b[0m \u001b[1;32mPROTECCIÓN ACTIVA V1.0\u001b[0m\n' +
        '\u001b[1;36m[MOTOR EN MEMORIA]:\u001b[0m \u001b[1;33mSLIDING WINDOW < 0.04 ms\u001b[0m\n' +
        '```'
      )
      .addFields(
        {
          name: '📡 Telemetría de Red & Latencia',
          value: [
            `• **WebSocket Gateway:** \`${wsPing >= 0 ? `${wsPing} ms` : 'Conectando...'}\``,
            `• **API Roundtrip (REST):** \`${restPing} ms\``,
            `• **Tiempo en Línea (Uptime):** \`${uptimeFormatted}\``,
            `• **Plataforma Host:** \`${os.platform()} (${os.arch()})\``,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🧠 Consumo de Recursos',
          value: [
            `• **Heap RAM:** \`${heapUsedMb} MB\` / \`${heapTotalMb} MB\``,
            `• **Memoria RSS:** \`${rssMb} MB\``,
            `• **Node.js:** \`${process.version}\``,
            `• **Discord.js:** \`v${djsVersion}\``,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🌐 Cobertura Global de Defensa',
          value: [
            `• **Servidores Vigilados:** \`${totalGuilds.toLocaleString()}\``,
            `• **Usuarios Protegidos:** \`${totalUsers.toLocaleString()}\``,
            `• **Base de Datos:** \`SQLite (WAL Mode) Ultra-Fast\``,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛡️ Estado de Escudos en este Servidor',
          value: serverSettingsInfo,
          inline: true,
        },
        {
          name: '🎯 Amenazas Neutralizadas Aquí',
          value: `\`${localThreats}\` incidentes mitigados automáticamente`,
          inline: true,
        }
      )
      .setThumbnail(client.user?.displayAvatarURL() || null)
      .setFooter({
        text: `J.A.R.V.I.S Security Shield • Solicitado por ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

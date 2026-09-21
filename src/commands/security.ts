import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { db } from '../database/db.js';

export const securityCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Panel de control y configuración general de J.A.R.V.I.S Security')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Muestra el estado en tiempo real de todos los escudos de seguridad')
    )
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configura los canales y roles clave de seguridad')
        .addChannelOption((opt) =>
          opt
            .setName('canal_alertas')
            .setDescription('Canal de texto donde se enviarán los avisos de incidentes')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('rol_cuarentena')
            .setDescription('Rol asignado a usuarios aislados o maliciosos')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('logs')
        .setDescription('Muestra las últimas intervenciones y alertas de seguridad registradas')
        .addIntegerOption((opt) =>
          opt
            .setName('cantidad')
            .setDescription('Número de registros a mostrar (máx. 10)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'Este comando solo puede ejecutarse en un servidor.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const settings = db.getGuildSettings(guild.id);

    if (subcommand === 'status') {
      const whitelist = db.getWhitelist(guild.id);

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Panel de Seguridad J.A.R.V.I.S')
        .setDescription('Estado global de los módulos de defensa activa.')
        .setColor(0x5865f2)
        .addFields(
          {
            name: '💣 Anti-Nuke',
            value: [
              `• **Estado:** ${settings.antinuke_enabled ? '🟢 Activo' : '🔴 Inactivo'}`,
              `• **Ventana temporal:** \`${settings.limit_window_seconds}s\``,
              `• **Límite Borrar Canales:** \`${settings.channel_delete_limit}\``,
              `• **Límite Crear Canales:** \`${settings.channel_create_limit}\``,
              `• **Límite Borrar Roles:** \`${settings.role_delete_limit}\``,
              `• **Límite Crear Roles:** \`${settings.role_create_limit}\``,
              `• **Límite Baneos:** \`${settings.ban_limit}\``,
              `• **Límite Expulsiones:** \`${settings.kick_limit}\``,
              `• **Límite Webhooks:** \`${settings.webhook_limit}\``,
              `• **Penalización predeterminada:** \`${settings.default_penalty}\``,
              `• **Anti-Bot no autorizado:** ${settings.anti_bot_enabled ? '✅ Sí' : '❌ No'}`,
              `• **Auto-recuperación de canales:** ${settings.auto_recovery_enabled ? '✅ Sí' : '❌ No'}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🚨 Anti-Raid',
            value: [
              `• **Estado:** ${settings.antiraid_enabled ? '🟢 Activo' : '🔴 Inactivo'}`,
              `• **Join Burst:** \`${settings.join_burst_limit}\` entradas en \`${settings.join_burst_window_seconds}s\``,
              `• **Antigüedad mínima de cuenta:** \`${settings.min_account_age_days} días\``,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🎣 Anti-Scam & Phishing',
            value: [
              `• **Estado:** ${settings.antiscam_enabled ? '🟢 Activo' : '🔴 Inactivo'}`,
              `• **Filtro Enlaces Phishing:** ${settings.anti_links_enabled ? '✅' : '❌'}`,
              `• **Bloqueo Invitaciones:** ${settings.anti_invites_enabled ? '✅' : '❌'}`,
              `• **Protección Anti-Flood:** ${settings.anti_spam_enabled ? '✅' : '❌'}`,
              `• **Máx Menciones:** \`${settings.max_mentions}\``,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚙️ Infraestructura',
            value: [
              `• **Canal de Alertas:** ${settings.alert_channel_id ? `<#${settings.alert_channel_id}>` : '⚠️ *No asignado*'}`,
              `• **Rol de Cuarentena:** ${settings.quarantine_role_id ? `<@&${settings.quarantine_role_id}>` : '⚠️ *No asignado*'}`,
              `• **Usuarios en Whitelist:** \`${whitelist.length}\``,
            ].join('\n'),
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: 'J.A.R.V.I.S Security • Ultra-Fast Shield' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'setup') {
      const alertChannel = interaction.options.getChannel('canal_alertas');
      const quarantineRole = interaction.options.getRole('rol_cuarentena');

      const updates: any = {};
      const changes: string[] = [];

      if (alertChannel) {
        updates.alert_channel_id = alertChannel.id;
        changes.push(`• Canal de alertas configurado en <#${alertChannel.id}>`);
      }

      if (quarantineRole) {
        updates.quarantine_role_id = quarantineRole.id;
        changes.push(`• Rol de cuarentena configurado en <@&${quarantineRole.id}>`);
      }

      if (changes.length === 0) {
        await interaction.reply({
          content: 'No especificaste ningún ajuste a cambiar. Usa las opciones `canal_alertas` o `rol_cuarentena`.',
          ephemeral: true,
        });
        return;
      }

      db.updateGuildSettings(guild.id, updates);

      const embed = new EmbedBuilder()
        .setTitle('✅ Configuración Actualizada')
        .setColor(0x57f287)
        .setDescription(changes.join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'logs') {
      const limit = interaction.options.getInteger('cantidad') || 5;
      const logs = db.getRecentSecurityLogs(guild.id, limit);

      if (logs.length === 0) {
        await interaction.reply({ content: 'No hay incidentes de seguridad registrados recientemente.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Últimos ${logs.length} Registros de Seguridad`)
        .setColor(0xfee75c)
        .setDescription(
          logs
            .map(
              (l, idx) =>
                `**${idx + 1}. [${new Date(l.timestamp).toLocaleTimeString()}]** <@${l.user_id}> | **${l.action}**\n` +
                `   ↳ *Módulo:* \`${l.module}\` | *Sanción:* \`${l.penalty_applied}\`\n` +
                `   ↳ *Detalle:* ${l.details}`
            )
            .join('\n\n')
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

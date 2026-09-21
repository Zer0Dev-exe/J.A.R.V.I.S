import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { db } from '../database/db.js';

export const antiraidCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configura y calibra la protección Anti-Raid de J.A.R.V.I.S')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Activa o desactiva la protección Anti-Raid')
        .addBooleanOption((opt) =>
          opt.setName('activado').setDescription('¿Activar módulo Anti-Raid?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Ajusta la sensibilidad ante raids masivos')
        .addIntegerOption((opt) =>
          opt
            .setName('limite_burst')
            .setDescription('Máximo de miembros permitidos en ráfaga antes de activar defensa')
            .setMinValue(2)
            .setMaxValue(50)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('segundos_burst')
            .setDescription('Ventana en segundos para medir la ráfaga de entradas')
            .setMinValue(2)
            .setMaxValue(30)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('dias_cuenta')
            .setDescription('Días mínimos de antigüedad que debe tener la cuenta para entrar (0 para desactivar)')
            .setMinValue(0)
            .setMaxValue(60)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('activado', true);
      db.updateGuildSettings(guild.id, { antiraid_enabled: enabled ? 1 : 0 });

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x57f287 : 0xed4245)
        .setTitle(`Protección Anti-Raid ${enabled ? 'Activada 🟢' : 'Desactivada 🔴'}`)
        .setDescription(
          enabled
            ? 'El servidor ahora analiza ráfagas de unión simultáneas y filtra cuentas creadas recientemente.'
            : '⚠️ El escudo Anti-Raid ha sido desactivado.'
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'config') {
      const burstLimit = interaction.options.getInteger('limite_burst');
      const burstSeconds = interaction.options.getInteger('segundos_burst');
      const minAge = interaction.options.getInteger('dias_cuenta');

      const updates: any = {};
      const changes: string[] = [];

      if (burstLimit !== null) {
        updates.join_burst_limit = burstLimit;
        changes.push(`• Límite de ráfaga (Join Burst): \`${burstLimit} usuarios\``);
      }
      if (burstSeconds !== null) {
        updates.join_burst_window_seconds = burstSeconds;
        changes.push(`• Ventana de ráfaga: \`${burstSeconds} segundos\``);
      }
      if (minAge !== null) {
        updates.min_account_age_days = minAge;
        changes.push(`• Antigüedad mínima exigida: \`${minAge} días\` ${minAge === 0 ? '(desactivado)' : ''}`);
      }

      if (changes.length === 0) {
        await interaction.reply({ content: 'No indicaste ningún parámetro para configurar.', ephemeral: true });
        return;
      }

      db.updateGuildSettings(guild.id, updates);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('⚙️ Parámetros Anti-Raid Actualizados')
        .setDescription(changes.join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { RaidDetector } from '../modules/antiraid/raidDetector.js';

export const lockdownCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Modo de emergencia: bloquea o desbloquea todos los canales del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Bloquea todos los canales de texto de inmediato impidiendo hablar a @everyone')
        .addStringOption((opt) =>
          opt.setName('motivo').setDescription('Motivo del confinamiento de emergencia')
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Desbloquea los canales restaurando la actividad regular')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'enable') {
      const reason = interaction.options.getString('motivo') || `Activado manualmente por ${interaction.user.tag}`;
      const count = await RaidDetector.enableLockdown(guild, reason);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🚨 MODO LOCKDOWN ACTIVADO')
        .setDescription(
          `Se ha cerrado la comunicación en **${count}** canales de texto del servidor.\n` +
          `• **Motivo:** ${reason}\n` +
          `• **Ejecutado por:** <@${interaction.user.id}>\n\n` +
          `Usa \`/lockdown disable\` una vez que la amenaza haya sido contenida.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'disable') {
      const count = await RaidDetector.disableLockdown(guild);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🟢 MODO LOCKDOWN DESACTIVADO')
        .setDescription(
          `Se ha restaurado la comunicación habitual en **${count}** canales de texto.\n` +
          `El servidor ha vuelto a su operatividad estándar.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

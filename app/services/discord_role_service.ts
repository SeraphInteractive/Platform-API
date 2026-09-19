import env from '#start/env'

export class DiscordRoleService {
  // auto grant a role to a discord user in the guild
  async grantRole(discordUserId: string, roleId?: string): Promise<boolean> {
    const token = env.get('DISCORD_BOT_TOKEN')
    const guildId = env.get('DISCORD_GUILD_ID')
    const targetRoleId = roleId || env.get('DISCORD_CONTRIBUTOR_ROLE_ID') || '1548188314970882150'

    if (!token || !guildId || !discordUserId) {
      // missing bot token or guild config, skip silently
      return false
    }

    try {
      const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${targetRoleId}`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json',
          'X-Audit-Log-Reason': 'Auto-granted role for proposal submission',
        },
      })

      if (response.ok || response.status === 204) {
        return true
      }

      const body = await response.text()
      console.warn(`[DiscordRoleService] Failed to grant role ${targetRoleId} to user ${discordUserId}: ${response.status} ${body}`)
      return false
    } catch (err: any) {
      console.warn(`[DiscordRoleService] Network error granting role: ${err?.message}`)
      return false
    }
  }
}

export const discordRoleService = new DiscordRoleService()
export default discordRoleService

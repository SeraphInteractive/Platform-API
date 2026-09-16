import env from '#start/env'

interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}

interface DiscordEmbed {
  title: string
  description?: string
  color?: number
  fields?: DiscordEmbedField[]
  timestamp?: string
  footer?: { text: string }
}

export class DiscordWebhookService {
  private async postWebhook(webhookUrl: string | undefined, embed: DiscordEmbed): Promise<void> {
    if (!webhookUrl) {
      // skip silently if webhook url is not configured
      return
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              ...embed,
              timestamp: embed.timestamp || new Date().toISOString(),
              footer: embed.footer || { text: 'MCS Production Pipeline' },
            },
          ],
        }),
      })
    } catch {
      // network errors on webhooks should not break core request flow
    }
  }

  async notifyShotClaimed(shotCode: string, difficulty: string, username: string, deadline: string): Promise<void> {
    const supervisorUrl = env.get('DISCORD_SUPERVISOR_WEBHOOK_URL') || env.get('DISCORD_WEBHOOK_URL')
    await this.postWebhook(supervisorUrl, {
      title: `Shot Claimed: ${shotCode}`,
      description: `Contributor ${username} has claimed shot ${shotCode}.`,
      color: 0x3498db, // blue
      fields: [
        { name: 'Difficulty', value: difficulty.toUpperCase(), inline: true },
        { name: 'Deadline', value: deadline, inline: true },
      ],
    })
  }

  async notifyShotExpired(shotCode: string, lastClaimer: string): Promise<void> {
    const supervisorUrl = env.get('DISCORD_SUPERVISOR_WEBHOOK_URL') || env.get('DISCORD_WEBHOOK_URL')
    await this.postWebhook(supervisorUrl, {
      title: `Shot Expired & Reclaimed: ${shotCode}`,
      description: `Deadline passed for ${shotCode}. The shot was unclaimed from ${lastClaimer} and returned to the Grab-Box pool.`,
      color: 0xe74c3c, // red
    })
  }

  async notifySubmissionCreated(
    shotCode: string,
    version: number,
    username: string,
    notes: string | null
  ): Promise<void> {
    const supervisorUrl = env.get('DISCORD_SUPERVISOR_WEBHOOK_URL') || env.get('DISCORD_WEBHOOK_URL')
    await this.postWebhook(supervisorUrl, {
      title: `New Submission: ${shotCode} (v${version})`,
      description: `Contributor ${username} submitted version ${version} for review.`,
      color: 0xf1c40f, // yellow
      fields: notes ? [{ name: 'Contributor Notes', value: notes }] : [],
    })
  }

  async notifySubmissionReviewed(
    shotCode: string,
    version: number,
    status: string,
    supervisorName: string,
    notes: string | null
  ): Promise<void> {
    const isApproved = status === 'approved'
    const publicUrl = env.get('DISCORD_WEBHOOK_URL')
    const supervisorUrl = env.get('DISCORD_SUPERVISOR_WEBHOOK_URL') || publicUrl

    const embed: DiscordEmbed = {
      title: `Review Decision: ${shotCode} (v${version})`,
      description: `Supervisor ${supervisorName} marked this submission as **${status.toUpperCase().replace('_', ' ')}**.`,
      color: isApproved ? 0x2ecc71 : 0xe67e22, // green for approved, orange for revision
      fields: notes ? [{ name: 'Supervisor Notes', value: notes }] : [],
    }

    // notify supervisor channel and public channel if approved
    await this.postWebhook(supervisorUrl, embed)
    if (isApproved && publicUrl && publicUrl !== supervisorUrl) {
      await this.postWebhook(publicUrl, {
        title: `Shot Approved: ${shotCode}`,
        description: `Shot ${shotCode} has been approved and moved to the integrated cut.`,
        color: 0x2ecc71,
      })
    }
  }

  async notifyContributorPromoted(username: string, supervisorName: string): Promise<void> {
    const publicUrl = env.get('DISCORD_WEBHOOK_URL')
    const supervisorUrl = env.get('DISCORD_SUPERVISOR_WEBHOOK_URL') || publicUrl

    const embed: DiscordEmbed = {
      title: `Contributor Promoted: ${username}`,
      description: `Contributor ${username} has been promoted to Senior Contributor by ${supervisorName}.`,
      color: 0x9b59b6, // purple
    }

    await this.postWebhook(supervisorUrl, embed)
    if (publicUrl && publicUrl !== supervisorUrl) {
      await this.postWebhook(publicUrl, embed)
    }
  }

  async notifyRaidAlert(
    roundTitle: string,
    entryTitle: string,
    severity: string,
    entropy: number,
    zScore: number
  ): Promise<void> {
    const supervisorUrl = env.get('DISCORD_SUPERVISOR_WEBHOOK_URL') || env.get('DISCORD_WEBHOOK_URL')
    const isCritical = severity === 'CRITICAL_RAID'
    await this.postWebhook(supervisorUrl, {
      title: `${isCritical ? 'CRITICAL RAID' : 'SUSPICIOUS TELEMETRY'}: ${entryTitle}`,
      description: `Raid anomaly triggered on proposal **${entryTitle}** in round **${roundTitle}**.`,
      color: isCritical ? 0xef4444 : 0xf59e0b,
      fields: [
        { name: 'Severity', value: severity, inline: true },
        { name: 'Entropy H(X)', value: `${entropy.toFixed(3)} bits`, inline: true },
        { name: 'Velocity Sigma', value: `Z = ${zScore.toFixed(2)}`, inline: true },
      ],
    })
  }
}

export const discordWebhookService = new DiscordWebhookService()
export default discordWebhookService

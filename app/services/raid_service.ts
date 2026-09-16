import BallotModel from '#models/ballot'
import Entry from '#models/entry'
import VotingRound from '#models/voting_round'
import RaidTelemetryModel from '#models/raid_telemetry'
import db from '@adonisjs/lucid/services/db'
import { eventBus } from './event_bus.js'
import { discordWebhookService } from './discord_webhook_service.js'
import { analyze_raid_risk, type EntryScoreBreakdown } from '@platform/internal-logic'

export class RaidService {
  async analyzeEntry(entryId: string, roundId: string): Promise<RaidTelemetryModel> {
    // pull all ballots for this round
    const ballots = await BallotModel.query().where('roundId', roundId)

    // tally up scores to build breakdown
    let rank1Count = 0
    let rank2Count = 0
    let rank3Count = 0

    for (const b of ballots) {
      if (b.rank1EntryId === entryId) rank1Count++
      else if (b.rank2EntryId === entryId) rank2Count++
      else if (b.rank3EntryId === entryId) rank3Count++
    }

    const appearanceCount = rank1Count + rank2Count + rank3Count
    const rawScore = rank1Count * 3 + rank2Count * 2 + rank3Count * 1

    const breakdown: EntryScoreBreakdown = {
      entryId,
      rank1Count,
      rank2Count,
      rank3Count,
      appearanceCount,
      rawScore,
    }

    // calculate velocity
    const velocityZScore = await this.computeVelocityZScore(entryId, roundId)

    // let logic run the telemetry checks
    const telemetry = analyze_raid_risk(breakdown, velocityZScore)

    // save telemetry snapshot
    const record = await RaidTelemetryModel.create({
      entryId,
      roundId,
      compositeScore: telemetry.compositeScore,
      severity: telemetry.severity,
      skewRatio: telemetry.skewRatio,
      rankEntropy: telemetry.rankEntropy,
      velocityZScore: telemetry.velocityZScore,
      flags: telemetry.flags,
      breakdown: telemetry.breakdown,
    })

    // quarantine instantly if it looks really bad
    if (telemetry.severity === 'CRITICAL_RAID') {
      const entry = await Entry.find(entryId)
      if (entry) {
        entry.isQuarantined = true
        await entry.save()
      }
    }

    // let the system know about suspect activity
    if (telemetry.severity === 'SUSPICIOUS' || telemetry.severity === 'CRITICAL_RAID') {
      eventBus.emit('raid:alert', {
        entryId,
        roundId,
        severity: telemetry.severity,
        compositeScore: telemetry.compositeScore,
      })

      // Dispatch real-time alert to the supervisor Discord channel
      try {
        const entry = await Entry.find(entryId)
        const round = await VotingRound.find(roundId)
        if (entry && round) {
          await discordWebhookService.notifyRaidAlert(
            round.title,
            entry.title,
            telemetry.severity,
            telemetry.rankEntropy,
            telemetry.velocityZScore
          )
        }
      } catch {
        // notification failure should not block transaction
      }
    }

    return record
  }

  async analyzeAffectedEntries(roundId: string, entryIds: string[]): Promise<void> {
    // process all affected entries one by one
    for (const id of entryIds) {
      await this.analyzeEntry(id, roundId)
    }
  }

  private async computeVelocityZScore(entryId: string, roundId: string): Promise<number> {
    // check volume in the last 5 minutes
    const recentRes = await db.rawQuery(
      `
      SELECT COUNT(*) as count
      FROM ballots
      WHERE round_id = ?
        AND (rank1_entry_id = ? OR rank2_entry_id = ? OR rank3_entry_id = ?)
        AND created_at >= NOW() - INTERVAL '5 minutes'
    `,
      [roundId, entryId, entryId, entryId]
    )
    const recentCount = parseInt(recentRes.rows[0].count, 10) || 0

    // check volume in the last hour to get average
    const hourRes = await db.rawQuery(
      `
      SELECT COUNT(*) as count
      FROM ballots
      WHERE round_id = ?
        AND (rank1_entry_id = ? OR rank2_entry_id = ? OR rank3_entry_id = ?)
        AND created_at >= NOW() - INTERVAL '60 minutes'
    `,
      [roundId, entryId, entryId, entryId]
    )
    const hourCount = parseInt(hourRes.rows[0].count, 10) || 0

    const hourlyAvgPer5Min = hourCount / 12.0

    if (hourlyAvgPer5Min === 0) return 0

    // basic z-score approximation
    return (recentCount - hourlyAvgPer5Min) / Math.max(1, Math.sqrt(hourlyAvgPer5Min))
  }

  async getTelemetry(roundId: string): Promise<RaidTelemetryModel[]> {
    // load latest telemetry records for each entry in the round
    const entries = await Entry.query().where('roundId', roundId)
    const records: RaidTelemetryModel[] = []

    for (const entry of entries) {
      const latest = await RaidTelemetryModel.query()
        .where('roundId', roundId)
        .where('entryId', entry.id)
        .orderBy('createdAt', 'desc')
        .first()

      if (latest) {
        records.push(latest)
      }
    }

    return records
  }

  async getRoundTelemetry(roundId: string): Promise<RaidTelemetryModel[]> {
    return await this.getTelemetry(roundId)
  }

  async getEntryTelemetry(entryId: string, roundId?: string): Promise<RaidTelemetryModel[]> {
    // pull historical records for a specific entry
    const query = RaidTelemetryModel.query().where('entryId', entryId)
    if (roundId) {
      query.where('roundId', roundId)
    }
    return await query.orderBy('createdAt', 'desc')
  }
}

export default RaidService

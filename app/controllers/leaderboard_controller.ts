import { HttpContext } from '@adonisjs/core/http'
import LeaderboardService from '#services/leaderboard_service'
import RoundResult from '#models/round_result'

export default class LeaderboardController {
  async show({ params, response }: HttpContext) {
    const leaderboardService = new LeaderboardService()
    const leaderboard = await leaderboardService.getLiveLeaderboard(params.roundId)
    
    response.header('Cache-Control', 'public, max-age=10, stale-while-revalidate=5')
    return response.ok({ data: leaderboard })
  }

  async finalized({ params, response }: HttpContext) {
    const result = await RoundResult.findByOrFail('roundId', params.roundId)
    response.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    return response.ok({ data: result })
  }
}

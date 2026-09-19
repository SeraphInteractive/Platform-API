import { HttpContext } from '@adonisjs/core/http'
import Entry from '#models/entry'
import VotingRound from '#models/voting_round'
import { createEntryValidator, updateEntryValidator, updateEntryStatusValidator } from '#validators/entry_validator'

import discordRoleService from '#services/discord_role_service'

export default class EntriesController {
  async index({ params, request }: HttpContext) {
    const statusParam = request.input('status')
    const query = Entry.query().where('roundId', params.roundId)

    if (statusParam && statusParam !== 'all') {
      query.where('status', statusParam)
    } else if (!statusParam) {
      // Default to approved entries for active voting pool
      query.where('status', 'approved').where('isQuarantined', false)
    }

    const entries = await query.orderBy('createdAt', 'desc')
    return { data: entries }
  }

  async store({ params, request, auth }: HttpContext) {
    await VotingRound.findOrFail(params.roundId)
    const payload = await request.validateUsing(createEntryValidator)
    const entry = new Entry()
    
    entry.merge(payload)
    entry.roundId = params.roundId
    
    // Auto-approve if submitted by admin, otherwise pending review
    const user = auth?.user
    if (user && (user.role === 'admin' || user.role === 'supervisor')) {
      entry.status = 'approved'
    } else {
      entry.status = 'pending_review'
    }

    await entry.save()

    // Auto-grant Discord Contributor role to the submitter
    if (user?.discordId) {
      discordRoleService.grantRole(user.discordId).catch(() => {})
    }
    
    return { data: entry }
  }

  async update({ params, request }: HttpContext) {
    const payload = await request.validateUsing(updateEntryValidator)
    const entry = await Entry.query().where('id', params.id).where('roundId', params.roundId).firstOrFail()
    
    entry.merge(payload)
    await entry.save()
    
    return { data: entry }
  }

  async updateStatus({ params, request }: HttpContext) {
    const payload = await request.validateUsing(updateEntryStatusValidator)
    const entry = await Entry.query().where('id', params.id).where('roundId', params.roundId).firstOrFail()
    
    entry.status = payload.status
    await entry.save()
    
    return { data: entry }
  }

  async destroy({ params }: HttpContext) {
    const entry = await Entry.query().where('id', params.id).where('roundId', params.roundId).firstOrFail()
    await entry.delete()
    
    return { data: { message: 'entry deleted' } }
  }

  async reinstate({ params }: HttpContext) {
    const entry = await Entry.query().where('id', params.id).where('roundId', params.roundId).firstOrFail()
    entry.isQuarantined = false
    entry.status = 'approved'
    await entry.save()
    
    return { data: entry }
  }
}

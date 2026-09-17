import { HttpContext } from '@adonisjs/core/http'
import DiscordAuthService from '#services/discord_auth_service'
import User from '#models/user'

import env from '#start/env'

export default class AuthController {
  async redirect({ request, response }: HttpContext) {
    const clientId = env.get('DISCORD_CLIENT_ID') as string
    const redirectUri = encodeURIComponent((env.get('DISCORD_REDIRECT_URI') as string) || '')
    const scope = encodeURIComponent('identify')

    // capture return_to or referer as state so callback redirects to the right frontend origin
    const returnTo = request.input('return_to') || request.input('redirect_to') || request.header('referer') || ''
    const stateParam = returnTo ? `&state=${encodeURIComponent(returnTo)}` : ''

    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}${stateParam}`
    return response.redirect(discordAuthUrl)
  }

  async callback({ request, response }: HttpContext) {
    let origin = (env.get('CORS_ORIGIN') || 'http://localhost:5173').split(',')[0].trim()
    if (!origin || origin === '*' || !origin.startsWith('http')) {
      origin = 'http://localhost:5173'
    }

    // if state contains a valid origin URL, use it as redirect target
    const state = request.input('state')
    if (state && (state.startsWith('http://') || state.startsWith('https://'))) {
      try {
        const parsed = new URL(state)
        origin = parsed.origin
      } catch {
        // fallback to default origin
      }
    }

    const accept = request.header('accept') || ''
    const isBrowserNavigation = accept.includes('text/html') || !request.header('x-requested-with')

    const error = request.input('error')
    const errorDescription = request.input('error_description')
    if (error) {
      if (isBrowserNavigation) {
        return response.redirect(`${origin}/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`)
      }
      return response.badRequest({
        error: {
          code: error,
          message: errorDescription || 'Discord authorization failed',
        },
      })
    }

    const code = request.input('code')
    if (!code) {
      if (isBrowserNavigation) {
        return response.redirect(`${origin}/?error=MISSING_CODE&error_description=${encodeURIComponent('Discord auth code is missing')}`)
      }
      return response.badRequest({
        error: {
          code: 'MISSING_CODE',
          message: 'Discord auth code is missing',
        },
      })
    }

    try {
      const discordAuthService = new DiscordAuthService()
      const tokenResult = await discordAuthService.exchangeCode(code)
      const profile = await discordAuthService.fetchProfile(tokenResult.accessToken)
      const user = await discordAuthService.findOrCreateUser(profile)

      // using accessTokens provider
      const token = await User.accessTokens.create(user)
      const tokenStr = token.value!.release()

      // check if this is a direct browser navigation, if so redirect back to frontend with token
      if (isBrowserNavigation) {
        return response.redirect(`${origin}/?token=${tokenStr}`)
      }

      return {
        data: {
          token: tokenStr,
          user: {
            id: user.id,
            discordUsername: user.discordUsername,
            role: user.role,
          },
        },
      }
    } catch (err: any) {
      if (isBrowserNavigation) {
        return response.redirect(`${origin}/?error=AUTH_FAILED&error_description=${encodeURIComponent(err?.message || 'Authentication failed')}`)
      }
      return response.badRequest({
        error: {
          code: 'AUTH_FAILED',
          message: err?.message || 'Failed to authenticate with Discord',
        },
      })
    }
  }

  async me({ auth }: HttpContext) {
    const user = auth.user!
    return {
      data: {
        id: user.id,
        discordId: user.discordId,
        discordUsername: user.discordUsername,
        discordAvatar: user.discordAvatar,
        role: user.role
      }
    }
  }

  async logout({ auth }: HttpContext) {
    const user = auth.user!
    await User.accessTokens.delete(user, user.currentAccessToken!.identifier)
    return {
      data: { message: 'logged out' }
    }
  }
}

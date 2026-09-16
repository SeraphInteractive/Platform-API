import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const AuthController = () => import('#controllers/auth_controller')
const HealthChecksController = () => import('#controllers/health_checks_controller')
const RoundsController = () => import('#controllers/rounds_controller')
const EntriesController = () => import('#controllers/entries_controller')
const BallotsController = () => import('#controllers/ballots_controller')
const LeaderboardController = () => import('#controllers/leaderboard_controller')
const TelemetryController = () => import('#controllers/telemetry_controller')
const ShotsController = () => import('#controllers/shots_controller')
const ReviewsController = () => import('#controllers/reviews_controller')
const UploadsController = () => import('#controllers/uploads_controller')
const UsersController = () => import('#controllers/users_controller')

router.get('/', () => {
  return { status: 'ok', service: 'mcs-voting-api', version: 'v1' }
})

// container health check: 200 when postgres and redis are reachable, 503 otherwise
router.get('/health', [HealthChecksController])

// unversioned alias of the oauth routes. named separately: routes are auto-named after their
// controller method, and the same names are taken by the /api/v1 group below
router.group(() => {
  router.get('auth/discord', [AuthController, 'redirect']).as('auth.discord.legacy')
  router.get('auth/discord/callback', [AuthController, 'callback']).as('auth.discord.callback.legacy')
}).prefix('/api')

router.group(() => {
  // auth routes (no auth required for initiation or callback)
  router.get('auth/discord', [AuthController, 'redirect']).as('auth.discord.v1')
  router.get('auth/discord/callback', [AuthController, 'callback']).as('auth.discord.callback.v1')

  // health probe within v1
  router.get('health', [HealthChecksController]).as('health.v1')

  // public read routes (no auth required to browse rounds, entries, leaderboards, ballots ledger, and presence)
  router.get('rounds', [RoundsController, 'index'])
  router.get('rounds/:id', [RoundsController, 'show'])
  router.get('rounds/:roundId/entries', [EntriesController, 'index'])
  router.get('rounds/:roundId/ballots', [BallotsController, 'index'])
  router.get('rounds/:roundId/leaderboard', [LeaderboardController, 'show'])
  router.get('rounds/:roundId/results', [LeaderboardController, 'finalized'])
  router.get('shots', [ShotsController, 'index'])
  router.get('shots/:id', [ShotsController, 'show'])
  router.get('users/presence', [UsersController, 'presence'])

  // authenticated routes
  router.group(() => {
    // user profile & list
    router.get('auth/me', [AuthController, 'me'])
    router.delete('auth/logout', [AuthController, 'logout'])
    router.get('users', [UsersController, 'index'])

    // uploads (images and videos up to 5MB)
    router.post('uploads', [UploadsController, 'store'])

    // rounds (admin and supervisor)
    router.group(() => {
      router.post('rounds', [RoundsController, 'store'])
      router.patch('rounds/:id', [RoundsController, 'update'])
      router.delete('rounds/:id', [RoundsController, 'destroy'])
      router.post('rounds/:id/finalize', [RoundsController, 'finalize'])
      router.patch('users/:id/role', [UsersController, 'updateRole'])
    }).use(middleware.role({ roles: ['admin', 'supervisor'] }))

    // entries - community submission
    router.post('rounds/:roundId/entries', [EntriesController, 'store'])

    // entries - supervisor / admin status update
    router.patch('rounds/:roundId/entries/:id/status', [EntriesController, 'updateStatus'])
      .use(middleware.role({ roles: ['supervisor', 'admin'] }))

    // entries (admin only edit / delete / reinstate)
    router.group(() => {
      router.patch('rounds/:roundId/entries/:id', [EntriesController, 'update'])
      router.delete('rounds/:roundId/entries/:id', [EntriesController, 'destroy'])
      router.post('rounds/:roundId/entries/:id/reinstate', [EntriesController, 'reinstate'])
    }).use(middleware.role({ roles: ['admin'] }))

    // ballots (any authenticated voter)
    router.post('rounds/:roundId/ballots', [BallotsController, 'store'])
    router.get('rounds/:roundId/ballots/mine', [BallotsController, 'show'])

    // telemetry (supervisor/moderator+)
    router.group(() => {
      router.get('rounds/:roundId/telemetry', [TelemetryController, 'index'])
      router.get('rounds/:roundId/telemetry/:entryId', [TelemetryController, 'show'])
      router.get('rounds/:roundId/events', [TelemetryController, 'stream'])
    }).use(middleware.role({ roles: ['supervisor'] }))

    // grab-box contributor actions (contributor+)
    router.group(() => {
      router.post('shots/:id/claim', [ShotsController, 'claim'])
      router.post('shots/:id/release', [ShotsController, 'release'])
      router.post('shots/:id/upload-url', [ShotsController, 'uploadUrl'])
      router.post('shots/:id/submit', [ShotsController, 'submit'])
    }).use(middleware.role({ roles: ['contributor'] }))

    // supervisor & admin shot management / review desk
    router.group(() => {
      router.post('shots', [ShotsController, 'store'])
      router.patch('shots/:id', [ShotsController, 'update'])
      router.get('reviews', [ReviewsController, 'index'])
      router.post('reviews/:submissionId', [ReviewsController, 'review'])
      router.post('supervisors/promote/:userId', [ReviewsController, 'promote'])
      router.post('shots/reclaim-expired', [ReviewsController, 'sweepExpired'])
    }).use(middleware.role({ roles: ['supervisor'] }))

    // admin-only shot deletion
    router.delete('shots/:id', [ShotsController, 'destroy']).use(middleware.role({ roles: ['admin'] }))

  }).use(middleware.auth())
}).prefix('/api/v1')

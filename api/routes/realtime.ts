import { Router, Response } from 'express';
import { verifyAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../../lib/types';
import { realtimeServer } from '../../lib/realtime/server';

const router = Router();
router.use(verifyAuth);

/**
 * POST /api/realtime/auth
 * Authenticates client socket connection for tenant-isolated private channels.
 * Prevents any restaurant from subscribing to another restaurant's channel.
 */
router.post('/auth', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { restaurantId, userId, role, linkedBillingUserId } = req.user!;
    const socketId = (req.body.socket_id || req.headers['x-socket-id']) as string;
    const channelName = (req.body.channel_name || req.body.channel) as string;

    if (!channelName) {
      return res.status(400).json({ success: false, error: 'Channel name is required' });
    }

    // Tenant Isolation Check: Channel MUST belong to the user's restaurant
    const expectedPrefix = `private-restaurant-${restaurantId}`;
    if (!channelName.startsWith(expectedPrefix)) {
      console.warn(`🚨 Realtime channel tenant breach attempt: User ${userId} (${restaurantId}) attempted to join ${channelName}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Tenant isolation violation. You cannot subscribe to channels of other restaurants.',
      });
    }

    // Role / Paired Cashier Scope Check for Customer Displays
    if (channelName.includes('-cashier-')) {
      const cashierPart = channelName.split('-cashier-')[1];
      if (role === 'CUSTOMER_DISPLAY' && linkedBillingUserId && cashierPart !== linkedBillingUserId) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Display is paired to cashier "${linkedBillingUserId}", cannot subscribe to cashier "${cashierPart}".`,
        });
      }
    }

    const userData = {
      user_id: `${restaurantId}:${userId}`,
      user_info: {
        userId,
        name: req.user!.name,
        role,
        restaurantId,
      },
    };

    const authResponse = realtimeServer.authorizeChannel(socketId || 'socket-1', channelName, userData);
    return res.json(authResponse);
  } catch (error: any) {
    console.error('Realtime auth error:', error);
    return res.status(500).json({ success: false, error: 'Failed to authenticate channel' });
  }
});

/**
 * GET /api/realtime/poll
 * Polling fallback endpoint (used if WebSocket / Pusher drops or is not configured)
 * Returns recent events for this restaurant since a given timestamp.
 */
router.get('/poll', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { restaurantId } = req.user!;
    const since = Number(req.query.since) || 0;

    const events = realtimeServer.getEventsSince(restaurantId, since);
    return res.json({
      success: true,
      timestamp: Date.now(),
      events,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to poll events' });
  }
});

export default router;

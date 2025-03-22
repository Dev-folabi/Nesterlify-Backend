import { Router } from 'express';
import { getNotifications, markAsRead, deleteNotification } from '../controllers/notificationController';
import { validateDeleteNotification, validateGetNotifications, validateMarkAsRead } from '../middleware/validators/notifyValidation';

const router = Router();

// Get all notifications for a user
router.get('/', validateGetNotifications, getNotifications);

// Mark a notification as read
router.patch('/:id/read', validateMarkAsRead, markAsRead);

// Delete a notification
router.delete('/:id', validateDeleteNotification, deleteNotification);

export default router;
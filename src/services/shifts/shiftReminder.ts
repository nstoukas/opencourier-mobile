// Spec 0027 (AC-9): a local reminder 30 minutes before each of the rider's shifts. The phone schedules
// it itself (a notifee timestamp trigger), so it works with push off and with no signal; nothing is
// sent from the server (decision 78.3). Inexact on purpose: no exact alarm permission is asked, so in
// Android's doze it can come a few minutes late.

import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';
import type { MyShiftBooking } from './shiftsApi';

export const SHIFT_REMINDER_CHANNEL_ID = 'shift_reminders';
export const SHIFT_REMINDER_LEAD_MS = 30 * 60_000;
const ID_PREFIX = 'shift-reminder-';

export const shiftReminderId = (bookingId: string): string =>
  `${ID_PREFIX}${bookingId}`;

const ensureChannel = async () => {
  if (Platform.OS === 'android') {
    // Creating a channel that exists already changes nothing. Android fixes a channel's sound when it is
    // first made, so a new sound would need a new channel id.
    await notifee.createChannel({
      id: SHIFT_REMINDER_CHANNEL_ID,
      name: 'Shift reminders',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
};

// Makes the scheduled reminders match `bookings`: cancels those for bookings no longer held, and
// schedules the missing ones for shifts starting more than 30 minutes ahead. `clockOffsetMs` moves the
// server's instants onto the phone's clock. An empty list (or Shifts off) cancels them all.
export const syncShiftReminders = async (
  bookings: MyShiftBooking[],
  clockOffsetMs: number,
): Promise<void> => {
  const scheduled = (await notifee.getTriggerNotificationIds()).filter(id =>
    id.startsWith(ID_PREFIX),
  );
  const wanted = new Map<string, MyShiftBooking>();
  for (const booking of bookings) {
    const remindAtPhone =
      Date.parse(booking.startsAt) - SHIFT_REMINDER_LEAD_MS - clockOffsetMs;
    if (!Number.isNaN(remindAtPhone) && remindAtPhone > Date.now()) {
      wanted.set(shiftReminderId(booking.id), booking);
    }
  }
  const stale = scheduled.filter(id => !wanted.has(id));
  if (stale.length > 0) {
    await notifee.cancelTriggerNotifications(stale);
  }
  const missing = [...wanted.entries()].filter(
    ([id]) => !scheduled.includes(id),
  );
  if (missing.length === 0) {
    return;
  }
  await ensureChannel();
  for (const [id, booking] of missing) {
    await notifee.createTriggerNotification(
      {
        id,
        title: i18next.t('translations:shift_reminder_title'),
        body: i18next.t('translations:shift_reminder_body', {
          time: booking.startTime,
        }),
        android: {
          channelId: SHIFT_REMINDER_CHANNEL_ID,
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp:
          Date.parse(booking.startsAt) - SHIFT_REMINDER_LEAD_MS - clockOffsetMs,
      },
    );
  }
};

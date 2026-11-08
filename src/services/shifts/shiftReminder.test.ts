import { Platform } from 'react-native';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import '@app/localization/i18n';
import type { MyShiftBooking } from './shiftsApi';
import {
  SHIFT_REMINDER_CHANNEL_ID,
  SHIFT_REMINDER_LEAD_MS,
  shiftReminderId,
  syncShiftReminders,
} from './shiftReminder';

// Spec 0027 (AC-9): the phone's own reminder 30 minutes before each of the rider's shifts.
describe('syncShiftReminders (spec 0027, AC-9)', () => {
  // The phone's clock: Friday 6 Nov 2026, 10:00 UTC.
  const phoneNow = Date.parse('2026-11-06T10:00:00.000Z');
  const MIN = 60_000;
  const originalOS = Platform.OS;

  const booking = (
    id: string,
    startsAt: string,
    startTime = '19:00',
  ): MyShiftBooking => ({
    id,
    shiftSlotId: 'slot-1',
    date: '2026-11-06',
    startsAt,
    endsAt: '2026-11-06T23:00:00.000Z',
    startTime,
    endTime: '23:00',
    swapOfferedAt: null,
    dropUntil: '2026-11-06T05:00:00.000Z',
    dropUntilText: '07:00 today',
    slotRemoved: false,
  });
  const at = (ms: number) => new Date(ms).toISOString();

  const scheduled = (ids: string[]) =>
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue(ids);
  const created = () =>
    (notifee.createTriggerNotification as jest.Mock).mock.calls as Array<
      [
        { id: string; title: string; body: string; android: any },
        { type: TriggerType; timestamp: number; alarmManager?: unknown },
      ]
    >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(phoneNow);
    Platform.OS = 'android';
    scheduled([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Platform.OS = originalOS;
  });

  it('constants: channel shift_reminders, 30 minutes, id shift-reminder-<bookingId>', () => {
    expect(SHIFT_REMINDER_CHANNEL_ID).toBe('shift_reminders');
    expect(SHIFT_REMINDER_LEAD_MS).toBe(30 * MIN);
    expect(shiftReminderId('b1')).toBe('shift-reminder-b1');
  });

  it("cancels only the stale shift-reminder- ids, never another feature's trigger", async () => {
    scheduled([
      'shift-reminder-kept',
      'shift-reminder-gone',
      'shift-reminder-also-gone',
      'offer-reminder-x',
      'trigger1',
    ]);
    await syncShiftReminders([booking('kept', at(phoneNow + 3 * 60 * MIN))], 0);
    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledTimes(1);
    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledWith([
      'shift-reminder-gone',
      'shift-reminder-also-gone',
    ]);
    // Already scheduled: not made again.
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('cancels nothing when nothing is stale', async () => {
    scheduled(['shift-reminder-kept', 'trigger1']);
    await syncShiftReminders([booking('kept', at(phoneNow + 3 * 60 * MIN))], 0);
    expect(notifee.cancelTriggerNotifications).not.toHaveBeenCalled();
  });

  it('schedules a missing one at startsAt - 30 min on the phone clock (no offset)', async () => {
    const startsAt = phoneNow + 2 * 60 * MIN;
    await syncShiftReminders([booking('b2', at(startsAt))], 0);
    expect(created()).toHaveLength(1);
    const [notification, trigger] = created()[0];
    expect(notification.id).toBe('shift-reminder-b2');
    expect(trigger.type).toBe(TriggerType.TIMESTAMP);
    expect(trigger.timestamp).toBe(startsAt - 30 * MIN);
  });

  it("moves the server's instant onto the phone's clock: startsAt - 30 min - clockOffsetMs", async () => {
    // The server is 7 minutes ahead of the phone.
    const offset = 7 * MIN;
    const startsAt = phoneNow + offset + 2 * 60 * MIN;
    await syncShiftReminders([booking('b2', at(startsAt))], offset);
    expect(created()[0][1].timestamp).toBe(startsAt - 30 * MIN - offset);
    // And a phone ahead of the server.
    jest.clearAllMocks();
    scheduled([]);
    await syncShiftReminders([booking('b3', at(startsAt))], -offset);
    expect(created()[0][1].timestamp).toBe(startsAt - 30 * MIN + offset);
  });

  it('skips a shift starting 30 minutes ahead or less, judged on the server clock', async () => {
    const offset = 10 * MIN;
    await syncShiftReminders(
      [
        // 29 minutes ahead by the server's clock.
        booking('soon', at(phoneNow + offset + 29 * MIN)),
        // Exactly 30 minutes ahead: the reminder would be now.
        booking('now', at(phoneNow + offset + 30 * MIN)),
        // Already started.
        booking('started', at(phoneNow + offset - 5 * MIN)),
        // 31 minutes ahead: scheduled.
        booking('later', at(phoneNow + offset + 31 * MIN)),
      ],
      offset,
    );
    expect(created().map(([notification]) => notification.id)).toEqual([
      'shift-reminder-later',
    ]);
    expect(created()[0][1].timestamp).toBe(phoneNow + MIN);
  });

  it('a shift 35 minutes ahead by the phone but 25 by the server is skipped', async () => {
    // The server is 10 minutes ahead; its startsAt is 25 minutes after its now.
    await syncShiftReminders([booking('b', at(phoneNow + 35 * MIN))], 10 * MIN);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('uses the channel shift_reminders, made with importance DEFAULT and the default sound', async () => {
    await syncShiftReminders([booking('b2', at(phoneNow + 2 * 60 * MIN))], 0);
    expect(notifee.createChannel).toHaveBeenCalledWith({
      id: 'shift_reminders',
      name: 'Shift reminders',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    });
    const [notification, trigger] = created()[0];
    expect(notification.android.channelId).toBe('shift_reminders');
    // Inexact on purpose: no alarm manager, so no exact alarm permission.
    expect(trigger.alarmManager).toBeUndefined();
  });

  it('makes no channel on iOS', async () => {
    Platform.OS = 'ios';
    await syncShiftReminders([booking('b2', at(phoneNow + 2 * 60 * MIN))], 0);
    expect(notifee.createChannel).not.toHaveBeenCalled();
    expect(created()).toHaveLength(1);
  });

  it("words the reminder with the server's startTime, never the phone's own formatting", async () => {
    // An instant whose wall time in any zone is not 21:15.
    await syncShiftReminders(
      [booking('b2', '2026-11-06T13:07:00.000Z', '21:15')],
      0,
    );
    const [notification] = created()[0];
    expect(notification.title).toBe('Your shift starts soon');
    expect(notification.body).toBe('Your shift starts at 21:15.');
  });

  it('an empty list (or Shifts off) cancels every shift reminder and schedules none', async () => {
    scheduled(['shift-reminder-a', 'shift-reminder-b', 'trigger1']);
    await syncShiftReminders([], 0);
    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledWith([
      'shift-reminder-a',
      'shift-reminder-b',
    ]);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    expect(notifee.createChannel).not.toHaveBeenCalled();
  });

  it('schedules each missing booking once, in one sync', async () => {
    scheduled(['shift-reminder-b1']);
    await syncShiftReminders(
      [
        booking('b1', at(phoneNow + 2 * 60 * MIN)),
        booking('b2', at(phoneNow + 26 * 60 * MIN)),
        booking('b3', at(phoneNow + 50 * 60 * MIN)),
      ],
      0,
    );
    expect(created().map(([notification]) => notification.id)).toEqual([
      'shift-reminder-b2',
      'shift-reminder-b3',
    ]);
  });
});

import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import '@app/localization/i18n';
import { JobReadyUpdate } from '@app/utilities/readySignals';
import { READY_CHANNEL_ID, showReadyNotice } from './readyNotice';

// Spec 0023 (AC-6): the notice a rider gets when the restaurant moves the
// ready time or marks the food ready.
describe('showReadyNotice (spec 0023, AC-6)', () => {
  const originalOS = Platform.OS;
  const NOW = Date.parse('2026-11-03T12:00:00.000Z');

  const delay: JobReadyUpdate = {
    deliveryId: 'del-1',
    restaurantName: 'R73 Kitchen',
    readyAt: new Date(NOW + 12 * 60 * 1000).toISOString(),
    foodReadyAt: null,
    delayMinutes: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("uses the job-ready channel, with the phone's default sound", async () => {
    expect(READY_CHANNEL_ID).toBe('job-ready');
    await showReadyNotice(delay, NOW);
    expect(notifee.createChannel).toHaveBeenCalledWith({
      id: 'job-ready',
      name: 'Ready times',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
    });
  });

  it('posts one notification with id ready-<deliveryId> on the job-ready channel, worded from the message', async () => {
    await showReadyNotice(delay, NOW);
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith({
      id: 'ready-del-1',
      title: 'Food ready time',
      body: 'R73 Kitchen: +10 min, ready in ~12 min',
      android: {
        channelId: 'job-ready',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    });
  });

  it('says food ready for a food ready message', async () => {
    await showReadyNotice(
      {
        ...delay,
        foodReadyAt: '2026-11-03T11:59:00.000Z',
        delayMinutes: null,
      },
      NOW,
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ready-del-1',
        body: 'R73 Kitchen: food ready',
      }),
    );
  });

  it('a second change for the same job reuses the same id, so it replaces the first', async () => {
    await showReadyNotice(delay, NOW);
    await showReadyNotice({ ...delay, delayMinutes: 5 }, NOW);
    const ids = (notifee.displayNotification as jest.Mock).mock.calls.map(
      ([n]) => n.id,
    );
    expect(ids).toEqual(['ready-del-1', 'ready-del-1']);
  });

  it('escapes the restaurant name as HTML on Android', async () => {
    await showReadyNotice(
      {
        ...delay,
        restaurantName: 'Tom & Jerry <b>Grill</b>',
        foodReadyAt: '2026-11-03T11:59:00.000Z',
      },
      NOW,
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Tom &amp; Jerry &lt;b&gt;Grill&lt;/b&gt;: food ready',
      }),
    );
  });

  it('leaves the body as plain text on iOS, and makes no Android channel there', async () => {
    Platform.OS = 'ios';
    await showReadyNotice(
      {
        ...delay,
        restaurantName: 'Tom & Jerry <b>Grill</b>',
        foodReadyAt: '2026-11-03T11:59:00.000Z',
      },
      NOW,
    );
    expect(notifee.createChannel).not.toHaveBeenCalled();
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ready-del-1',
        body: 'Tom & Jerry <b>Grill</b>: food ready',
      }),
    );
  });
});

import notifee from '@notifee/react-native';
import { services } from './service';
import {
  SplitDecision,
  clearSplitNotices,
  showSplitDecision,
} from './splitNotice/splitNotice';

// Row 11 review: the next rider on this phone never sees the last one's split answers.
describe('Services logout split notices (spec 0047, Services.ts)', () => {
  const decision: SplitDecision = {
    deliveryId: 'del-logout-test',
    outcome: 'REFUSED',
    adminNote: null,
    boxSize: null,
  };

  beforeEach(() => {
    clearSplitNotices();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearSplitNotices();
  });

  it('services.logout() takes down the split notification left in the shade', async () => {
    await showSplitDecision(decision);
    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue([
      { id: 'split-del-logout-test', notification: {} },
      { id: 'offer-trip-45', notification: {} },
    ]);

    services.logout();
    await new Promise(resolve => setImmediate(resolve));

    expect(notifee.cancelNotification).toHaveBeenCalledWith(
      'split-del-logout-test',
    );
    expect(notifee.cancelNotification).not.toHaveBeenCalledWith(
      'offer-trip-45',
    );
    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue([]);
  });

  it('services.logout() forgets the answers shown: the same answer is shown to the next rider', async () => {
    await showSplitDecision(decision);
    await showSplitDecision(decision);
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

    services.logout();
    await showSplitDecision(decision);

    expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
  });
});

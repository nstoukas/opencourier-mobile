import AsyncStorage from '@react-native-async-storage/async-storage';
import { services } from './service';
import { getOwnPosition, setOwnPosition } from './ownPosition';
import { getPickedUpAt, setPickedUpAt } from './pickupTimes';
import {
  clearDeclineFailed,
  isDeclineFailed,
  markDeclineFailed,
  offerKeyOf,
} from './offerPush/answeredOffers';

describe('Services (spec 0018, review nit)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearDeclineFailed();
  });
  it('logout clears the own position (getOwnPosition() is null after it)', () => {
    setOwnPosition({ latitude: 39.3622, longitude: 22.9425 });
    expect(getOwnPosition()).toEqual({ latitude: 39.3622, longitude: 22.9425 });

    services.logout();

    expect(getOwnPosition()).toBeNull();
  });

  it('logout clears recorded picked up times (spec 0021, review fix)', () => {
    setPickedUpAt('del-101', 1700000000000);
    expect(getPickedUpAt('del-101')).toBe(1700000000000);

    services.logout();

    expect(getPickedUpAt('del-101')).toBeUndefined();
  });

  it('exposes sosService instance (spec 0022)', () => {
    expect(services.sosService).toBeDefined();
    expect(typeof services.sosService.start).toBe('function');
    expect(typeof services.sosService.getActive).toBe('function');
    expect(typeof services.sosService.sendPoints).toBe('function');
    expect(typeof services.sosService.end).toBe('function');
  });

  it('logout clears the decline failed list from memory and storage (Row 131, Point 9)', async () => {
    const key = offerKeyOf('del-logout-test', '2026-11-23T10:00:00Z');
    markDeclineFailed(key);
    expect(isDeclineFailed(key)).toBe(true);
    expect(
      await AsyncStorage.getItem('decline_failed_offer_ids'),
    ).not.toBeNull();

    services.logout();

    expect(isDeclineFailed(key)).toBe(false);
    expect(await AsyncStorage.getItem('decline_failed_offer_ids')).toBeNull();
  });
});

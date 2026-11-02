import { services } from './service';
import { getOwnPosition, setOwnPosition } from './ownPosition';
import { getPickedUpAt, setPickedUpAt } from './pickupTimes';

describe('Services (spec 0018, review nit)', () => {
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
});

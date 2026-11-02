import { services } from './service';
import { getOwnPosition, setOwnPosition } from './ownPosition';

describe('Services (spec 0018, review nit)', () => {
  it('logout clears the own position (getOwnPosition() is null after it)', () => {
    setOwnPosition({ latitude: 39.3622, longitude: 22.9425 });
    expect(getOwnPosition()).toEqual({ latitude: 39.3622, longitude: 22.9425 });

    services.logout();

    expect(getOwnPosition()).toBeNull();
  });
});

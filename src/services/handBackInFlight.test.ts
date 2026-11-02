import {
  endHandBack,
  isHandBackInFlight,
  startHandBack,
} from './handBackInFlight';

describe('handBackInFlight tracking (spec 0021, AC-12)', () => {
  beforeEach(() => {
    endHandBack('del-1');
    endHandBack('del-2');
  });

  it('tracks delivery IDs currently in flight during hand back', () => {
    expect(isHandBackInFlight('del-1')).toBe(false);

    startHandBack('del-1');
    expect(isHandBackInFlight('del-1')).toBe(true);
    expect(isHandBackInFlight('del-2')).toBe(false);

    endHandBack('del-1');
    expect(isHandBackInFlight('del-1')).toBe(false);
  });
});

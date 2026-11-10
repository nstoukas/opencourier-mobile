import { services } from './service';
import {
  clearRemovalNotices,
  showRemovalDecision,
  useRemovalNotices,
} from './removalNotice/removalNotice';
import { renderHook, act } from '@testing-library/react-native';
import { RemovalDecision } from '@app/utilities/removalRequest';

describe('Services logout removal notices (spec 0035, AC-11, Services.ts)', () => {
  beforeEach(() => {
    act(() => {
      clearRemovalNotices();
    });
  });

  afterEach(() => {
    act(() => {
      clearRemovalNotices();
    });
  });

  it('services.logout() empties the notices', async () => {
    const decision: RemovalDecision = {
      deliveryId: 'del-logout-test',
      outcome: 'APPROVED',
      decisionNote: null,
      paid: true,
      payAmount: 300,
      currencyCode: 'EUR',
    };

    const { result } = renderHook(() => useRemovalNotices());

    await act(async () => {
      await showRemovalDecision(decision);
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].deliveryId).toBe('del-logout-test');

    act(() => {
      services.logout();
    });

    expect(result.current).toHaveLength(0);
  });
});

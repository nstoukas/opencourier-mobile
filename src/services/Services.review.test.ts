import { services } from './service';
import * as reviewSeenModule from './reviewSeen';
import * as reviewNoticeModule from './reviewNotice';

jest.mock('./reviewSeen', () => ({
  clearReviewSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./reviewNotice', () => ({
  clearReviewNotice: jest.fn(),
}));

describe('Services reviewService and logout cleanup (spec 0038, AC-9, Services.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes reviewService with its API methods', () => {
    expect(services.reviewService).toBeDefined();
    expect(typeof services.reviewService.sendReviewRequest).toBe('function');
    expect(typeof services.reviewService.getReviewRequests).toBe('function');
    expect(typeof services.reviewService.withdrawReviewRequest).toBe(
      'function',
    );
    expect(typeof services.reviewService.getHowItWorks).toBe('function');
    expect(typeof services.reviewService.getSettingChanges).toBe('function');
  });

  it('services.logout() calls clearReviewSeen() and clearReviewNotice()', async () => {
    services.logout();

    expect(reviewSeenModule.clearReviewSeen).toHaveBeenCalledTimes(1);
    expect(reviewNoticeModule.clearReviewNotice).toHaveBeenCalledTimes(1);
  });
});

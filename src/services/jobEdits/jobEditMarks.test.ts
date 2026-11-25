import { act, cleanup, renderHook } from '@testing-library/react-native';
import {
  clearJobEditMarks,
  jobEditMarksFor,
  markJobEdited,
  useJobEditMarks,
} from './jobEditMarks';
import { JobEdited } from '@app/utilities/jobEdits';

// Row 164 (AC-4): in-memory marks store recording what the restaurant edited on held jobs.
describe('jobEditMarks (row 164, AC-4)', () => {
  beforeEach(() => {
    clearJobEditMarks();
  });

  afterEach(() => {
    cleanup();
    clearJobEditMarks();
  });

  const update = (
    deliveryId: string,
    changed: ('NOTES' | 'TIMES')[],
  ): JobEdited => ({
    deliveryId,
    restaurantName: 'R73 Kitchen',
    changed,
    editedAt: '2026-11-25T12:00:00.000Z',
  });

  it('initially has no marks for a delivery', () => {
    expect(jobEditMarksFor('del-1')).toEqual([]);
  });

  it('accumulates kinds per delivery (notes then times shows both)', () => {
    markJobEdited(update('del-1', ['NOTES']));
    expect(jobEditMarksFor('del-1')).toEqual(['NOTES']);

    markJobEdited(update('del-1', ['TIMES']));
    expect(jobEditMarksFor('del-1')).toEqual(['NOTES', 'TIMES']);
  });

  it('keeps fixed order [NOTES, TIMES] regardless of incoming order', () => {
    markJobEdited(update('del-1', ['TIMES']));
    expect(jobEditMarksFor('del-1')).toEqual(['TIMES']);

    markJobEdited(update('del-1', ['NOTES']));
    expect(jobEditMarksFor('del-1')).toEqual(['NOTES', 'TIMES']);
  });

  it('does not notify subscribers when a repeated kind adds nothing new', () => {
    let notifyCount = 0;
    // Set initial marks
    markJobEdited(update('del-1', ['NOTES']));

    const { result } = renderHook(() => {
      notifyCount++;
      return useJobEditMarks('del-1');
    });
    expect(result.current).toEqual(['NOTES']);
    const countBefore = notifyCount;

    // Repeating the same kind
    act(() => {
      markJobEdited(update('del-1', ['NOTES']));
    });

    expect(notifyCount).toBe(countBefore);
    expect(result.current).toEqual(['NOTES']);
  });

  it('marks are isolated per delivery', () => {
    markJobEdited(update('del-1', ['NOTES']));
    markJobEdited(update('del-2', ['TIMES']));

    expect(jobEditMarksFor('del-1')).toEqual(['NOTES']);
    expect(jobEditMarksFor('del-2')).toEqual(['TIMES']);
  });

  it('useJobEditMarks hook redraws when marks change', () => {
    const { result } = renderHook(() => useJobEditMarks('del-1'));
    expect(result.current).toEqual([]);

    act(() => {
      markJobEdited(update('del-1', ['NOTES']));
    });
    expect(result.current).toEqual(['NOTES']);

    act(() => {
      markJobEdited(update('del-1', ['TIMES']));
    });
    expect(result.current).toEqual(['NOTES', 'TIMES']);
  });

  it('clearJobEditMarks empties all marks and notifies subscribers', () => {
    markJobEdited(update('del-1', ['NOTES', 'TIMES']));
    markJobEdited(update('del-2', ['NOTES']));

    const { result } = renderHook(() => useJobEditMarks('del-1'));
    expect(result.current).toEqual(['NOTES', 'TIMES']);

    act(() => {
      clearJobEditMarks();
    });

    expect(jobEditMarksFor('del-1')).toEqual([]);
    expect(jobEditMarksFor('del-2')).toEqual([]);
    expect(result.current).toEqual([]);
  });
});

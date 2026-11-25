import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, cleanup, render } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import {
  clearJobEditMarks,
  markJobEdited,
} from '@app/services/jobEdits/jobEditMarks';
import { JobEditedLine } from './JobEditedLine';

// Row 164 (AC-1, AC-5): JobEditedLine component rendering, language support,
// and source guard ensuring value 5 (no storage or network writes).
describe('JobEditedLine (row 164, AC-1, AC-5)', () => {
  const deliveryId = 'del-line-1';

  beforeEach(async () => {
    clearJobEditMarks();
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    cleanup();
    clearJobEditMarks();
    await i18n.changeLanguage('en');
  });

  it('renders nothing when there are no marks for the delivery', () => {
    const { queryByTestId } = render(<JobEditedLine deliveryId={deliveryId} />);
    expect(queryByTestId('job-edited-line')).toBeNull();
  });

  it('renders English line when marks exist', () => {
    act(() => {
      markJobEdited({
        deliveryId,
        restaurantName: 'Kitchen',
        changed: ['NOTES'],
        editedAt: '2026-11-25T14:00:00.000Z',
      });
    });

    const screen1 = render(<JobEditedLine deliveryId={deliveryId} />);
    expect(screen1.getByTestId('job-edited-line').props.children).toBe(
      'Restaurant changed: notes',
    );

    act(() => {
      markJobEdited({
        deliveryId,
        restaurantName: 'Kitchen',
        changed: ['TIMES'],
        editedAt: '2026-11-25T14:05:00.000Z',
      });
    });

    expect(screen1.getByTestId('job-edited-line').props.children).toBe(
      'Restaurant changed: notes, times',
    );
  });

  it('renders Greek line when language is el', async () => {
    await i18n.changeLanguage('el');

    act(() => {
      markJobEdited({
        deliveryId,
        restaurantName: 'Kitchen',
        changed: ['NOTES', 'TIMES'],
        editedAt: '2026-11-25T14:00:00.000Z',
      });
    });

    const screen = render(<JobEditedLine deliveryId={deliveryId} />);
    expect(screen.getByTestId('job-edited-line').props.children).toBe(
      'Αλλαγή από το κατάστημα: σημειώσεις, ώρες',
    );
  });

  it('renders nothing for a different delivery ID', () => {
    act(() => {
      markJobEdited({
        deliveryId,
        restaurantName: 'Kitchen',
        changed: ['NOTES'],
        editedAt: '2026-11-25T14:00:00.000Z',
      });
    });

    const screen = render(<JobEditedLine deliveryId="other-delivery-id" />);
    expect(screen.queryByTestId('job-edited-line')).toBeNull();
  });

  // Value 5 source guard: neither jobEditMarks.ts nor JobEditedLine.tsx may import
  // AsyncStorage, axios, or any network client.
  it('source guard: jobEditMarks.ts and JobEditedLine.tsx import no storage or HTTP modules', () => {
    const root = path.resolve(__dirname, '../../..');
    const marksSource = fs.readFileSync(
      path.join(root, 'src/services/jobEdits/jobEditMarks.ts'),
      'utf8',
    );
    const lineSource = fs.readFileSync(
      path.join(root, 'src/components/JobEditedLine/JobEditedLine.tsx'),
      'utf8',
    );

    const forbidden = [
      'AsyncStorage',
      '@react-native-async-storage',
      'axios',
      'fetch',
      'http',
      'UClient',
    ];

    for (const term of forbidden) {
      expect(marksSource).not.toContain(term);
      expect(lineSource).not.toContain(term);
    }
  });
});

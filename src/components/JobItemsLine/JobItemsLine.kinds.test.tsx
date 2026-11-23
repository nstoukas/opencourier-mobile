import React from 'react';
import { render, fireEvent, within, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderItem } from '@app/types/types';
import { JobItemsLine, resetItemTicksForTests } from './JobItemsLine';

// Spec 0028 (row 103), AC-4 and AC-5: drinks and sides counted on the items line
// and listed first, labelled, in the sheet; an order with no marks looks as before.
const items = (list: Array<Record<string, unknown>>) =>
  list as unknown as OrderItem[];

// The sheet's item rows (job-item-N), top to bottom.
const rowIdsInOrder = (root: ReturnType<typeof render>) =>
  root
    .getAllByTestId(/^job-item-\d+$/)
    .map(node => node.props.testID as string);

describe('JobItemsLine drinks and sides (spec 0028)', () => {
  beforeEach(() => {
    resetItemTicksForTests();
  });

  afterEach(() => {
    resetItemTicksForTests();
  });

  describe('the line (AC-4, AC-5)', () => {
    it('reads "3 items · 2 drinks, 1 side", counting quantities', () => {
      const { getByTestId } = render(
        <JobItemsLine
          deliveryId="del-k1"
          items={items([
            { name: 'Souvlaki', quantity: 1 },
            { name: 'Cola', quantity: 2, kind: 'DRINK' },
            { name: 'Fries', quantity: 1, kind: 'SIDE' },
          ])}
        />,
      );

      expect(
        within(getByTestId('job-items-line')).getByText(
          '3 items · 2 drinks, 1 side',
        ),
      ).toBeTruthy();
    });

    it('N stays the number of lines: "2 items · 3 drinks, 1 side"', () => {
      const { getByText } = render(
        <JobItemsLine
          deliveryId="del-k2"
          items={items([
            { name: 'Cola', quantity: 3, kind: 'DRINK' },
            { name: 'Fries', quantity: 1, kind: 'SIDE' },
          ])}
        />,
      );

      expect(getByText('2 items · 3 drinks, 1 side')).toBeTruthy();
    });

    it('shows only the kinds present: "1 drink"', () => {
      const { getByText } = render(
        <JobItemsLine
          deliveryId="del-k3"
          items={items([
            { name: 'Gyros', quantity: 1 },
            { name: 'Cola', quantity: 1, kind: 'DRINK' },
          ])}
        />,
      );

      expect(getByText('2 items · 1 drink')).toBeTruthy();
    });

    it('shows only the kinds present: "2 sides"', () => {
      const { getByText } = render(
        <JobItemsLine
          deliveryId="del-k4"
          items={items([
            { name: 'Fries', quantity: 1, kind: 'SIDE' },
            { name: 'Salad', quantity: 1, kind: 'SIDE' },
          ])}
        />,
      );

      expect(getByText('2 items · 2 sides')).toBeTruthy();
    });

    it('a single marked line with no quantity counts 1: "1 item · 1 side"', () => {
      const { getByText } = render(
        <JobItemsLine
          deliveryId="del-k5"
          items={items([{ name: 'Fries', kind: 'SIDE' }])}
        />,
      );

      expect(getByText('1 item · 1 side')).toBeTruthy();
    });

    it('with no marks, reads exactly as before ("N items", nothing after it)', () => {
      const unmarked = items([
        { name: 'Souvlaki', quantity: 4 },
        { name: 'Pita', quantity: 1 },
      ]);
      const { getByTestId, queryByText } = render(
        <JobItemsLine deliveryId="del-k6" items={unmarked} />,
      );

      const line = getByTestId('job-items-line');
      const before = i18n.t('translations:items_count', { count: 2 });
      expect(before).toBe('2 items');
      expect(within(line).getByText(before)).toBeTruthy();
      expect(queryByText(/·/)).toBeNull();
      expect(queryByText(/drink|side/i)).toBeNull();
    });

    it('today\'s single Package item reads "1 item"', () => {
      const { getByText } = render(
        <JobItemsLine
          deliveryId="del-k7"
          items={items([{ name: 'Package', quantity: 1, size: 'SMALL' }])}
        />,
      );
      expect(getByText('1 item')).toBeTruthy();
    });
  });

  describe('the sheet (AC-4)', () => {
    const mixed = items([
      { name: 'Souvlaki', quantity: 2, size: 'LARGE' },
      { name: 'Fries', quantity: 1, kind: 'SIDE' },
      { name: 'Cola', quantity: 1, kind: 'DRINK' },
      { name: 'Pita', quantity: 1 },
      { name: 'Water', quantity: 3, kind: 'DRINK' },
    ]);

    it('lists drinks, then sides, then the rest, each in the order sent', () => {
      const root = render(<JobItemsLine deliveryId="del-s1" items={mixed} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      // testIDs carry the index sent, so the order on screen reads 2, 4, 1, 0, 3.
      expect(rowIdsInOrder(root)).toEqual([
        'job-item-2',
        'job-item-4',
        'job-item-1',
        'job-item-0',
        'job-item-3',
      ]);
      expect(
        within(root.getByTestId('job-item-2')).getByText('Cola'),
      ).toBeTruthy();
      expect(
        within(root.getByTestId('job-item-4')).getByText('3 × Water'),
      ).toBeTruthy();
      expect(
        within(root.getByTestId('job-item-0')).getByText('2 × Souvlaki'),
      ).toBeTruthy();
    });

    it('labels marked lines with a "Drink" or "Side" pill, and unmarked lines with none', () => {
      const root = render(<JobItemsLine deliveryId="del-s2" items={mixed} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      expect(
        within(root.getByTestId('job-item-2')).getByText('Drink'),
      ).toBeTruthy();
      expect(
        within(root.getByTestId('job-item-4')).getByText('Drink'),
      ).toBeTruthy();
      expect(
        within(root.getByTestId('job-item-1')).getByText('Side'),
      ).toBeTruthy();
      expect(
        within(root.getByTestId('job-item-0')).queryByText(/^(Drink|Side)$/),
      ).toBeNull();
      expect(
        within(root.getByTestId('job-item-3')).queryByText(/^(Drink|Side)$/),
      ).toBeNull();
      expect(root.getByTestId('job-item-kind-2').props.children).toBe(
        i18n.t('translations:item_kind_drink'),
      );
      expect(root.getByTestId('job-item-kind-1').props.children).toBe(
        i18n.t('translations:item_kind_side'),
      );
      expect(root.queryByTestId('job-item-kind-0')).toBeNull();
    });

    it('ticking the first listed drink marks job-item-${sentIndex}, and the tick follows that item', () => {
      const root = render(<JobItemsLine deliveryId="del-s3" items={mixed} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      // The first row on screen is Cola, sent at index 2.
      const firstRow = root.getAllByTestId(/^job-item-\d+$/)[0];
      expect(firstRow.props.testID).toBe('job-item-2');
      fireEvent.press(firstRow);

      expect(root.getByTestId('job-item-2').props.accessibilityState).toEqual({
        checked: true,
      });
      for (const other of [
        'job-item-0',
        'job-item-1',
        'job-item-3',
        'job-item-4',
      ]) {
        expect(root.getByTestId(other).props.accessibilityState).toEqual({
          checked: false,
        });
      }
    });

    it('a tick survives the re-sort: ticking Souvlaki (sent first, shown fourth) keeps it on Souvlaki', () => {
      const root = render(<JobItemsLine deliveryId="del-s4" items={mixed} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      fireEvent.press(root.getByTestId('job-item-0'));

      // Reopen from scratch: same delivery, same items.
      root.rerender(<JobItemsLine deliveryId="del-s4" items={mixed} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      const souvlakiRow = root.getByTestId('job-item-0');
      expect(within(souvlakiRow).getByText('2 × Souvlaki')).toBeTruthy();
      expect(souvlakiRow.props.accessibilityState).toEqual({ checked: true });
      // The row shown first (Cola) is not ticked.
      expect(
        root.getAllByTestId(/^job-item-\d+$/)[0].props.accessibilityState,
      ).toEqual({ checked: false });
    });

    it('ticks set before marks were known stay on the same items by the index sent', () => {
      // An unmarked order ticks index 0 (Souvlaki); the same delivery with its marks keeps Souvlaki ticked.
      const unmarked = items([
        { name: 'Souvlaki', quantity: 1 },
        { name: 'Cola', quantity: 1 },
      ]);
      const root = render(
        <JobItemsLine deliveryId="del-s5" items={unmarked} />,
      );
      fireEvent.press(root.getByTestId('job-items-line'));
      fireEvent.press(root.getByTestId('job-item-0'));

      const marked = items([
        { name: 'Souvlaki', quantity: 1 },
        { name: 'Cola', quantity: 1, kind: 'DRINK' },
      ]);
      root.rerender(<JobItemsLine deliveryId="del-s5" items={marked} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      expect(rowIdsInOrder(root)).toEqual(['job-item-1', 'job-item-0']);
      expect(
        within(root.getByTestId('job-item-0')).getByText('Souvlaki'),
      ).toBeTruthy();
      expect(root.getByTestId('job-item-0').props.accessibilityState).toEqual({
        checked: true,
      });
      expect(root.getByTestId('job-item-1').props.accessibilityState).toEqual({
        checked: false,
      });
    });

    // Row 137 (the tour, problem 24): the size is worded in the app's language, never shown raw.
    const openSingle = (deliveryId: string, size: unknown) => {
      const root = render(
        <JobItemsLine
          deliveryId={deliveryId}
          items={items([{ name: 'Package', quantity: 1, size }])}
        />,
      );
      fireEvent.press(root.getByTestId('job-items-line'));
      return root;
    };

    describe('the size of a single line (row 137)', () => {
      afterEach(async () => {
        // jest.setup.js pins English; a Greek test must hand it back.
        await act(async () => {
          await i18n.changeLanguage('en');
        });
      });

      it.each([
        ['SMALL', 'Small'],
        ['MEDIUM', 'Medium'],
        ['LARGE', 'Large'],
        ['Large', 'Large'],
        ['small', 'Small'],
      ])('shows %s as "%s" in English, never the raw value', (size, word) => {
        const root = openSingle(`del-en-${size}`, size);
        const row = root.getByTestId('job-item-0');

        expect(within(row).getByText(word)).toBeTruthy();
        expect(root.queryByText('SMALL')).toBeNull();
        expect(root.queryByText('MEDIUM')).toBeNull();
        expect(root.queryByText('LARGE')).toBeNull();
        if (size !== word) {
          expect(root.queryByText(size)).toBeNull();
        }
      });

      it.each([
        ['SMALL', 'Μικρό'],
        ['MEDIUM', 'Μεσαίο'],
        ['LARGE', 'Μεγάλο'],
        ['Large', 'Μεγάλο'],
        ['small', 'Μικρό'],
      ])('shows %s as "%s" in Greek', async (size, word) => {
        await act(async () => {
          await i18n.changeLanguage('el');
        });
        const root = openSingle(`del-el-${size}`, size);
        const row = root.getByTestId('job-item-0');

        expect(within(row).getByText(word)).toBeTruthy();
        expect(root.queryByText(size)).toBeNull();
        expect(root.queryByText(/^(small|medium|large)$/i)).toBeNull();
      });

      it.each([['XL'], ['xl'], ['HUGE'], [''], [null], [undefined]])(
        'shows nothing for a size it does not know (%p)',
        size => {
          const root = openSingle(`del-unknown-${String(size)}`, size);
          const row = root.getByTestId('job-item-0');

          // The row is there with its name, and no size text of any kind beside it.
          expect(within(row).getByText('Package')).toBeTruthy();
          if (typeof size === 'string' && size !== '') {
            expect(root.queryByText(size)).toBeNull();
            expect(root.queryByText(size.toUpperCase())).toBeNull();
          }
          expect(
            root.queryByText(/^(small|medium|large|xl|huge)$/i),
          ).toBeNull();
          expect(root.queryByText(/item_size/)).toBeNull();
        },
      );
    });

    it('with several lines no size is shown, worded or raw (spec 0028, unchanged by row 137)', () => {
      const root = render(
        <JobItemsLine
          deliveryId="del-s6b"
          items={items([
            { name: 'Souvlaki', quantity: 1, size: 'LARGE' },
            { name: 'Pita', quantity: 1, size: 'small' },
          ])}
        />,
      );
      fireEvent.press(root.getByTestId('job-items-line'));

      expect(root.getByTestId('job-item-0')).toBeTruthy();
      expect(root.getByTestId('job-item-1')).toBeTruthy();
      expect(root.queryByText(/^(small|medium|large)$/i)).toBeNull();
    });

    it("hides the size when more than one line was sent (it is the order's, not the first line's)", () => {
      const root = render(<JobItemsLine deliveryId="del-s7" items={mixed} />);
      fireEvent.press(root.getByTestId('job-items-line'));

      expect(root.queryByText('LARGE')).toBeNull();
    });

    it('with no marks, the sheet keeps the order sent and shows no pill', () => {
      const unmarked = items([
        { name: 'Souvlaki', quantity: 1 },
        { name: 'Pita', quantity: 2 },
        { name: 'Gyros', quantity: 1 },
      ]);
      const root = render(
        <JobItemsLine deliveryId="del-s8" items={unmarked} />,
      );
      fireEvent.press(root.getByTestId('job-items-line'));

      expect(rowIdsInOrder(root)).toEqual([
        'job-item-0',
        'job-item-1',
        'job-item-2',
      ]);
      expect(root.queryByTestId(/^job-item-kind-/)).toBeNull();
      expect(root.queryByText(/^(Drink|Side)$/)).toBeNull();
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarningsDelivery';
import { EarningsDeliveryDetail } from '@app/types/types';
import { formatCurrencyFromCents } from '@app/utilities/currency';

jest.mock('@app/hooks/useEarningsDelivery');

describe('EarningsDelivery removalPay (decision 24.43)', () => {
  const defaultProps: any = {
    navigation: { goBack: jest.fn() },
    route: { params: { deliveryId: 'del-detail-test' } },
  };

  /** Recursively extracts text from a test renderer node. */
  const getNodeText = (node: any): string => {
    if (typeof node === 'string') {
      return node;
    }
    if (typeof node === 'number') {
      return String(node);
    }
    if (!node || !node.props) {
      return '';
    }
    const children = node.props.children;
    if (Array.isArray(children)) {
      return children.map(getNodeText).join('');
    }
    if (typeof children === 'object' && children !== null) {
      return getNodeText(children);
    }
    return String(children ?? '');
  };

  /**
   * Finds the parent container View that holds two items (the label and its value).
   */
  const findTwoChildContainer = (targetNode: any) => {
    let current = targetNode.parent;
    while (current) {
      if (
        current.type === 'View' &&
        Array.isArray(current.children) &&
        current.children.length === 2
      ) {
        return current;
      }
      current = current.parent;
    }
    return null;
  };

  /**
   * Reads the value text displayed beside a given row label in the rendered card.
   */
  const getRenderedRowValue = (labelText: string): string => {
    const labelNode = screen.getByText(labelText);
    const rowNode = findTwoChildContainer(labelNode);
    expect(rowNode).not.toBeNull();
    const texts = rowNode.children.map((c: any) => getNodeText(c));
    const value = texts.find((t: string) => t !== labelText);
    expect(value).toBeDefined();
    return value!;
  };

  /**
   * Reads the rendered total figure from the summary card.
   */
  const getRenderedTotalValue = (): string => {
    const totalLabel = i18n.t('translations:total_earned');
    const totalLabelNode = screen.getByText(totalLabel);
    const cardNode = findTwoChildContainer(totalLabelNode);
    expect(cardNode).not.toBeNull();
    const texts = cardNode.children.map((c: any) => getNodeText(c));
    const totalValue = texts.find((t: string) => t !== totalLabel);
    expect(totalValue).toBeDefined();
    return totalValue!;
  };

  /**
   * Converts a formatted currency string (e.g. "€2.50") back into integer cents.
   */
  const parseCurrencyToCents = (formatted: string): number => {
    const match = formatted.match(/([0-9]+)\.([0-9]{2})/);
    if (!match) {
      throw new Error(`Unable to parse currency amount from: "${formatted}"`);
    }
    return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
  };

  it('shows removalPay as a separate line with the earnings_removal label formatted as money when present on a delivered order', () => {
    const deliveredDetailWithRemoval: EarningsDeliveryDetail = {
      deliveryId: 'del-delivered-removal',
      pickupBusinessName: 'Souvlaki Express',
      dropoffAddress: 'Dimitriadis 50, Volos',
      droppedOffAt: '2026-11-10T12:00:00Z',
      compensation: 250,
      tips: 50,
      removalPay: 180, // €1.80 removal pay
      total: 480,
      currency: 'EUR',
      // ordinary delivered order has no kind
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: deliveredDetailWithRemoval,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // 1. Separate line with label earnings_removal
    const removalLabel = i18n.t('translations:earnings_removal');
    expect(screen.getByText(removalLabel)).toBeTruthy();

    // 2. Exact amount as returned by API, formatted as the app formats money
    const expectedFormatted = formatCurrencyFromCents(
      deliveredDetailWithRemoval.removalPay,
      deliveredDetailWithRemoval.currency,
    );
    const renderedValue = getRenderedRowValue(removalLabel);
    expect(renderedValue).toBe(expectedFormatted);
    expect(renderedValue).toBe('€1.80');
  });

  it('shows no earnings_removal line when removalPay key is missing on an ordinary delivery', () => {
    const ordinaryDetail: EarningsDeliveryDetail = {
      deliveryId: 'del-ordinary-no-removal',
      pickupBusinessName: 'Souvlaki Express',
      dropoffAddress: 'Dimitriadis 50, Volos',
      droppedOffAt: '2026-11-10T12:00:00Z',
      compensation: 250,
      tips: 50,
      total: 300,
      currency: 'EUR',
      // removalPay key is missing
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: ordinaryDetail,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // When removalPay key is missing, no earnings_removal line is drawn
    const removalLabel = i18n.t('translations:earnings_removal');
    expect(screen.queryByText(removalLabel)).toBeNull();
  });

  it('verifies the breakdown rows add up to the total when all five pay kinds are present', () => {
    // Detail with compensation, tips, waitingPay, returnTripPay and removalPay all set, and total their sum
    const fullDetail: EarningsDeliveryDetail = {
      deliveryId: 'del-all-pay-kinds',
      pickupBusinessName: 'Mega Grill',
      dropoffAddress: 'Iasonos 100, Volos',
      droppedOffAt: '2026-11-10T14:30:00Z',
      compensation: 240,
      tips: 60,
      waitingPay: 110,
      returnTripPay: 130,
      removalPay: 170,
      total: 710, // 240 + 60 + 110 + 130 + 170 = 710
      currency: 'EUR',
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: fullDetail,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // Verify every one of the five rows is present
    const basePayLabel = i18n.t('translations:piece_rate_pay');
    const tipsLabel = i18n.t('translations:tips');
    const waitingLabel = i18n.t('translations:earnings_waiting');
    const returnTripLabel = i18n.t('translations:earnings_return_trip');
    const removalLabel = i18n.t('translations:earnings_removal');

    expect(screen.getByText(basePayLabel)).toBeTruthy();
    expect(screen.getByText(tipsLabel)).toBeTruthy();
    expect(screen.getByText(waitingLabel)).toBeTruthy();
    expect(screen.getByText(returnTripLabel)).toBeTruthy();
    expect(screen.getByText(removalLabel)).toBeTruthy();

    // Read each figure from the RENDERED rows (the texts shown beside each label)
    const renderedBasePayStr = getRenderedRowValue(basePayLabel);
    const renderedTipsStr = getRenderedRowValue(tipsLabel);
    const renderedWaitingStr = getRenderedRowValue(waitingLabel);
    const renderedReturnTripStr = getRenderedRowValue(returnTripLabel);
    const renderedRemovalStr = getRenderedRowValue(removalLabel);

    // Turn each figure back to cents
    const basePayCents = parseCurrencyToCents(renderedBasePayStr);
    const tipsCents = parseCurrencyToCents(renderedTipsStr);
    const waitingCents = parseCurrencyToCents(renderedWaitingStr);
    const returnTripCents = parseCurrencyToCents(renderedReturnTripStr);
    const removalCents = parseCurrencyToCents(renderedRemovalStr);

    // Verify each parsed row value matches the expected figure
    expect(basePayCents).toBe(240);
    expect(tipsCents).toBe(60);
    expect(waitingCents).toBe(110);
    expect(returnTripCents).toBe(130);
    expect(removalCents).toBe(170);

    // Add them together
    const sumCents =
      basePayCents + tipsCents + waitingCents + returnTripCents + removalCents;

    // Read the rendered total figure and turn it back to cents
    const renderedTotalStr = getRenderedTotalValue();
    const renderedTotalCents = parseCurrencyToCents(renderedTotalStr);

    // Assert the sum equals the rendered total figure
    expect(renderedTotalCents).toBe(710);
    expect(sumCents).toBe(renderedTotalCents);
  });
});

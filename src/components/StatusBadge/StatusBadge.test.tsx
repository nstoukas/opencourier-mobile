import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { StatusBadge, statusMember } from './StatusBadge';
import { OrderStatus } from '@app/types/enums';
import { color } from '@app/styles/theme';
import translations from '@app/localization/en/translations';
import '@app/localization/i18n';

describe('AC-8: StatusBadge component', () => {
  it("OrderStatus.dropped_off is 'DROPPED_OFF'", () => {
    expect(OrderStatus.dropped_off).toBe('DROPPED_OFF');
  });

  it("statusMember('DROPPED_OFF') is 'dropped_off'", () => {
    expect(statusMember('DROPPED_OFF')).toBe('dropped_off');
  });

  it('every OrderStatus member has a non-empty English translation and matches statusMember', () => {
    const members = Object.keys(OrderStatus) as (keyof typeof OrderStatus)[];
    expect(members.length).toBeGreaterThan(0);

    for (const member of members) {
      const translationKey = `status_${member}` as keyof typeof translations;
      const label = translations[translationKey];
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);

      const enumValue = OrderStatus[member];
      expect(statusMember(enumValue)).toBe(member);
    }
  });

  it("renders 'DROPPED_OFF' as 'Delivered' on color.success with color['success-foreground'] text", () => {
    const { getByText, UNSAFE_getByType } = render(
      <StatusBadge status="DROPPED_OFF" />,
    );
    const textNode = getByText('Delivered');
    const textStyle = StyleSheet.flatten(textNode.props.style);
    expect(textStyle.color).toBe(color['success-foreground']);

    const container = UNSAFE_getByType(View);
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(color.success);
  });

  it("renders 'CANCELED' as 'Canceled' on color['destructive-soft'] with color.destructive text", () => {
    const { getByText, UNSAFE_getByType } = render(
      <StatusBadge status="CANCELED" />,
    );
    const textNode = getByText('Canceled');
    const textStyle = StyleSheet.flatten(textNode.props.style);
    expect(textStyle.color).toBe(color.destructive);

    const container = UNSAFE_getByType(View);
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(color['destructive-soft']);
  });

  it("renders an unknown status 'SOMETHING' as raw value on color.muted with color['muted-foreground'] text", () => {
    const { getByText, UNSAFE_getByType } = render(
      <StatusBadge status="SOMETHING" />,
    );
    const textNode = getByText('SOMETHING');
    const textStyle = StyleSheet.flatten(textNode.props.style);
    expect(textStyle.color).toBe(color['muted-foreground']);

    const container = UNSAFE_getByType(View);
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(color.muted);
  });

  const softInfoStatuses: [string, string][] = [
    ['CREATED', 'Created'],
    ['ACCEPTED', 'Accepted'],
    ['DISPATCHED', 'On the way to pickup'],
    ['COURIER_ARRIVED_AT_PICKUP_LOCATION', 'At pickup'],
    ['PICKED_UP', 'Picked up'],
  ];

  test.each(softInfoStatuses)(
    "renders '%s' status with tone info-soft on color['info-soft'] with color.info text",
    (statusValue, expectedLabel) => {
      const { getByText, UNSAFE_getByType } = render(
        <StatusBadge status={statusValue} />,
      );
      const textNode = getByText(expectedLabel);
      const textStyle = StyleSheet.flatten(textNode.props.style);
      expect(textStyle.color).toBe(color.info);

      const container = UNSAFE_getByType(View);
      const containerStyle = StyleSheet.flatten(container.props.style);
      expect(containerStyle.backgroundColor).toBe(color['info-soft']);
    },
  );
});

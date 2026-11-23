import React from 'react';
import renderer, { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { Colors } from '@app/styles/colors';
import { ConnectionStatus } from '@app/services/liveConnection';
import { ConnectionDot, connectionDotLook } from './ConnectionDot';
import '@app/localization/i18n';

describe('ConnectionDot (Clause 1: Different colour AND hollow ring, no words on screen)', () => {
  const statuses: ConnectionStatus[] = [
    'connected',
    'connecting',
    'disconnected',
    'off',
  ];

  describe('connectionDotLook helper', () => {
    it('returns a distinct colour for each of the four statuses', () => {
      const colors = statuses.map(s => connectionDotLook(s).color);
      const uniqueColors = new Set(colors);

      // Must be 4 unique colours so every state is visually differentiated
      expect(uniqueColors.size).toBe(4);
      expect(connectionDotLook('connected').color).toBe(Colors.green8);
      expect(connectionDotLook('connecting').color).toBe(Colors.orange1);
      expect(connectionDotLook('disconnected').color).toBe(Colors.red1);
      expect(connectionDotLook('off').color).toBe(Colors.gray5);
    });

    it('returns a distinct translation key for each of the four statuses', () => {
      const keys = statuses.map(s => connectionDotLook(s).labelKey);
      const uniqueKeys = new Set(keys);

      // Must be 4 unique keys so every state has distinct explanatory words
      expect(uniqueKeys.size).toBe(4);
      expect(connectionDotLook('connected').labelKey).toBe(
        'translations:connection_live',
      );
      expect(connectionDotLook('connecting').labelKey).toBe(
        'translations:connection_connecting',
      );
      expect(connectionDotLook('disconnected').labelKey).toBe(
        'translations:connection_lost',
      );
      expect(connectionDotLook('off').labelKey).toBe(
        'translations:connection_off',
      );
    });
  });

  describe('rendered component (Clause 1)', () => {
    it('shows NO words on screen for any status', () => {
      [...statuses, 'refused' as ConnectionStatus].forEach(status => {
        const tree = renderer.create(<ConnectionDot status={status} />);
        const textNodes = tree.root.findAllByType(Text);
        expect(textNodes).toHaveLength(0);
      });
    });

    it('applies filled dot for connected and hollow ring for non-connected statuses (told apart without colour)', () => {
      // Live connection is a filled dot (not transparent, background is green8)
      const liveTree = renderer.create(<ConnectionDot status="connected" />);
      const liveDot = liveTree.root.find(
        (node: ReactTestInstance) =>
          node.props.testID === 'connection-dot-connected',
      );
      const liveStyle = StyleSheet.flatten(liveDot.props.style);
      expect(liveStyle.backgroundColor).toBe(Colors.green8);
      expect(liveStyle.borderWidth).toBeUndefined();

      // Non-live statuses are hollow rings (transparent background, borderWidth 3, borderColor)
      const nonLiveStatuses: ConnectionStatus[] = [
        'connecting',
        'disconnected',
        'off',
        'refused',
      ];
      nonLiveStatuses.forEach(status => {
        const tree = renderer.create(<ConnectionDot status={status} />);
        const dotNode = tree.root.find(
          (node: ReactTestInstance) =>
            node.props.testID === `connection-dot-${status}`,
        );
        expect(dotNode).toBeDefined();

        const flatStyle = StyleSheet.flatten(dotNode.props.style);
        expect(flatStyle.backgroundColor).toBe('transparent');
        expect(flatStyle.borderWidth).toBe(3);
        expect(flatStyle.borderColor).toBe(connectionDotLook(status).color);
      });
    });

    it('provides accessible text role and accessibility label with status words for screen readers', () => {
      const allStatuses: ConnectionStatus[] = [...statuses, 'refused'];
      const expectedLabels = [
        'Connected',
        'Connecting…',
        'No connection, retrying',
        'Not connected',
        'Not connected, reopen the app to retry',
      ];

      allStatuses.forEach((status, idx) => {
        const tree = renderer.create(<ConnectionDot status={status} />);
        const container = tree.root.find(
          (node: ReactTestInstance) => node.props.testID === 'connection-dot',
        );

        expect(container.props.accessible).toBe(true);
        expect(container.props.accessibilityRole).toBe('text');
        expect(container.props.accessibilityLabel).toBe(expectedLabels[idx]);
      });
    });

    it('merges custom style prop into container style', () => {
      const customStyle = { marginTop: 24, paddingHorizontal: 20 };
      const tree = renderer.create(
        <ConnectionDot status="connected" style={customStyle} />,
      );
      const container = tree.root.find(
        (node: ReactTestInstance) => node.props.testID === 'connection-dot',
      );
      const flatStyle = StyleSheet.flatten(container.props.style);

      expect(flatStyle.marginTop).toBe(24);
      expect(flatStyle.paddingHorizontal).toBe(20);
    });
  });

  describe('refused status (Minor 1: server turned login down)', () => {
    it('returns red1 color and translations:connection_refused key', () => {
      expect(connectionDotLook('refused')).toEqual({
        color: Colors.red1,
        labelKey: 'translations:connection_refused',
      });
    });

    it('renders hollow red ring with no visible text and localized accessibilityLabel', () => {
      const tree = renderer.create(<ConnectionDot status="refused" />);
      expect(tree.root.findAllByType(Text)).toHaveLength(0);

      const container = tree.root.find(
        (node: ReactTestInstance) => node.props.testID === 'connection-dot',
      );
      expect(container.props.accessibilityLabel).toBe(
        'Not connected, reopen the app to retry',
      );

      const dotNode = tree.root.find(
        (node: ReactTestInstance) =>
          node.props.testID === 'connection-dot-refused',
      );
      const flatStyle = StyleSheet.flatten(dotNode.props.style);
      expect(flatStyle.backgroundColor).toBe('transparent');
      expect(flatStyle.borderWidth).toBe(3);
      expect(flatStyle.borderColor).toBe(Colors.red1);
    });
  });
});

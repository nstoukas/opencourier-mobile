import React from 'react';
import renderer, { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { Colors } from '@app/styles/colors';
import { ConnectionStatus } from '@app/services/liveConnection';
import { ConnectionDot, connectionDotLook } from './ConnectionDot';
import '@app/localization/i18n';

describe('ConnectionDot (Clause 1: Different colour AND words for each status)', () => {
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

  describe('rendered component', () => {
    it('renders distinct localized text for all four statuses (colour AND words for colorblind riders)', () => {
      const renderedLabels = statuses.map(status => {
        const tree = renderer.create(<ConnectionDot status={status} />);
        const textNode = tree.root.findByType(Text);
        return textNode.props.children;
      });

      // Assert each status renders its expected localized text
      expect(renderedLabels).toEqual([
        'Connected',
        'Connecting…',
        'No connection, retrying',
        'Not connected',
      ]);

      // Assert all 4 rendered text labels are distinct from each other
      const uniqueLabels = new Set(renderedLabels);
      expect(uniqueLabels.size).toBe(4);
    });

    it('applies matching dot backgroundColor for each status', () => {
      statuses.forEach(status => {
        const tree = renderer.create(<ConnectionDot status={status} />);
        const dotNode = tree.root.find(
          (node: ReactTestInstance) =>
            node.props.testID === `connection-dot-${status}`,
        );
        expect(dotNode).toBeDefined();

        const flatStyle = StyleSheet.flatten(dotNode.props.style);
        expect(flatStyle.backgroundColor).toBe(connectionDotLook(status).color);
      });
    });

    it('provides accessible text role and accessibility label matching the visible status words', () => {
      statuses.forEach(status => {
        const tree = renderer.create(<ConnectionDot status={status} />);
        const container = tree.root.find(
          (node: ReactTestInstance) => node.props.testID === 'connection-dot',
        );

        expect(container.props.accessible).toBe(true);
        expect(container.props.accessibilityRole).toBe('text');

        const textNode = tree.root.findByType(Text);
        expect(container.props.accessibilityLabel).toBe(
          textNode.props.children,
        );
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

    it('renders localized text "Not connected, reopen the app to retry" and red dot', () => {
      const tree = renderer.create(<ConnectionDot status="refused" />);
      const textNode = tree.root.findByType(Text);
      expect(textNode.props.children).toBe(
        'Not connected, reopen the app to retry',
      );

      const dotNode = tree.root.find(
        (node: ReactTestInstance) =>
          node.props.testID === 'connection-dot-refused',
      );
      const flatStyle = StyleSheet.flatten(dotNode.props.style);
      expect(flatStyle.backgroundColor).toBe(Colors.red1);
    });
  });
});

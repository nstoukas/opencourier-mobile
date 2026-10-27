import React from 'react';
import renderer from 'react-test-renderer';
import { View } from 'react-native';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { Icon } from './Icon';
import { color } from '@app/styles/theme';

describe('AC-7: Icon component wrapper', () => {
  it('renders Phosphor icon with default size (24), weight (regular) and tone (foreground)', () => {
    const tree = renderer.create(<Icon icon={CaretDownIcon} />);
    const root = tree.root;

    // Find the mocked Svg component (rendered as View with svgElement="Svg" in jest.setup.js)
    const svgNode = root.find(
      node =>
        node.props.svgElement === 'Svg' ||
        node.props.testID?.startsWith('phosphor-'),
    );

    expect(svgNode).toBeDefined();
    expect(svgNode.props.width).toBe(24);
    expect(svgNode.props.height).toBe(24);
    expect(svgNode.props.color).toBe(color.foreground);
    expect(svgNode.props.testID).toBe(
      'phosphor-react-native-caret-down-regular',
    );
  });

  it('renders icon with custom size, weight and token tone', () => {
    const tree = renderer.create(
      <Icon icon={CaretUpIcon} size={36} weight="bold" tone="destructive" />,
    );
    const root = tree.root;
    const svgNode = root.find(
      node =>
        node.props.svgElement === 'Svg' ||
        node.props.testID?.startsWith('phosphor-'),
    );

    expect(svgNode).toBeDefined();
    expect(svgNode.props.width).toBe(36);
    expect(svgNode.props.height).toBe(36);
    expect(svgNode.props.color).toBe(color.destructive);
    expect(svgNode.props.testID).toBe('phosphor-react-native-caret-up-bold');
  });

  it('applies custom style to the wrapping View', () => {
    const customStyle = {
      marginHorizontal: 8,
      transform: [{ rotate: '180deg' }],
    };
    const tree = renderer.create(
      <Icon icon={CaretDownIcon} style={customStyle} />,
    );
    const root = tree.root;
    // The top-level component is a View
    const wrappingView = root.findByType(View);
    expect(wrappingView.props.style).toEqual(customStyle);
  });
});

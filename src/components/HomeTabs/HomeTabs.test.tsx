import React from 'react';
import renderer, { ReactTestInstance } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { HomeTabs } from './HomeTabs';
import { HomeTabItem } from '@app/types/types';
import '@app/localization/i18n';

describe('HomeTabs', () => {
  it('does not log a unique key warning during rendering', () => {
    // Spy on console.error to detect React missing key warnings
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={0}
        onTabSelected={jest.fn()}
      />,
    );

    // Assert that no key warning was logged during rendering
    const keyWarningCall = consoleErrorSpy.mock.calls.find(
      call =>
        typeof call[0] === 'string' && call[0].includes('unique "key" prop'),
    );
    expect(keyWarningCall).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  it('renders three tabs with correct localized text', () => {
    const component = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={0}
        onTabSelected={jest.fn()}
      />,
    );

    // Extract text content from all rendered Text components
    const textNodes = component.root.findAllByType(Text);
    const renderedTexts = textNodes.map(node => node.props.children);

    expect(renderedTexts).toContain('New');
    expect(renderedTexts).toContain('In Progress');
    expect(renderedTexts).toContain('History');
  });

  it('calls onTabSelected with the corresponding HomeTabItem when pressed', () => {
    const onTabSelectedMock = jest.fn();
    const component = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={0}
        onTabSelected={onTabSelectedMock}
      />,
    );

    // Locate TouchableOpacity for each tab
    const touchables = component.root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBe(3);

    // Invoke onPress for the second tab (InProgress)
    touchables[1].props.onPress();

    expect(onTabSelectedMock).toHaveBeenCalledTimes(1);
    expect(onTabSelectedMock).toHaveBeenCalledWith(HomeTabItem.InProgress);
  });

  it('renders badge count when newCount > 0 and hides it when newCount is 0', () => {
    // With newCount = 4, a Text node containing 4 should exist
    const componentWithBadge = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={4}
        inProgressCount={0}
        onTabSelected={jest.fn()}
      />,
    );
    const textNodesWithBadge = componentWithBadge.root.findAllByType(Text);
    const badgeTextNode = textNodesWithBadge.find(
      (node: ReactTestInstance) =>
        node.props.children === 4 || node.props.children === '4',
    );
    expect(badgeTextNode).toBeDefined();

    // With newCount = 0, no Text node with value 4 should exist
    const componentNoBadge = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={0}
        onTabSelected={jest.fn()}
      />,
    );
    const textNodesNoBadge = componentNoBadge.root.findAllByType(Text);
    const noBadgeTextNode = textNodesNoBadge.find(
      (node: ReactTestInstance) =>
        node.props.children === 4 || node.props.children === '4',
    );
    expect(noBadgeTextNode).toBeUndefined();
  });

  it('renders badge count when inProgressCount > 0 and hides it when 0', () => {
    // The In Progress badge is a separate branch from the New badge, so it needs
    // its own case — a passing New-badge test says nothing about this one.
    const withBadge = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={7}
        onTabSelected={jest.fn()}
      />,
    );
    const found = withBadge.root
      .findAllByType(Text)
      .find(
        (node: ReactTestInstance) =>
          node.props.children === 7 || node.props.children === '7',
      );
    expect(found).toBeDefined();

    const withoutBadge = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={0}
        onTabSelected={jest.fn()}
      />,
    );
    const notFound = withoutBadge.root
      .findAllByType(Text)
      .find(
        (node: ReactTestInstance) =>
          node.props.children === 7 || node.props.children === '7',
      );
    expect(notFound).toBeUndefined();
  });
});

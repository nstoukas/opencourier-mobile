import React from 'react';
import renderer, { ReactTestInstance, act } from 'react-test-renderer';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import {
  HomeTabs,
  buttonWidth,
  tabSelectedColor,
  buttonBackgroundColor,
} from './HomeTabs';
import { HomeTabItem } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { SCREEN_WIDTH } from '@app/utilities/constants';
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

  it('re-colours in place when selectedTab prop changes', () => {
    // Mount HomeTabs with selectedTab set to New
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <HomeTabs
          selectedTab={HomeTabItem.New}
          newCount={0}
          inProgressCount={0}
          onTabSelected={jest.fn()}
        />,
      );
    });

    // Helper to extract background color of a tab at index (0: New, 1: InProgress, 2: History)
    // Structure: tree (outer container View) -> children[0] (tabs View) -> children[tabIndex] (TouchableOpacity) -> children[0] (inner tab View)
    const getTabBgColor = (tabIndex: number) => {
      const tree = component.toJSON() as any;
      const innerView = tree.children[0].children[tabIndex].children[0];
      return StyleSheet.flatten(innerView.props.style)?.backgroundColor;
    };

    expect(getTabBgColor(0)).toEqual(Colors.black4);
    expect(getTabBgColor(2)).toEqual(Colors.transparent);

    // Update selectedTab prop to History on the same mounted instance
    act(() => {
      component.update(
        <HomeTabs
          selectedTab={HomeTabItem.History}
          newCount={0}
          inProgressCount={0}
          onTabSelected={jest.fn()}
        />,
      );
    });

    // Assert that the pill background switched in place without remounting bugs
    expect(getTabBgColor(0)).toEqual(Colors.transparent);
    expect(getTabBgColor(2)).toEqual(Colors.black4);
  });

  it('preserves shadow style on the selected tab and omits it on unselected tabs', () => {
    const component = renderer.create(
      <HomeTabs
        selectedTab={HomeTabItem.New}
        newCount={0}
        inProgressCount={0}
        onTabSelected={jest.fn()}
      />,
    );

    const tree = component.toJSON() as any;
    // tree.children[0] is the inner tabs View container
    const tabsContainer = tree.children[0];
    // Index 0 is selected (New), Index 1 is unselected (InProgress)
    const selectedInnerViewStyle = StyleSheet.flatten(
      tabsContainer.children[0].children[0].props.style,
    );
    const unselectedInnerViewStyle = StyleSheet.flatten(
      tabsContainer.children[1].children[0].props.style,
    );

    // The selected tab must have a shadow color (Colors.black)
    expect(selectedInnerViewStyle.shadowColor).toEqual(Colors.black);
    // Unselected tab must not carry a shadow color
    expect(unselectedInnerViewStyle.shadowColor).toBeUndefined();
  });

  describe('pure helper functions', () => {
    describe('buttonWidth', () => {
      it('calculates expected width based on tab type and SCREEN_WIDTH', () => {
        expect(buttonWidth(HomeTabItem.New)).toBeCloseTo(
          (SCREEN_WIDTH - 144) * 0.26,
        );
        expect(buttonWidth(HomeTabItem.InProgress)).toBeCloseTo(
          (SCREEN_WIDTH - 144) * 0.44,
        );
        expect(buttonWidth(HomeTabItem.History)).toBeCloseTo(
          (SCREEN_WIDTH - 144) * 0.24,
        );
      });
    });

    describe('tabSelectedColor', () => {
      it('returns white when current tab matches selected tab', () => {
        expect(tabSelectedColor(HomeTabItem.New, HomeTabItem.New)).toEqual(
          Colors.white,
        );
        expect(
          tabSelectedColor(HomeTabItem.InProgress, HomeTabItem.InProgress),
        ).toEqual(Colors.white);
        expect(
          tabSelectedColor(HomeTabItem.History, HomeTabItem.History),
        ).toEqual(Colors.white);
      });

      it('returns dark text color (black1) when current tab differs from selected tab', () => {
        expect(tabSelectedColor(HomeTabItem.New, HomeTabItem.History)).toEqual(
          Colors.black1,
        );
        expect(
          tabSelectedColor(HomeTabItem.InProgress, HomeTabItem.New),
        ).toEqual(Colors.black1);
        expect(
          tabSelectedColor(HomeTabItem.History, HomeTabItem.InProgress),
        ).toEqual(Colors.black1);
      });
    });

    describe('buttonBackgroundColor', () => {
      it('returns black4 pill color when current tab is selected', () => {
        expect(buttonBackgroundColor(HomeTabItem.New, HomeTabItem.New)).toEqual(
          Colors.black4,
        );
        expect(
          buttonBackgroundColor(HomeTabItem.InProgress, HomeTabItem.InProgress),
        ).toEqual(Colors.black4);
        expect(
          buttonBackgroundColor(HomeTabItem.History, HomeTabItem.History),
        ).toEqual(Colors.black4);
      });

      it('returns transparent background when current tab is not selected', () => {
        expect(
          buttonBackgroundColor(HomeTabItem.New, HomeTabItem.History),
        ).toEqual(Colors.transparent);
        expect(
          buttonBackgroundColor(HomeTabItem.InProgress, HomeTabItem.New),
        ).toEqual(Colors.transparent);
        expect(
          buttonBackgroundColor(HomeTabItem.History, HomeTabItem.InProgress),
        ).toEqual(Colors.transparent);
      });
    });
  });
});

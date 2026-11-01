import React from 'react';
import { OnboardingStack } from './OnboardingNavigation';
import { OnboardingScreen } from './types';

describe('OnboardingNavigation (spec 0013 AC-7: no public sign up)', () => {
  it('registers no JoinInstance, Signup or ForgotPassword screen in OnboardingStack', () => {
    // Inspect the screens configured as children of OnboardingStackNavigator.Navigator
    const stack = OnboardingStack();
    const children = React.Children.toArray(stack.props.children);
    const registeredScreenNames = children.map(
      (child: any) => child.props.name,
    );

    // Spec 0013 AC-7: The courier app has no sign up screen.
    // The unused ForgotPassword screen and its route are deleted.
    expect(registeredScreenNames).not.toContain('JoinInstance');
    expect(registeredScreenNames).not.toContain('Signup');
    expect(registeredScreenNames).not.toContain('ForgotPassword');

    // Only valid onboarding screens are registered
    expect(registeredScreenNames).toEqual([
      OnboardingScreen.Landing,
      OnboardingScreen.Welcome,
      OnboardingScreen.ChooseInstance,
      OnboardingScreen.InstanceDetails,
      OnboardingScreen.LoginInstance,
    ]);
  });

  it('OnboardingScreen enum does not define JoinInstance, Signup, or ForgotPassword', () => {
    expect((OnboardingScreen as any).JoinInstance).toBeUndefined();
    expect((OnboardingScreen as any).Signup).toBeUndefined();
    expect((OnboardingScreen as any).ForgotPassword).toBeUndefined();

    const enumValues = Object.values(OnboardingScreen);
    expect(enumValues).not.toContain('JoinInstance');
    expect(enumValues).not.toContain('Signup');
    expect(enumValues).not.toContain('ForgotPassword');
  });
});

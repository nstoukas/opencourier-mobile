import { MainScreens } from './types';

describe('MainScreens navigation routes (Row 18, no photos and trimmed settings)', () => {
  const removedScreens = [
    'PhotoAttachment',
    'ThemeScreen',
    'Accessibility',
    'MyLanguages',
    'RestaurantTypeScreen',
    'CuisineTypeScreen',
    'EarningsMethodScreen',
    'WeightOrderScreen',
    'OrderPreferenceScreen',
  ];

  const keptScreens = [
    'Drawer',
    'ItemsCollected',
    'MarkAsDelivered',
    'PayoutActivity',
    'Licences',
    'LanguageScreen',
    'OperatingArea',
    'DefaultSound',
    'VolumeScreen',
    'EmergencyContact',
    'NavigationScreen',
    'VehicleTypeScreen',
    'ShiftAvailabilityScreen',
    'ReportIssue',
    'EarningsDay',
    'EarningsDelivery',
  ];

  it.each(removedScreens)(
    'MainScreens does not define or contain %s',
    screenName => {
      expect((MainScreens as any)[screenName]).toBeUndefined();
      expect(Object.keys(MainScreens)).not.toContain(screenName);
      expect(Object.values(MainScreens)).not.toContain(screenName);
    },
  );

  it.each(keptScreens)('MainScreens retains %s', screenName => {
    expect((MainScreens as any)[screenName]).toBeDefined();
  });
});

import { MainScreens } from './types';

describe('MainScreens navigation routes (Row 18, spec 0021: no photos, trimmed settings, quicker delivery)', () => {
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
    'ItemsCollected',
    'MarkAsDelivered',
  ];

  const keptScreens = [
    'Drawer',
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

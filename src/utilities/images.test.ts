import fs from 'fs';
import path from 'path';
import { Images } from './images';

describe('AC-7: images.ts kept entries and icons asset directory', () => {
  const keptImageKeys = [
    'WelcomePin',
    'WelcomeBell',
    'NoiseBG',
    'Avatar',
    'Cone',
    'Logo',
    'OpenDeli',
    'OnboardingCar',
    'OnboardingMoped',
    'OnboardingFood',
    'Car',
    'Box',
    'Storefront',
    'Buildings',
  ];

  it('images.ts exports only the 14 kept entries', () => {
    const exportedKeys = Object.keys(Images);
    expect(exportedKeys.sort()).toEqual(keptImageKeys.sort());
    expect(exportedKeys.length).toBe(14);
  });

  it('src/assets/icons holds exactly the 42 PNG files for the kept entries', () => {
    const iconsDir = path.resolve(__dirname, '../assets/icons');
    const files = fs.readdirSync(iconsDir);

    // Each kept image has 3 density files (base .png, @2x.png, @3x.png)
    expect(files.length).toBe(42);

    const expectedFiles = [
      'avatar.png',
      'avatar@2x.png',
      'avatar@3x.png',
      'box.png',
      'box@2x.png',
      'box@3x.png',
      'Buildings.png',
      'Buildings@2x.png',
      'Buildings@3x.png',
      'car.png',
      'car@2x.png',
      'car@3x.png',
      'cone.png',
      'cone@2x.png',
      'cone@3x.png',
      'illustration-bell-order.png',
      'illustration-bell-order@2x.png',
      'illustration-bell-order@3x.png',
      'illustration-car.png',
      'illustration-car@2x.png',
      'illustration-car@3x.png',
      'illustration-food-order.png',
      'illustration-food-order@2x.png',
      'illustration-food-order@3x.png',
      'illustration-moped.png',
      'illustration-moped@2x.png',
      'illustration-moped@3x.png',
      'illustration-pin-order.png',
      'illustration-pin-order@2x.png',
      'illustration-pin-order@3x.png',
      'LogoBadge.png',
      'LogoBadge@2x.png',
      'LogoBadge@3x.png',
      'noise_bg.png',
      'noise_bg@2x.png',
      'noise_bg@3x.png',
      'open-deli-logo.png',
      'open-deli-logo@2x.png',
      'open-deli-logo@3x.png',
      'Storefront.png',
      'Storefront@2x.png',
      'Storefront@3x.png',
    ];

    expect(files.sort()).toEqual(expectedFiles.sort());
  });
});

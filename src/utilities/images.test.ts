import fs from 'fs';
import path from 'path';
import { Images } from './images';

describe('images.ts kept entries and icons asset directory (row 17, spec 0039)', () => {
  const keptImageKeys = [
    'Avatar',
    'Cone',
    'Logo',
    'Car',
    'Box',
    'Storefront',
    'Buildings',
  ];

  it('images.ts exports only the 7 kept entries', () => {
    const exportedKeys = Object.keys(Images);
    expect(exportedKeys.sort()).toEqual(keptImageKeys.sort());
    expect(exportedKeys.length).toBe(7);
  });

  it('src/assets/icons holds exactly the 21 PNG files for the kept entries', () => {
    const iconsDir = path.resolve(__dirname, '../assets/icons');
    const files = fs.readdirSync(iconsDir);

    // Each kept image has 3 density files (base .png, @2x.png, @3x.png)
    expect(files.length).toBe(21);

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
      'LogoBadge.png',
      'LogoBadge@2x.png',
      'LogoBadge@3x.png',
      'Storefront.png',
      'Storefront@2x.png',
      'Storefront@3x.png',
    ];

    expect(files.sort()).toEqual(expectedFiles.sort());
  });
});

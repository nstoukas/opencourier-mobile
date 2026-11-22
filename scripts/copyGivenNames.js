#!/usr/bin/env node
// Spec 0053 (cross check 6): the address note name list is written once, in the backend
// (opencourier-backend/src/domains/location-note/given-names.json). This copies it byte for byte into
// the app, so the phone warns about exactly the names the server does. Run it after the backend file
// changes:  node scripts/copyGivenNames.js
const fs = require('fs');
const path = require('path');

const source = path.resolve(
  __dirname,
  '../../opencourier-backend/src/domains/location-note/given-names.json',
);
const target = path.resolve(
  __dirname,
  '../src/utilities/addressNotes/given-names.json',
);

fs.copyFileSync(source, target);
console.log(
  `Copied ${path.basename(source)} to ${path.relative(process.cwd(), target)}`,
);

// The skeleton package ships its types in lib/Skeleton.d.ts but its package.json does not
// point at them, so TypeScript cannot find them on its own. This file points TypeScript
// there. A .d.ts file holds types only; nothing in it runs.
declare module '@thevsstech/react-native-skeleton' {
  export { default } from '@thevsstech/react-native-skeleton/lib/Skeleton';
}

import { StyleSheet } from 'react-native';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

// Shared by Login, Forgot password and Enter code (row 17, spec 0039, AC-5),
// built from the design system's tokens.
export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space['6'],
    paddingVertical: space['8'],
  },
  topBar: {
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
  },
  backButton: {
    width: control.xl,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: space['8'],
  },
  // LogoBadge is a wide pill, so the box is wide too (the logo stays until the
  // co-op has its own, AC-5).
  logo: {
    width: 200,
    height: 72,
    resizeMode: 'contain',
    marginBottom: space['4'],
  },
  coopName: {
    ...typeScale.h2,
    color: color.foreground,
    textAlign: 'center',
  },
  title: {
    ...typeScale.h2,
    color: color.foreground,
    marginBottom: space['2'],
  },
  subtitle: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    textAlign: 'center',
    marginTop: space['1'],
  },
  body: {
    ...typeScale.body,
    color: color['muted-foreground'],
    marginBottom: space['6'],
  },
  field: {
    marginBottom: space['3'],
  },
  hint: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    marginTop: -space['2'],
    marginBottom: space['4'],
  },
  primaryButton: {
    marginTop: space['3'],
    borderRadius: radius.lg,
  },
  link: {
    minHeight: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space['2'],
  },
  linkText: {
    ...typeScale.body,
    fontWeight: '600',
    color: color.foreground,
    textDecorationLine: 'underline',
  },
  linkTextDisabled: {
    color: color['muted-foreground'],
    textDecorationLine: 'none',
  },
  notice: {
    backgroundColor: color['destructive-soft'],
    borderRadius: radius.md,
    padding: space['4'],
    marginBottom: space['4'],
  },
  noticeText: {
    ...typeScale['body-sm'],
    color: color.destructive,
  },
  confirmation: {
    ...typeScale['body-sm'],
    color: color.success,
    textAlign: 'center',
    marginTop: space['2'],
  },
});

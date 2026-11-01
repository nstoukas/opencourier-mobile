import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
    padding: 20,
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: color.destructive,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  bannerTitle: {
    ...typeScale.h2,
    color: color['destructive-foreground'],
  },
  bannerText: {
    ...typeScale.body,
    color: color['destructive-foreground'],
    marginTop: 4,
  },
  pay: {
    ...typeScale.h3,
    color: color.foreground,
    marginBottom: 16,
  },
  instructionTitle: {
    ...typeScale.overline,
    color: color['muted-foreground'],
    marginBottom: 4,
  },
  instruction: {
    ...typeScale.lead,
    color: color.foreground,
    marginBottom: 4,
  },
  address: {
    ...typeScale.body,
    color: color['muted-foreground'],
    marginBottom: 16,
  },
  button: {
    marginTop: 12,
  },
  noteInput: {
    ...typeScale.body,
    borderWidth: 1,
    borderColor: color.input,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 96,
    textAlignVertical: 'top',
    color: color.foreground,
    marginTop: 8,
  },
  error: {
    ...typeScale['body-sm'],
    color: color.destructive,
    marginTop: 12,
  },
});

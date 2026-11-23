import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  // Centred, but kept 48 px clear of each side so a long (Greek) title never runs under the
  // 40 px back button; the screen also lets it shrink its letters to fit one line.
  title: {
    position: 'absolute',
    left: 48,
    right: 48,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: typeScale.h2.fontSize,
    color: color.foreground,
  },
  about: {
    textAlign: 'center',
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
    marginTop: 4,
  },
  keyboardArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: {
    fontSize: typeScale.body.fontSize,
    color: color['muted-foreground'],
    textAlign: 'center',
  },
  mineRow: {
    alignItems: 'flex-end',
  },
  theirsRow: {
    alignItems: 'flex-start',
  },
  systemRow: {
    alignItems: 'center',
  },
  mineBubble: {
    maxWidth: '85%',
    backgroundColor: color.primary,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mineSending: {
    opacity: 0.6,
  },
  mineText: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    color: color['primary-foreground'],
  },
  theirsBubble: {
    maxWidth: '85%',
    backgroundColor: color.secondary,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  theirsText: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    color: color.foreground,
  },
  systemBubble: {
    maxWidth: '90%',
    backgroundColor: color.muted,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  systemText: {
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
    textAlign: 'center',
  },
  meta: {
    marginTop: 4,
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
  },
  failed: {
    marginTop: 4,
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    color: color.destructive,
    paddingVertical: 8,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    backgroundColor: color.background,
  },
  presets: {
    gap: 8,
    paddingRight: 16,
  },
  preset: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    backgroundColor: color.background,
  },
  presetText: {
    fontSize: typeScale.label.fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: color.input,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typeScale.body.fontSize,
    color: color.foreground,
  },
  // flexShrink 0: the text box gives way, never the button, so "Αποστολή" stays whole.
  send: {
    minHeight: 48,
    minWidth: 72,
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
});

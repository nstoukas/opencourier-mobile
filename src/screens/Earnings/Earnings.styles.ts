import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray14,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  title: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
    // Wraps to a second line rather than running off the screen (long Greek titles).
    flexShrink: 1,
  },
  // Spec 0038: the link to "How offers and pay work".
  // Centred like every button; the words wrap so the "New" tag stays on screen.
  howLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    minHeight: control.xl,
  },
  howLinkText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
    color: Colors.black1,
    textDecorationLine: 'underline',
  },
  howLinkNew: {
    flexShrink: 0,
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: Colors.white,
    backgroundColor: color.success,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingBottom: space['8'],
  },
  // Spec 0042 (AC-6): the Day | Week switch.
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: color.secondary,
    padding: space['1'],
    marginBottom: space['3'],
  },
  modeButton: {
    flex: 1,
    height: control.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  modeButtonActive: {
    backgroundColor: color.card,
  },
  modeText: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: color['muted-foreground'],
  },
  modeTextActive: {
    color: color.foreground,
  },
  // The picked period with its back and forward arrows; tapping it opens the calendar.
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space['3'],
  },
  periodArrow: {
    width: control.xl,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabel: {
    flex: 1,
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['2'],
  },
  periodText: {
    fontSize: typeScale.h4.fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
  calendar: {
    marginBottom: space['3'],
  },
  // The figures (AC-1).
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: color.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: space['4'],
  },
  total: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  totalNote: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color['muted-foreground'],
    marginBottom: space['3'],
  },
  figureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  figure: {
    width: '50%',
    paddingVertical: space['2'],
    paddingRight: space['2'],
  },
  figureValue: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  figureLabel: {
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
  },
  line: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color.foreground,
  },
  muted: {
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
    marginTop: 2,
  },
  notice: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color['muted-foreground'],
    marginVertical: space['2'],
  },
  // A day's title in the Week view.
  dayTitle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: color.foreground,
    marginTop: space['4'],
    marginBottom: space['1'],
  },
  group: {
    borderRadius: radius['2xl'],
    backgroundColor: color.card,
    marginBottom: space['3'],
    overflow: 'hidden',
  },
  shiftInGroup: {
    marginTop: 0,
  },
  groupTitle: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
    color: color.foreground,
    padding: space['3'],
  },
  // One job row (AC-8).
  job: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: control.xl,
    paddingVertical: space['2'],
    paddingHorizontal: space['3'],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  jobTime: {
    width: 48,
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
  jobMain: {
    flex: 1,
    paddingRight: space['2'],
  },
  jobPlaces: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color.foreground,
  },
  jobMoney: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
});

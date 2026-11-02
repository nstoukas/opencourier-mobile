import { Colors } from '@app/styles/colors';
import { color, radius, typeScale } from '@app/styles/theme';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.gray1,
    marginHorizontal: 16,
    borderRadius: radius.xl,
    marginVertical: 8,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  separator: {
    height: 2,
    backgroundColor: Colors.gray1,
    marginVertical: 12,
  },
  buttonAddress: {
    width: 32,
    height: 32,
    backgroundColor: Colors.gray7,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  map: {
    width: 143,
    height: 138,
    borderRadius: radius.xl,
    backgroundColor: Colors.gray1,
    marginRight: 16,
  },
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  iconGrayRestaurant: {
    // width: 32,
    // height: 32,
    marginLeft: 2,
  },
  iconCaret: {
    // width: 32,
    // height: 32,
  },
  containerContentRestaurant: {
    flexDirection: 'row',
  },
  containerLeft: {
    alignItems: 'center',
    marginRight: 8,
    width: 32,
  },
  containerAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  verticalLine: {
    width: 3,
    backgroundColor: Colors.gray7,
    flex: 1,
    marginBottom: 12,
  },
  textAddress: {
    fontSize: typeScale.body.fontSize,
    marginRight: 8,
    lineHeight: typeScale.body.lineHeight,
    flex: 1,
  },
  textName: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    flex: 1,
    marginLeft: 8,
  },
  buttonCarret: {
    alignItems: 'flex-end',
  },
  containerInfo: {
    flex: 1,
  },
  containerInstructions: {
    marginTop: 4,
    overflow: 'hidden',
  },
  containerNotes: {
    marginTop: 8,
  },
  instruction: {
    borderWidth: 1,
    borderColor: Colors.black1,
    borderRadius: radius.sm,
    marginVertical: 5,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  buttonTop: {
    marginTop: 12,
    marginBottom: 16,
  },
  colapsable: {
    overflow: 'hidden',
  },
  textInstruction: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '500',
  },
  buttonAddNote: {
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 4,
    backgroundColor: Colors.gray6,
    flexDirection: 'row',
    marginVertical: 5,
    alignSelf: 'flex-start',
  },
  textAddNote: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '500',
    color: color['muted-foreground'],
    marginLeft: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  notesDash: {
    height: 1,
    backgroundColor: Colors.gray9,
    flex: 1,
    marginLeft: 8,
  },
  textNotesHeader: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '400',
    color: Colors.black4,
  },
  addNote: {
    borderRadius: radius.md,
    width: 32,
    height: 32,
    backgroundColor: Colors.gray1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  blueSeparator: {
    height: 3,
    backgroundColor: Colors.blue4,
    flex: 1,
    marginBottom: 16,
  },
  nextStep: {
    backgroundColor: Colors.blue5,
    paddingBottom: 12,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 12,
  },
  textNextStep: {
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 8,
  },
  // Row 72: the dispatch call, spaced like the step buttons below it.
  dispatchButton: {
    marginHorizontal: 12,
    marginTop: 10,
  },
  // Spec 0016: floor and doorbell, larger than the notes so the rider reads them at a glance.
  dropoffDetail: {
    ...typeScale.h4,
    color: color.foreground,
    marginTop: 6,
  },
  movePinButton: {
    marginTop: 10,
  },
});

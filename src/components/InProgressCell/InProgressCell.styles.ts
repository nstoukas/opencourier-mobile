import { Colors } from '@app/styles/colors';
import { color } from '@app/styles/theme';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.gray1,
    marginHorizontal: 16,
    borderRadius: 12,
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
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconAddressButton: {
    width: 14,
    hegiht: 14,
    tintColor: Colors.black1,
  },
  containerMap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  map: {
    width: 143,
    height: 138,
    borderRadius: 12,
    backgroundColor: Colors.gray1,
    marginRight: 16,
  },
  textDistance: {
    fontSize: 16,
    marginLeft: 8,
  },
  containerAway: {},
  containerTextAway: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 16,
    marginRight: 8,
    lineHeight: 18,
    flex: 1,
  },
  textName: {
    fontWeight: '700',
    fontSize: 16,
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
    borderRadius: 4,
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
    fontSize: 14,
    fontWeight: '500',
  },
  buttonAddNote: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 4,
    backgroundColor: Colors.gray6,
    flexDirection: 'row',
    marginVertical: 5,
    alignSelf: 'flex-start',
  },
  textAddNote: {
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '400',
    color: Colors.black4,
  },
  addNote: {
    borderRadius: 8,
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
});

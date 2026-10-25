import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.gray1,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  textPrice: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.black3,
    textAlign: 'center',
  },
  textWaiting: {
    fontSize: 16,
    color: Colors.black7,
    textAlign: 'center',
    marginTop: 4,
  },
  separator: {
    height: 2,
    backgroundColor: Colors.gray1,
    marginVertical: 12,
  },
  buttonTop: {
    marginBottom: 12,
  },
  content: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  containerLeft: {
    alignItems: 'center',
    marginRight: 8,
  },
  verticalLine: {
    width: 3,
    backgroundColor: Colors.gray7,
    height: 173,
    marginVertical: 16,
  },
  containerRight: {
    flex: 1,
  },
  containerAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textName: {
    fontWeight: '700',
    fontSize: 16,
  },
  textAddress: {
    fontSize: 16,
  },
  containerText: {
    flex: 1,
  },
  containerChats: {
    width: 32,
    height: 32,
    backgroundColor: Colors.white,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black1,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    elevation: 3,
  },
  containerMap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
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
  containerLoader: {
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    bottom: 0,
    right: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  progress: {
    backgroundColor: Colors.gray6,
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
});

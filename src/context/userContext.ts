import { createContext } from 'react';

interface Props {
  locationPermission: boolean;
  setLocationPermission: (locationPermission: boolean) => void;
  userLatitude: number | null;
  setUserLatitude: (latitude: number | null) => void;
  userLongitude: number | null;
  setUserLongitude: (longitude: number | null) => void;
}

const defaultAuthProps: Props = {
  locationPermission: false,
  setLocationPermission: () => {},
  userLatitude: null,
  setUserLatitude: () => {},
  userLongitude: null,
  setUserLongitude: () => {},
};

const UserContext = createContext<Props>(defaultAuthProps);

export default UserContext;

import React, { useState } from 'react';
import { Router } from '@app/navigation/router';
import { NavigationContainer } from '@react-navigation/native';
import UserContext from '@app/context/userContext';
import { QueryClientProvider } from '@tanstack/react-query';
import SocketProvider from '@app/services/socket';
import { queryClient } from '@app/services/queryClient';
import { navigationRef } from '@app/navigation/navigationRef';

if (__DEV__) {
  require('./ReactotronConfig');
}

const App = () => {
  const [watchId, setWatchId] = useState<number | undefined>(undefined);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [userLatitude, setUserLatitude] = useState<number | null>(null);
  const [userLongitude, setUserLongitude] = useState<number | null>(null);

  return (
    <UserContext.Provider
      value={{
        watchId,
        setWatchId,
        locationPermission,
        setLocationPermission,
        userLatitude,
        setUserLatitude,
        userLongitude,
        setUserLongitude,
      }}>
      <QueryClientProvider client={queryClient}>
        {/* The ref lets code outside the screens ask which screen is in front
            (the offer alert's foreground rule, row 58). */}
        <NavigationContainer ref={navigationRef}>
          {/* Wraps the screens so the home screen can read the connection status. */}
          <SocketProvider>
            <Router />
          </SocketProvider>
        </NavigationContainer>
      </QueryClientProvider>
    </UserContext.Provider>
  );
};

export default App;

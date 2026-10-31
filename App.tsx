import React, { useState } from 'react';
import { Router } from '@app/navigation/router';
import { NavigationContainer } from '@react-navigation/native';
import UserContext from '@app/context/userContext';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import SocketProvider from '@app/services/socket';
import { queryClient } from '@app/services/queryClient';
import { persistOptions } from '@app/services/queryPersistence';
import { navigationRef } from '@app/navigation/navigationRef';
import { installSessionRefresh } from '@app/services/session';
import { client } from '@app/services/Client';
// Sets the one locale every date, time and amount uses (row 66).
import '@app/utilities/locale';

// Renew an expired login, or log the rider out with a message (row 66).
installSessionRefresh(client);

if (__DEV__) {
  require('./ReactotronConfig');
}

const App = () => {
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [userLatitude, setUserLatitude] = useState<number | null>(null);
  const [userLongitude, setUserLongitude] = useState<number | null>(null);

  return (
    <UserContext.Provider
      value={{
        locationPermission,
        setLocationPermission,
        userLatitude,
        setUserLatitude,
        userLongitude,
        setUserLongitude,
      }}>
      {/* Like QueryClientProvider, and it also keeps the rider's deliveries
          and earnings on the phone for 24 h, readable with no signal (spec 0009). */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}>
        {/* The ref lets code outside the screens ask which screen is in front
            (the offer alert's foreground rule, row 58). */}
        <NavigationContainer ref={navigationRef}>
          {/* Wraps the screens so the home screen can read the connection status. */}
          <SocketProvider>
            <Router />
          </SocketProvider>
        </NavigationContainer>
      </PersistQueryClientProvider>
    </UserContext.Provider>
  );
};

export default App;

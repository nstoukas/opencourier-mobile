import Geolocation from 'react-native-geolocation-service';
import { track } from './geo';
import { WatchOptions } from './locationTracking';

describe('geo track (Row 67, Clause 2)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  const testOptions: WatchOptions = {
    interval: 10000,
    fastestInterval: 10000,
    distanceFilter: 30,
    enableHighAccuracy: true,
  };

  it('passes options spread plus showsBackgroundLocationIndicator: true to watchPosition and returns watch id', () => {
    (Geolocation.watchPosition as jest.Mock).mockReturnValue(42);

    const onUpdate = jest.fn();
    const watchId = track(onUpdate, testOptions);

    expect(watchId).toBe(42);
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(Geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        interval: 10000,
        fastestInterval: 10000,
        distanceFilter: 30,
        showsBackgroundLocationIndicator: true,
      },
    );
  });

  it('spreads options without overriding enableHighAccuracy: false', () => {
    (Geolocation.watchPosition as jest.Mock).mockReturnValue(43);

    const waitingOptions: WatchOptions = {
      interval: 60000,
      fastestInterval: 30000,
      distanceFilter: 100,
      enableHighAccuracy: false,
    };

    const onUpdate = jest.fn();
    track(onUpdate, waitingOptions);

    expect(Geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        interval: 60000,
        fastestInterval: 30000,
        distanceFilter: 100,
        showsBackgroundLocationIndicator: true,
      },
    );
  });

  it('calls getCurrentPosition immediately with high accuracy and standard timeout', () => {
    const onUpdate = jest.fn();
    track(onUpdate, testOptions);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });

  it('converts watchPosition coords [latitude, longitude] to geojson Point [longitude, latitude]', () => {
    let watchSuccessCb: ((pos: any) => void) | undefined;
    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void) => {
        watchSuccessCb = success;
        return 123;
      },
    );

    const onUpdate = jest.fn();
    track(onUpdate, testOptions);

    expect(watchSuccessCb).toBeDefined();
    watchSuccessCb!({
      coords: {
        latitude: 39.362,
        longitude: 22.945,
      },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      type: 'Point',
      coordinates: [22.945, 39.362],
    });
  });

  it('converts getCurrentPosition coords [latitude, longitude] to geojson Point [longitude, latitude]', () => {
    let getSuccessCb: ((pos: any) => void) | undefined;
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void) => {
        getSuccessCb = success;
      },
    );

    const onUpdate = jest.fn();
    track(onUpdate, testOptions);

    expect(getSuccessCb).toBeDefined();
    getSuccessCb!({
      coords: {
        latitude: 37.983,
        longitude: 23.727,
      },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      type: 'Point',
      coordinates: [23.727, 37.983],
    });
  });
});

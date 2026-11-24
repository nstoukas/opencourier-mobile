import Geolocation from 'react-native-geolocation-service';
import { track } from './geo';
import { WatchOptions } from './locationTracking';

describe('geo track (Row 67, Clause 2 & Row 156)', () => {
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

  it('passes options spread plus showsBackgroundLocationIndicator: true and showLocationDialog: false to watchPosition and returns watch id', () => {
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
        showLocationDialog: false,
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
        showLocationDialog: false,
        showsBackgroundLocationIndicator: true,
      },
    );
  });

  it('calls getCurrentPosition immediately with high accuracy, standard timeout, and showLocationDialog: false', () => {
    const onUpdate = jest.fn();
    track(onUpdate, testOptions);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        showLocationDialog: false,
      },
    );
  });

  it('passes showLocationDialog: false to both getCurrentPosition and watchPosition so Google dialog never opens by itself (row 156 review)', () => {
    const onUpdate = jest.fn();
    track(onUpdate, testOptions);

    const getCurrentPositionOptions = (Geolocation.getCurrentPosition as jest.Mock).mock.calls[0][2];
    const watchPositionOptions = (Geolocation.watchPosition as jest.Mock).mock.calls[0][2];

    expect(getCurrentPositionOptions.showLocationDialog).toBe(false);
    expect(watchPositionOptions.showLocationDialog).toBe(false);
  });

  it('passes error code to onError and logs to console.error when watchPosition reports an error (row 156)', () => {
    let watchErrorCb: ((err: any) => void) | undefined;
    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (_success: any, error: (err: any) => void) => {
        watchErrorCb = error;
        return 101;
      },
    );

    const onUpdate = jest.fn();
    const onError = jest.fn();
    track(onUpdate, testOptions, onError);

    expect(watchErrorCb).toBeDefined();
    const geoError = {
      code: 2,
      message: 'Location provider is disabled',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };
    watchErrorCb!(geoError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(2);
    expect(errorSpy).toHaveBeenCalledWith('Location error: ', geoError);
  });

  it('passes error code to onError and logs to console.error when getCurrentPosition reports an error (row 156)', () => {
    let getCurrentErrorCb: ((err: any) => void) | undefined;
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (_success: any, error: (err: any) => void) => {
        getCurrentErrorCb = error;
      },
    );

    const onUpdate = jest.fn();
    const onError = jest.fn();
    track(onUpdate, testOptions, onError);

    expect(getCurrentErrorCb).toBeDefined();
    const geoError = {
      code: 5,
      message: 'Location settings not satisfied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };
    getCurrentErrorCb!(geoError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(5);
    expect(errorSpy).toHaveBeenCalledWith('Location error: ', geoError);
  });

  it('handles error safely without throwing when onError is not provided', () => {
    let watchErrorCb: ((err: any) => void) | undefined;
    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (_success: any, error: (err: any) => void) => {
        watchErrorCb = error;
        return 102;
      },
    );

    const onUpdate = jest.fn();
    track(onUpdate, testOptions); // no onError passed

    expect(() => {
      watchErrorCb!({ code: 3, message: 'Timeout' });
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith('Location error: ', { code: 3, message: 'Timeout' });
  });

  it('converts watchPosition coords [latitude, longitude] to geojson Point [longitude, latitude] and passes fix info', () => {
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
    const before = Date.now();
    watchSuccessCb!({
      coords: {
        latitude: 39.362,
        longitude: 22.945,
        accuracy: 14.5,
      },
    });
    const after = Date.now();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      {
        type: 'Point',
        coordinates: [22.945, 39.362],
      },
      {
        accuracyMetres: 14.5,
        at: expect.any(Number),
      },
    );
    const passedAt = onUpdate.mock.calls[0][1].at;
    expect(passedAt).toBeGreaterThanOrEqual(before);
    expect(passedAt).toBeLessThanOrEqual(after);
  });

  it('converts getCurrentPosition coords [latitude, longitude] to geojson Point [longitude, latitude] with null accuracy if missing', () => {
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

    expect(onUpdate).toHaveBeenCalledWith(
      {
        type: 'Point',
        coordinates: [23.727, 37.983],
      },
      {
        accuracyMetres: null,
        at: expect.any(Number),
      },
    );
  });
});

import axios from 'axios';
import { UClient } from './Client';

// Spec 0022. A rider's own SOS on the co-op's backend (`courier/v1/sos`).

// The state the server reports: active (the phone shares its position),
// awaiting close (the rider ended it, an admin has not closed it yet), closed.
export type SosIncidentState = 'ACTIVE' | 'AWAITING_CLOSE' | 'CLOSED';

export type SosIncident = {
  id: string;
  state: SosIncidentState;
  deliveryId: string | null;
  startedAt: string;
};

export type SosPointToSend = {
  latitude: number;
  longitude: number;
  accuracyMetres?: number;
  // How long before sending the phone took the fix, in milliseconds.
  ageMs: number;
};

// The error codes the server sends with a 409: the SOS is no longer active
// (points after it ended), or an admin already closed it.
export const SOS_NOT_ACTIVE_CODE = 'SOS_NOT_ACTIVE';
export const SOS_CLOSED_CODE = 'SOS_CLOSED';

// What came back from one request: the server's answer, an error status with
// its code, or nothing at all (no signal, a timeout).
export type SosAnswer<T> =
  | { kind: 'ok'; result: T }
  | { kind: 'error'; httpStatus: number; code?: string }
  | { kind: 'none' };

// Turns a request into an answer the sender can sort, never a thrown error.
// The server's error body looks like { error: true, result: [{ code, ... }] }.
const answerOf = async <T>(
  request: () => Promise<T>,
): Promise<SosAnswer<T>> => {
  try {
    return { kind: 'ok', result: await request() };
  } catch (error) {
    // `axios.isAxiosError` tells TypeScript that `error` has `response` below.
    if (axios.isAxiosError(error) && error.response) {
      const result = error.response.data?.result;
      const code =
        Array.isArray(result) && typeof result[0]?.code === 'string'
          ? (result[0].code as string)
          : undefined;
      return { kind: 'error', httpStatus: error.response.status, code };
    }
    return { kind: 'none' };
  }
};

export interface SosService {
  start: (body: {
    clientId: string;
    tapAgeMs: number;
    deliveryId?: string;
  }) => Promise<SosAnswer<SosIncident>>;
  // The rider's active SOS, or null. Throws on no signal (asked at launch).
  getActive: () => Promise<SosIncident | null>;
  sendPoints: (
    incidentId: string,
    points: SosPointToSend[],
  ) => Promise<SosAnswer<{ accepted: number }>>;
  end: (
    incidentId: string,
    kind: 'safe' | 'falseAlarm',
    tapAgeMs: number,
  ) => Promise<SosAnswer<SosIncident>>;
}

const sosService = (client: UClient): SosService => {
  const start: SosService['start'] = body =>
    answerOf(async () => (await client.post('sos', body)).data.result);

  const getActive = async (): Promise<SosIncident | null> => {
    const { data } = await client.get('sos/active');
    return data.result ?? null;
  };

  const sendPoints: SosService['sendPoints'] = (incidentId, points) =>
    answerOf(
      async () =>
        (await client.post(`sos/${incidentId}/points`, { points })).data.result,
    );

  const end: SosService['end'] = (incidentId, kind, tapAgeMs) =>
    answerOf(
      async () =>
        (
          await client.post(
            `sos/${incidentId}/${kind === 'safe' ? 'safe' : 'false-alarm'}`,
            { tapAgeMs },
          )
        ).data.result,
    );

  return { start, getActive, sendPoints, end };
};

export default sosService;

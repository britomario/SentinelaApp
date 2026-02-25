import {io, Socket} from 'socket.io-client';
import {getEnv} from '../config/env';
import {captureHandledError} from '../observability/sentry';

type LocationPayload = {
  childId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
};

let socketInstance: Socket | null = null;

function getSocketBaseUrl(): string | null {
  return getEnv('REALTIME_SOCKET_URL') ?? getEnv('SYNC_API_BASE_URL');
}

export function getRealtimeSocket(): Socket | null {
  if (socketInstance) {
    return socketInstance;
  }
  const baseUrl = getSocketBaseUrl();
  if (!baseUrl) {
    return null;
  }

  socketInstance = io(baseUrl, {
    transports: ['websocket'],
    path: '/realtime',
    reconnection: true,
    timeout: 6000,
  });

  return socketInstance;
}

export function subscribeToChildLocation(
  childId: string,
  onData: (payload: LocationPayload) => void,
): () => void {
  const socket = getRealtimeSocket();
  if (!socket) {
    const intervalId = setInterval(() => {
      fetchLatestChildLocation(childId)
        .then(data => {
          if (data) {
            onData(data);
          }
        })
        .catch(() => undefined);
    }, 6000);
    return () => clearInterval(intervalId);
  }

  const eventName = `child:location:${childId}`;
  socket.on(eventName, onData);
  socket.emit('child:join', {childId});
  return () => {
    socket.off(eventName, onData);
    socket.emit('child:leave', {childId});
  };
}

export async function publishChildLocation(payload: LocationPayload): Promise<boolean> {
  const socket = getRealtimeSocket();
  if (socket?.connected) {
    socket.emit('child:location:update', payload);
  }

  const baseUrl = getEnv('SYNC_API_BASE_URL');
  if (!baseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/api/realtime/location`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    captureHandledError(error, 'realtime_publish_location');
    return false;
  }
}

async function fetchLatestChildLocation(
  childId: string,
): Promise<LocationPayload | null> {
  const baseUrl = getEnv('SYNC_API_BASE_URL');
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/realtime/location?childId=${encodeURIComponent(childId)}`,
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as LocationPayload | null;
    return data;
  } catch (error) {
    captureHandledError(error, 'realtime_fetch_location');
    return null;
  }
}

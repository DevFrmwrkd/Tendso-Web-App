/** Push payloads select an owned inbox message, never an arbitrary URL or app route. */
export function notificationRouteId(value: unknown): string | undefined {
  const single = Array.isArray(value) && value.length === 1 ? value[0] : value;
  return typeof single === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(single) ? single : undefined;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function notificationResponseKey(value: unknown): string | null {
  const response = record(value);
  const request = record(record(response?.notification)?.request);
  const identifier = request?.identifier;
  const action = response?.actionIdentifier;
  if (typeof identifier !== 'string' || !identifier || identifier.length > 512
    || typeof action !== 'string' || action.length > 128) return null;
  return JSON.stringify([identifier, action]);
}

export function notificationOpenTarget(value: unknown, defaultAction: string) {
  const response = record(value);
  if (response?.actionIdentifier !== defaultAction) return null;
  const key = notificationResponseKey(value);
  const request = record(record(response.notification)?.request);
  const data = record(record(request?.content)?.data);
  const notificationId = typeof data?.notificationId === 'string' ? notificationRouteId(data.notificationId) : undefined;
  const creatorId = typeof data?.creatorId === 'string' ? notificationRouteId(data.creatorId) : undefined;
  if (!key || !notificationId || (data?.creatorId !== undefined && !creatorId)) return null;
  return { key, notificationId, creatorId };
}

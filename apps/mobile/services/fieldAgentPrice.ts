import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_PRICE, PRICE_CEILING } from '@tendso/shared/pricing';

export type FieldAgentPriceActor = { clerkId: string; creatorId: string };
export const FIELD_AGENT_PRICE_OPTIONS = [999, 1999, 2999, 3999, 4999] as const;

/** An account preference, separate from the frozen price of any capture. */
export function fieldAgentPriceKey(actor: FieldAgentPriceActor): string {
  return `field-agent-price:v1:${encodeURIComponent(actor.clerkId)}:${encodeURIComponent(actor.creatorId)}`;
}

export function validFieldAgentPrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
    && value >= BASE_PRICE && value <= PRICE_CEILING ? value : null;
}

const listeners = new Set<(key: string, price: number) => void>();
export function subscribeFieldAgentPrice(listener: (key: string, price: number) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function readFieldAgentPrice(actor: FieldAgentPriceActor): Promise<number> {
  const raw = await AsyncStorage.getItem(fieldAgentPriceKey(actor));
  if (raw === null) return BASE_PRICE;
  try { return validFieldAgentPrice(JSON.parse(raw)) ?? BASE_PRICE; }
  catch { return BASE_PRICE; }
}

export async function writeFieldAgentPrice(actor: FieldAgentPriceActor, price: number): Promise<void> {
  if (validFieldAgentPrice(price) === null) throw new Error('Choose a whole-peso price between ₱999 and ₱4,999.');
  const key = fieldAgentPriceKey(actor);
  await AsyncStorage.setItem(key, JSON.stringify(price));
  listeners.forEach(listener => listener(key, price));
}

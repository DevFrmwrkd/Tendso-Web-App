import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_PRICE } from '@tendso/shared/pricing';
import { fieldAgentPriceKey, readFieldAgentPrice, subscribeFieldAgentPrice, validFieldAgentPrice,
  writeFieldAgentPrice, type FieldAgentPriceActor } from '../services/fieldAgentPrice';

type PriceState = { key: string | null; price: number; loaded: boolean; saving: boolean; error: string };

export function useFieldAgentPrice(actor: FieldAgentPriceActor | null) {
  const key = actor ? fieldAgentPriceKey(actor) : null;
  const live = useRef(key);
  live.current = key;
  const mounted = useRef(true);
  const revision = useRef(0);
  const busy = useRef<{ key: string; token: symbol } | null>(null);
  const [state, setState] = useState<PriceState>({ key: null, price: BASE_PRICE, loaded: false, saving: false, error: '' });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    const request = ++revision.current;
    setState({ key, price: BASE_PRICE, loaded: !key, saving: false, error: '' });
    if (!actor || !key) return;
    const unsubscribe = subscribeFieldAgentPrice((changedKey, price) => {
      if (!active || live.current !== key || changedKey !== key) return;
      ++revision.current;
      setState(previous => ({ ...previous, key, price, loaded: true, error: '' }));
    });
    void readFieldAgentPrice(actor).then(price => {
      if (active && live.current === key && revision.current === request) {
        setState({ key, price, loaded: true, saving: false, error: '' });
      }
    }).catch(() => {
      if (active && live.current === key && revision.current === request) {
        setState({ key, price: BASE_PRICE, loaded: true, saving: false, error: 'Could not load your default price. Try again.' });
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [key]);

  const setPrice = useCallback(async (price: number): Promise<boolean> => {
    if (!actor || !key || live.current !== key || !mounted.current || state.key !== key || !state.loaded
      || busy.current?.key === key) return false;
    if (validFieldAgentPrice(price) === null) {
      setState(previous => ({ ...previous, error: 'Choose a whole-peso price between ₱999 and ₱4,999.' }));
      return false;
    }
    const token = Symbol('save-price');
    busy.current = { key, token };
    ++revision.current;
    setState(previous => ({ ...previous, saving: true, error: '' }));
    try {
      await writeFieldAgentPrice(actor, price);
      if (!mounted.current || live.current !== key || busy.current?.token !== token) return false;
      setState({ key, price, loaded: true, saving: false, error: '' });
      return true;
    } catch {
      if (mounted.current && live.current === key && busy.current?.token === token) {
        setState(previous => ({ ...previous, saving: false, error: 'Could not save your default price. Try again.' }));
      }
      return false;
    } finally { if (busy.current?.token === token) busy.current = null; }
  }, [key, state.key, state.loaded]);

  return state.key === key ? { ...state, setPrice }
    : { price: BASE_PRICE, loaded: false, saving: false, error: '', setPrice };
}

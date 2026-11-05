import { act, renderHook } from '@testing-library/react-native';
import { useOwnerVisitRequests, useOwnerVisit, useAssignedVisit, useCreateVisitRequest, validVisitPhone, validVisitPin, visitPhoneLink } from '../lib/v2/visitRequests';

let mockSubject: string | null, mockValue: any;
const mockQuery = jest.fn(), mockMutation = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('convex/react', () => ({ useQuery: (ref: string, args: unknown) => { mockQuery(ref, args); return mockValue; }, useMutation: () => mockMutation }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
beforeEach(() => { jest.clearAllMocks(); mockSubject = 'owner-clerk'; mockValue = null; });

it('does not expose a cached foreign actor’s owner visit list', () => {
  mockValue = { actorClerkId: 'previous-clerk', ownerId: 'old-owner', requests: [{ shopName: 'Private old shop' }] };
  expect(renderHook(() => useOwnerVisitRequests()).result.current).toEqual([]);
});

it('filters every owner visit row against both the actor and envelope owner', () => {
  mockValue = { actorClerkId: mockSubject, ownerId: 'owner-row', requests: [
    { _id: 'own', actorClerkId: mockSubject, ownerId: 'owner-row' },
    { _id: 'foreign-owner', actorClerkId: mockSubject, ownerId: 'foreign' },
    { _id: 'foreign-actor', actorClerkId: 'previous-clerk', ownerId: 'owner-row' },
  ] };
  expect(renderHook(() => useOwnerVisitRequests()).result.current?.map(item => item._id)).toEqual(['own']);
});

it('withholds a cached detail when the visit id or actor differs', () => {
  mockValue = { _id: 'other', actorClerkId: mockSubject };
  expect(renderHook(() => useOwnerVisit('visit-1' as never)).result.current).toBeNull();
  mockValue = { _id: 'visit-1', actorClerkId: 'another-clerk' };
  expect(renderHook(() => useOwnerVisit('visit-1' as never)).result.current).toBeNull();
});

it('skips assigned data for an ineligible agent even if an old snapshot exists', () => {
  mockValue = { _id: 'visit-1', actorClerkId: mockSubject };
  expect(renderHook(() => useAssignedVisit('visit-1' as never, false)).result.current).toBeNull();
  expect(mockQuery).toHaveBeenCalledWith('visitRequests:getAssigned', 'skip');
});

it('injects the actual authenticated actor into create and rejects a foreign returned projection', async () => {
  mockMutation.mockResolvedValue({ _id: 'visit-1', actorClerkId: 'other-clerk' });
  const hook = renderHook(() => useCreateVisitRequest());
  let message = '';
  await act(async () => { try { await hook.result.current({ requestKey: 'test-request-key' } as never); } catch (cause) { message = (cause as Error).message; } });
  expect(mockMutation).toHaveBeenCalledWith({ requestKey: 'test-request-key', clerkId: 'owner-clerk' });
  expect(message).toContain('Your account changed');
});

it('validates Philippine mobile formats and pin bounds without reusing arbitrary coordinates', () => {
  for (const value of ['09171234567', '9171234567', '+63 917 123 4567']) expect(validVisitPhone(value)).toBe(true);
  for (const value of ['1234567', '0917', '+1 650 123 4567']) expect(validVisitPhone(value)).toBe(false);
  expect(validVisitPin({ lat: 14.6, lng: 121.1 })).toBe(true); expect(validVisitPin({ lat: 0, lng: 0 })).toBe(false);
  expect(visitPhoneLink('09171234567')).toBe('tel:+639171234567');
});

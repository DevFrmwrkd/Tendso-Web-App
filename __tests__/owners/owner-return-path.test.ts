import { describe, expect, it } from 'vitest';
import { ownerReturnPath } from '../../lib/ownerReturnPath';

describe('owner sign-in deep links', () => {
    it.each([
        '/my-business/today', '/my-business/visits', '/my-business/visits/visit-one',
        '/my-business/visits/new?submissionId=owned-business',
        '/my-business/notifications?eventKey=visit%3Aevent-one',
        '/my-business/notifications?eventKey=site%3Aowned-business%3Apayment%3A1800000000',
    ])('retains the known owner destination %s', path => {
        expect(ownerReturnPath(path)).toBe(path);
    });

    it.each([
        'https://other.example/my-business/today', '//other.example/my-business',
        '/my-business/sign-in', '/my-business/../admin', '/my-business/%2e%2e/today',
        '/my-business/visits/../../admin', '/my-business/visits/%2Fadmin',
        '/my-business/today#admin', '/my-business/today?redirect=/admin',
        '/my-business/notifications?eventKey=one&eventKey=two',
        '/my-business/notifications?eventKey=one&next=/admin',
        '/my-business/notifications?eventKey=https%3A%2F%2Fother.example',
        '/my-business/notifications?eventKey=%0Aadmin',
        '/my-business/visits/new?submissionId=../foreign',
        '/my-business/visits/new?submissionId=one&submissionId=two',
        '/my-business/visits/new?eventKey=one',
        '/my-business/notifications?eventKey=' + 'a'.repeat(513),
        '/my-business\\admin', '/my-business/ today',
    ])('rejects arbitrary, ambiguous or looping destinations %s', path => {
        expect(ownerReturnPath(path)).toBe('/my-business');
    });
});

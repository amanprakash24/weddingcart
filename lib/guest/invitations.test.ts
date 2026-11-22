/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { invitedEventIds, answersForInvited } from './invitations';

describe('invitedEventIds', () => {
  test('a guest with no rows is invited to every function (as before)', () => expect(invitedEventIds([], ['haldi', 'wedding'])).toEqual(['haldi', 'wedding']));
  test('otherwise only their functions, in the wedding’s order', () => expect(invitedEventIds(['reception', 'haldi'], ['haldi', 'wedding', 'reception'])).toEqual(['haldi', 'reception']));
  test('a row for a function no longer on the wedding is ignored', () => expect(invitedEventIds(['gone', 'haldi'], ['haldi', 'wedding'])).toEqual(['haldi']));
});

describe('answersForInvited', () => {
  test('answers for functions the guest is not invited to are dropped; one answer per function', () => {
    const answers = [{ weddingEventId: 'haldi', status: 'ATTENDING' }, { weddingEventId: 'wedding', status: 'ATTENDING' }, { weddingEventId: 'haldi', status: 'NOT_ATTENDING' }];
    expect(answersForInvited(answers, ['haldi'])).toEqual([{ weddingEventId: 'haldi', status: 'ATTENDING' }]);
  });
});

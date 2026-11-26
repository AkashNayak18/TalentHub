// Unit tests for the pure eligibility rules, including boundary values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEligibility } from '../src/services/eligibility.js';

const job = (min_cgpa = 7.0, max_active_backlogs = 2, allowed_branches = []) => ({ min_cgpa, max_active_backlogs, allowed_branches });
const student = (cgpa, active_backlogs, branch = 'CSE') => ({ cgpa, active_backlogs, branch });

test('example scenario: Rahul is eligible', () => {
  assert.equal(checkEligibility(student(8.2, 1), job()).eligible, true);
});

for (const [cgpa, expected] of [[7.0, true], [7.01, true], [6.99, false], [0.0, false]]) {
  test(`CGPA boundary ${cgpa} -> ${expected}`, () => {
    assert.equal(checkEligibility(student(cgpa, 0), job()).eligible, expected);
  });
}

for (const [backlogs, expected] of [[0, true], [2, true], [3, false]]) {
  test(`backlog boundary ${backlogs} -> ${expected}`, () => {
    assert.equal(checkEligibility(student(8.0, backlogs), job()).eligible, expected);
  });
}

test('branch restriction (case-insensitive)', () => {
  const j = job(7, 2, ['CSE', 'IT']);
  assert.equal(checkEligibility(student(8, 0, 'it'), j).eligible, true);
  const result = checkEligibility(student(8, 0, 'MECH'), j);
  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /Branch/);
});

test('empty branch list means all branches', () => {
  assert.equal(checkEligibility(student(8, 0, 'CIVIL'), job(7, 2, [])).eligible, true);
});

test('all failing reasons are reported', () => {
  assert.equal(checkEligibility(student(5.0, 5, 'MECH'), job(7, 2, ['CSE'])).reasons.length, 3);
});

test('messages format floats like the original app', () => {
  const [reason] = checkEligibility(student(6.99, 0), job()).reasons;
  assert.equal(reason, 'CGPA 6.99 is below the required minimum of 7.0');
});

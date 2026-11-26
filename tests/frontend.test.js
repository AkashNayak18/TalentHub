// The UI is served by the Node server, and the API returns what the UI needs to render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCompany, makeJob, makeStudent, withClient } from './helpers.js';

test('root redirects to /ui/ and UI assets are served', withClient(async (c) => {
  const r = await c.get('/');
  assert.ok([302, 307].includes(r.status));
  assert.equal(r.headers.get('location'), '/ui/');
  assert.match((await c.get('/ui/')).text, /TalentHub/);
  assert.equal((await c.get('/ui/app.js')).status, 200);
  assert.equal((await c.get('/ui/style.css')).status, 200);
}));

test('static server blocks path traversal and unknown files', withClient(async (c) => {
  assert.equal((await c.get('/ui/nope.js')).status, 404);
  assert.notEqual((await c.get('/ui/..%2f..%2fpackage.json')).status, 200);
  assert.notEqual((await c.get('/ui/../package.json')).status, 200);
}));

test('health endpoint and unknown routes', withClient(async (c) => {
  assert.deepEqual((await c.get('/health')).json, { status: 'ok' });
  assert.equal((await c.get('/nope')).status, 404);
  assert.equal((await c.request('DELETE', '/health')).status, 405);
}));

test('application payload includes student and job details', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  assert.equal(job.company_name, 'ABC Technologies');
  await c.post('/applications', { json: { job_id: job.id }, headers: stuH });

  const row = (await c.get(`/jobs/${job.id}/applications`, { headers: comp })).json[0];
  assert.equal(row.student.name, 'Rahul');
  assert.equal(row.student.cgpa, 8.2);
  assert.equal(row.job.title, 'Software Developer');
  assert.equal(row.interview, null);
  assert.equal(row.offer, null);
}));

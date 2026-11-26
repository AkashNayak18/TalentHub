import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/** Boots a fresh app on an ephemeral port with an in-memory database. */
export async function createClient() {
  const config = loadConfig({ databasePath: ':memory:', pbkdf2Iterations: 1000, secretKey: 'test-secret' });
  const { server, ready } = createApp(config);
  await ready;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { json, form, headers = {} } = {}) {
    const init = { method, headers: { ...headers }, redirect: 'manual' };
    if (json !== undefined) { init.body = JSON.stringify(json); init.headers['Content-Type'] = 'application/json'; }
    if (form) { init.body = new URLSearchParams(form).toString(); init.headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json: body };
  }

  return {
    config,
    request,
    get: (p, o) => request('GET', p, o),
    post: (p, o) => request('POST', p, o),
    put: (p, o) => request('PUT', p, o),
    patch: (p, o) => request('PATCH', p, o),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Run `fn(client)` with a fresh app and always clean up. */
export const withClient = (fn) => async () => {
  const client = await createClient();
  try { await fn(client); } finally { await client.close(); }
};

/* ---------- helpers ---------- */
export async function login(client, username, password) {
  const r = await client.post('/auth/login', { form: { username, password } });
  if (r.status !== 200) throw new Error(`login failed: ${r.status} ${r.text}`);
  return { Authorization: `Bearer ${r.json.access_token}` };
}

export async function makeStudent(client, { username = 'rahul', cgpa = 8.2, backlogs = 1, branch = 'CSE', name = 'Rahul' } = {}) {
  const r = await client.post('/auth/register/student', { json: {
    username, password: 'Password@123', name, branch, cgpa, active_backlogs: backlogs } });
  if (r.status !== 201) throw new Error(`register student failed: ${r.status} ${r.text}`);
  return [await login(client, username, 'Password@123'), r.json];
}

export async function makeCompany(client, username = 'abc', name = 'ABC Technologies') {
  const r = await client.post('/auth/register/company', { json: {
    username, password: 'Password@123', name, industry: 'IT' } });
  if (r.status !== 201) throw new Error(`register company failed: ${r.status} ${r.text}`);
  return login(client, username, 'Password@123');
}

export async function makeJob(client, companyHeaders, overrides = {}) {
  const payload = { title: 'Software Developer', package_lpa: 8.0, min_cgpa: 7.0,
    max_active_backlogs: 2, allowed_branches: [], ...overrides };
  const r = await client.post('/jobs', { json: payload, headers: companyHeaders });
  if (r.status !== 201) throw new Error(`create job failed: ${r.status} ${r.text}`);
  return r.json;
}

export const coordinator = (client) =>
  login(client, client.config.coordinatorUsername, client.config.coordinatorPassword);

export const future = (days = 2) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Apply -> shortlist -> schedule -> pass. Returns the application id. */
export async function advanceToSelected(client, studentH, companyH, jobId) {
  const created = await client.post('/applications', { json: { job_id: jobId }, headers: studentH });
  const appId = created.json.id;
  const steps = [
    [await client.post(`/applications/${appId}/shortlist`, { headers: companyH }), 200],
    [await client.post(`/applications/${appId}/interview`, { json: { scheduled_at: future() }, headers: companyH }), 201],
    [await client.put(`/applications/${appId}/interview/result`, { json: { result: 'PASSED', remarks: 'Good' }, headers: companyH }), 200],
  ];
  for (const [r, expected] of steps) if (r.status !== expected) throw new Error(`step failed: ${r.status} ${r.text}`);
  return appId;
}

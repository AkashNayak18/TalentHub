// Runs the ABC Technologies / Rahul scenario against a running server.
// Usage:  node scripts/demo-flow.js [base_url]      (start the server first: npm start)
const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const SUFFIX = new Date().toTimeString().slice(0, 8).replaceAll(':', ''); // unique usernames per run
const PASSWORD = 'Password@123';

async function call(method, path, { body, token, form = false } = {}) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    payload = form ? new URLSearchParams(body).toString() : JSON.stringify(body);
    headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`  !! ${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
    process.exit(1);
  }
  return data;
}

const login = async (u, p) => (await call('POST', '/auth/login', { body: { username: u, password: p }, form: true })).access_token;
const step = (msg) => console.log(`\n==> ${msg}`);

step('Register student Rahul (CGPA 8.2, 1 backlog) and company ABC Technologies');
await call('POST', '/auth/register/student', { body: {
  username: `rahul${SUFFIX}`, password: PASSWORD, name: 'Rahul', branch: 'CSE', cgpa: 8.2, active_backlogs: 1 } });
await call('POST', '/auth/register/company', { body: {
  username: `abc${SUFFIX}`, password: PASSWORD, name: 'ABC Technologies', industry: 'IT' } });
const stu = await login(`rahul${SUFFIX}`, PASSWORD);
const com = await login(`abc${SUFFIX}`, PASSWORD);

step('Company posts a job: min CGPA 7.0, max 2 active backlogs');
const job = await call('POST', '/jobs', { token: com, body: {
  title: 'Software Developer', package_lpa: 8, min_cgpa: 7.0, max_active_backlogs: 2 } });
console.log('  job id:', job.id);

step('Rahul checks eligibility and applies');
console.log(' ', await call('GET', `/jobs/${job.id}/eligibility`, { token: stu }));
const app = await call('POST', '/applications', { token: stu, body: { job_id: job.id } });

step('Company shortlists, schedules interview, records PASSED');
await call('POST', `/applications/${app.id}/shortlist`, { token: com });
const when = new Date(Date.now() + 3 * 86_400_000).toISOString();
await call('POST', `/applications/${app.id}/interview`, { token: com, body: { scheduled_at: when, mode: 'ONLINE' } });
await call('PUT', `/applications/${app.id}/interview/result`, { token: com, body: { result: 'PASSED', remarks: 'Strong' } });

step('Company issues offer; Rahul accepts');
const offer = await call('POST', `/applications/${app.id}/offer`, { token: com, body: {} });
console.log(' ', await call('POST', `/offers/${offer.id}/accept`, { token: stu }));

step('Coordinator views placement statistics');
const coord = await login('coordinator', 'Coordinator@123');
console.log(JSON.stringify(await call('GET', '/reports/placement-statistics', { token: coord }), null, 2));

# TalentHub – Campus Placement Management (Node.js)

Students apply for jobs, companies shortlist / interview / issue offers, and the placement
coordinator monitors placement statistics. This is a Node.js rebuild of the original FastAPI
application: **same REST API, same database schema, same web UI, same business rules.**

* **Zero npm dependencies** – uses only Node built-ins (`node:http`, `node:sqlite`, `node:crypto`, `node:test`).
  There is nothing to `npm install`.
* **Requires Node.js 22.13+** (first version where `node:sqlite` works without a flag).
* **Drop-in database:** your existing `talenthub.db` works unchanged – same tables, same password-hash
  format (PBKDF2-SHA256), same datetime format. Existing users can still log in.

## Architecture (layered, same as the Python version)

```
src/
├── routes/         Router layer      – HTTP in/out, role guards, no business logic
├── services/       Service layer     – business rules (eligibility, status flow, accepting offers)
├── repositories/   Repository layer  – all SQL
├── database.js     SQLite connection, schema, transactions
├── schemas.js      Request validation shapes + response serializers
├── validation.js   Small schema validator (FastAPI-style 422 errors)
├── security.js     PBKDF2 password hashing + HS256 JWT
├── http/           Router, request helpers/auth guards, static file server
├── app.js          App factory: dispatch, error handling, coordinator seeding
└── server.js       Entry point
public/             Front end: index.html, style.css, app.js (served at /ui/, unchanged)
tests/              node:test suite (47 tests)
scripts/demo-flow.js  Scripted ABC Technologies / Rahul scenario
```

## Roles

| Role | Can do |
|---|---|
| Student | See open / eligible jobs, check eligibility, apply, track applications, accept or decline offers |
| Company | Post and close jobs, view applicants, shortlist / reject, schedule interviews, record results, issue offers |
| Coordinator | List students, correct academic records, view placement statistics and the placed-students report |

## Business rules

* **Eligibility**: `CGPA >= min_cgpa`, `active_backlogs <= max_active_backlogs`, and branch is in the job's allowed
  branches (empty list = all branches). Boundary values are eligible.
* **Apply**: job must be open, student not already placed, no duplicate application, student must be eligible.
* **Status flow**: `APPLIED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFERED → OFFER_ACCEPTED`
  (side exits: `REJECTED`, `NOT_SELECTED`, `OFFER_DECLINED`, `OFFER_WITHDRAWN`). Steps cannot be skipped.
* **Interviews** must be scheduled in the future; a result (`PASSED` / `FAILED`) can be recorded once.
* **Accepting an offer** marks the student as placed and withdraws their other outstanding offers (in one
  database transaction). Placed students cannot apply to more jobs.
* **Statistics** count a student as placed only after an offer is accepted.
* Only the coordinator can change a student's CGPA / backlogs / branch. The coordinator account is seeded.

## Run it

```bash
cd talenthub
node -v                      # must be v22.13 or newer

# (recommended) configuration - see .env.example for all settings
cp .env.example .env         # then edit SECRET_KEY

npm start                    # or: npm run dev   (auto-restart on file changes)
```

Open **http://127.0.0.1:8000/** (redirects to `/ui/`). The SQLite file and tables are created automatically
on first start. Default coordinator login: `coordinator` / `Coordinator@123`
(override with `COORDINATOR_USERNAME` / `COORDINATOR_PASSWORD`).

Tip: use a different browser (or private window) per role so you can stay logged in as all three.

### Configuration (environment variables or `.env`)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8000` | |
| `DATABASE_PATH` | `./talenthub.db` | `:memory:` for a throw-away database |
| `SECRET_KEY` | dev value (warns on start) | **Set a long random string in production** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT lifetime |
| `COORDINATOR_USERNAME` / `COORDINATOR_PASSWORD` | `coordinator` / `Coordinator@123` | Seeded on first start |

### Scripted example (ABC Technologies / Rahul)

With the server running, in a second terminal: `npm run demo`

## Tests

```bash
npm test
```

47 tests cover eligibility boundary values, the full happy path, validation errors, business-rule violations,
authentication, role/ownership authorization, concurrent duplicate registration and static-file safety.
Tests use an in-memory database and never touch `talenthub.db`.

## API summary

| Method & path | Who | Purpose |
|---|---|---|
| `POST /auth/register/student` · `/auth/register/company` | public | Register |
| `POST /auth/login` (form-encoded `username`, `password`) · `GET /auth/me` | any | Get JWT / current user |
| `GET /students/me` · `PATCH /students/me` | student | Own profile (name only) |
| `GET /students[?branch=&placed=]` · `PATCH /students/{id}/academic-record` | coordinator | List / correct student data |
| `GET /companies/me` | company | Own company profile |
| `POST /jobs` · `POST /jobs/{id}/close` · `GET /jobs/{id}/applications[?status=]` | company | Manage own jobs |
| `GET /jobs[?eligible_only=true]` · `GET /jobs/{id}` | any | Browse open jobs |
| `GET /jobs/{id}/eligibility` | student | Eligibility check with reasons |
| `POST /applications` · `GET /applications/me` | student | Apply / list own applications |
| `GET /applications/{id}` | owner student, owning company, coordinator | Detail incl. interview & offer |
| `POST /applications/{id}/shortlist` · `/reject` | company | Shortlist / reject |
| `POST·GET /applications/{id}/interview` · `PUT …/interview/result` | company (GET: any with access) | Interviews |
| `POST /applications/{id}/offer` | company | Issue offer (optional `package_lpa`) |
| `GET /offers/me` · `POST /offers/{id}/accept` · `/decline` | student | Respond to offers |
| `GET /reports/placement-statistics` · `/reports/placed-students` | coordinator | Reports |
| `GET /health` | public | Liveness check |

Errors use the same shape as before: `{"detail": "message"}`, or for validation failures (HTTP 422)
`{"detail": [{"loc": ["body","cgpa"], "msg": "...", "type": "..."}]}`.

## Differences from the FastAPI version

* No Swagger UI at `/docs` (that came from FastAPI). The API table above documents every endpoint.
* `DATABASE_URL` is replaced by `DATABASE_PATH`.
* Login also accepts a JSON body (in addition to the form encoding the UI uses).
* Login does a dummy password check for unknown usernames so response timing doesn't reveal which usernames exist.
* Password hashing runs asynchronously, so a login never blocks other requests.

## Production notes

* Set a strong `SECRET_KEY` and change the coordinator password.
* Serve behind HTTPS (e.g. nginx / Caddy) and add rate limiting on `/auth/login`.
* `node:sqlite` is marked experimental by Node; it's stable in practice for this workload, but if you need
  PostgreSQL/MySQL later, only `src/database.js` and `src/repositories/` need to change.

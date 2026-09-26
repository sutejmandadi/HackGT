# Audio practice and Interview MRI

## Try it locally

Open **Question bank → Start Practice Drill → Start recording**. Allow the
microphone, answer, then stop. You can pause/resume, replay, discard, or choose
**Analyze Response**. Successful attempts appear immediately and in **Reports**.

This checkout is configured for **explicit demo mode** in the ignored
`backend/.env`: `PRACTICE_PROVIDER=mock` and `PRACTICE_ALLOW_MOCK=true`. Audio is
really recorded and decoded, but the returned transcript is a fixed synthetic
example scaled to its duration. It does not evaluate what the user actually said.
The recorder and report display this distinction. Demo attempts persist and can
be deleted, but are excluded from averages, comparisons, and pattern intelligence.

### Enable live transcription (remaining configuration)

Obtain a Deepgram API key and edit **backend/.env**, never a NEXT_PUBLIC variable:

```dotenv
APP_ENV=development
PRACTICE_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_private_key
DEEPGRAM_MODEL=nova-3
PRACTICE_ALLOW_MOCK=false
```

Restart the Python backend. The local semantic model needs no additional API key.
No key is bundled with this project. Missing/invalid credentials produce a clear
recoverable error; the browser retains the audio for retry. Provider usage can
incur charges. English transcription is configured for this first version.

From the repository root, install/update and run:

```powershell
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd backend
.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In a second terminal, run `npm.cmd run dev` from `frontend`. Visit
http://localhost:3000. Microphones require HTTPS in deployment; localhost is allowed.
The recorder chooses browser-supported WebM/Opus, MP4, or Ogg/Opus. Browser pause
time is excluded. Hiding the page stops recording and preserves captured audio.
Limits: 2 seconds–5 minutes, 12 MB. The UI stops just before five minutes to allow
for recorder flush latency. Unsupported formats, denied permission, corrupt audio,
timeouts, and save failures retain recoverable states. An unfinished recording
locks question/filter/workspace navigation and sign-out until analyzed or discarded.

## Architecture

1. MediaRecorder captures an in-memory Blob; Web Audio supplies a simple level meter.
2. Next.js `/api/practice` enforces format/streaming size limits and proxies to the
   private FastAPI service using the signed-in user's access token.
3. FastAPI verifies that token against Supabase Auth. It never trusts a submitted
   owner ID or uses a service-role key for practice data.
4. A bounded FFmpeg subprocess (imageio-ffmpeg binary) decodes only supported audio
   containers to mono 16kHz PCM WAV, with a 25-second timeout and 301-second decode
   ceiling. Shell execution and network input protocols are disabled. Temporary
   files are cleaned on success and failure; valid recordings over 300s are rejected.
5. A provider abstraction calls Deepgram Nova-3 with punctuation, timestamps, and
6. Python computes metrics and runs local MiniLM semantic similarity plus explicit
   STAR cues. The `Report`/`Analysis` Pydantic schemas validate the output. Transcript
   content is treated solely as data; no tools, instructions, or generated SQL are
   executed from it. No LLM is used to count words, pauses, or compute scores.
7. The backend saves metadata first, then completes the attempt and inserts its
   transcript segments in one owner-scoped PostgreSQL transaction. Processing
   failures store a safe error. Stable attempt UUIDs make response-loss retries
   idempotent. A completed attempt is never replaced by a retry.
8. SSE carries actual validating/transcribing/analyzing/saving stages and the result.
   The UI preserves the recording when the request or persistence fails.

GET `/api/practice` loads 50 attempts at a time; Reports has **Load older attempts**.
Overview metrics explicitly describe the loaded real attempts; total saved count
includes all statuses and demo attempts. DELETE removes an attempt and its segments.
GET `/api/practice/config` returns safe provider readiness, never credentials.

## Persistence and privacy

Migration `003_practice_attempts.sql` creates `practice_attempts` (question/competency
snapshots, owner, optional linked story, status/error, transcript, metrics, structured
analysis and versions) and `practice_segments` (ordered timestamped segment data).
Both tables have RLS. A trigger rejects a linked story owned by someone else.
An invoker-security RPC atomically completes only the caller's own attempt.
Owner deletion cascades to segments. Raw audio references must be null in this version.

The migration was applied to the shared development project using the CLI. Other
projects should run `npx.cmd supabase db push --dry-run` then `npx.cmd supabase db push`
after linking their project. Do not paste the migration manually into the dashboard.

Audio is not persisted by MeCode. After submission, it remains in the browser only
until discard/navigation/unmount. Backend temporary files are deleted even on error.
Live mode sends audio to Deepgram for transcription; external provider retention is
governed by that provider's account settings and terms. Transcript/report data stays
in the user's Supabase account until deleted. No transcripts, tokens or audio contents
are logged by this pipeline. User data and credentials are not committed to Git.

For local-only development, omit Supabase configuration from both services and use
APP_ENV=development. Completed reports then use browser localStorage, with explicit
write/read errors and no raw audio. Cloud mode never falls back to local persistence.

## Rubric and evidence

Pipeline: **interview-mri-1.0**. Rubric: **coaching-1.0**. The report includes the
formula, semantic method, confidence/limitations, evidence indices, and original text.

- WPM = transcript word count ×60 / decoded duration. Speaking WPM divides by the
  sum of recognized word durations; this is not physiological articulation time.
- Segment pace uses each segment's timestamp span. STAR allocation is over segment
  time, not full recording time. Unknown classifications remain visible.
- Gaps ≥1.5s are meaningful pauses; ≥3s are long. Word gaps may include unrecognized
  speech/noise. RMS active/quiet estimates use 20ms windows and are explicitly approximate.

- Numeric mentions (including spelled-out small numbers) are counted as evidence
  cues, not verified business outcomes. Vague-word matches are specificity cues;
  they do not establish whether a claim is truthful or supported in real life.
- Overall is the equal mean of available Delivery, Structure, Specificity, Relevance,
  and Impact scores. Full formulas are in the report and `score_components`.
  Missing semantic relevance is omitted rather than invented.
- STAR and question similarity use the existing local MiniLM model plus explicit
  language rules. It is not a trained/calibrated interview evaluator. Ownership,
  decision depth, result evidence, and ordering diagnostics remain transparent
  cues grounded in the inferred sections and transcript. Advice uses these signals
  rather than unconstrained generated claims. This version cannot reliably infer
  complete interviewer intent or logical coherence; it states those limitations.
- Strengths are restricted to supported evidence (up to two); three prioritized
  improvements, a next exercise, and an extractive four-beat outline are supplied.
  No personality, honesty, emotion, mental-state, accent, or employability assessment.

Two attempts are only compared for the same question/pipeline/rubric, with an explicit
preliminary label. Broader patterns require five real attempts, two questions, and
matching versions. Competency patterns need at least three examples; overall trends
need six. Pattern claims link back to attempt evidence. Small samples and repeated
questions are practice observations, not scientific conclusions.

## Deployment boundary

Keep the Python service on private networking, as with the existing matrix API.
Set APP_ENV=production (which rejects mock mode), configure Supabase public URL/key
and Deepgram key server-side, and use HTTPS. Set SCORER_API_URL for the Next server.
Configure a streaming-capable gateway with a ≥185s timeout, a 12 MB request limit,
per-user rate limits, and worker memory/CPU limits. This pipeline limits processing
to two concurrent requests per backend process and one per owner per process;
multi-worker deployments need shared rate limiting. Interrupted attempts are shown
honestly as unfinished and can be retried using the original recording or deleted.

## Verification

```powershell
# backend
.venv/Scripts/python.exe -m unittest discover -s tests -v
# frontend
npm.cmd run lint
npm.cmd run build
node tests/practice.cjs
node tests/resume-route.cjs
node tests/strength-grid-route.cjs
# linked development database: fixtures roll back
npx.cmd supabase db query --linked --file supabase/tests/practice_rls.sql
```

decoding/duration limits, provider configuration, API/auth validation, persistence
errors, local save/retrieve/delete, version/sample-size comparison gates, streaming,
and RLS owner isolation/cascade deletion/idempotency. Browser verification uses a
real MediaRecorder and decoder with isolated mock transcription/storage. It exercises
denied microphone access, recording/pause/replay, navigation locks, missing-key retry,
Reports empty/loading/failure/success, transcript evidence, deletion, and responsive
desktop/mobile layouts. No live provider accuracy claim is made without a real key.

### Repeat the browser checks

Start the normal frontend on port 3000. In a separate terminal at the repository root,
start the isolated test backend (port 8001):

```powershell
backend/.venv/Scripts/python.exe backend/tests/practice_demo_server.py
```

In another terminal in `frontend`, install the optional QA tool without changing
production dependencies, then run the suite (Microsoft Edge must be installed):

```powershell
npm.cmd install --no-save --package-lock=false playwright
node tests/practice-browser.cjs
```

The suite intercepts Supabase requests in its isolated browser context and uses
in-memory report storage. It does not create real accounts or reports. It prints
the temporary folder containing desktop/mobile screenshots. Stop the isolated
port 8001 test server afterward; the normal backend uses port 8000.


## Report UI and rubric 2.0

Reports now open as compact question groups, with no report automatically expanded.
Select an attempt to open its centered dialog; Close report returns to the list.
Progress is visible immediately. Transcript analysis and detailed coaching are expandable. Sample reports hide
scores and pacing because synthetic timestamps cannot measure a user's delivery.
Mock/demo/fixture all refer to the same fixed example transcript, not live recognition.

New reports use coaching-3.0: continuous pace scoring; STAR coverage, balance and
order; bounded personal-action, reasoning and verification signals; word-weighted
relevance; and outcome detail, measurement, learning and causal links. Short section
mentions and repeated keywords no longer earn full credit. The report includes
the exact formula. This remains an uncalibrated coaching heuristic. Existing reports
retain their original rubric and cannot be compared across rubric versions.


## Free local voice analysis (default)

Install backend requirements, then run `python local_transcription.py --download`
from `backend` once. Set `PRACTICE_PROVIDER=local` and `PRACTICE_ALLOW_MOCK=false`
in backend/.env and restart the backend. No API key or paid account is required.
The base.en model runs via faster-whisper on CPU with int8 weights and word timestamps.
Model files live in ignored backend/.models. Download requires internet; inference
does not. Supabase report saving still requires internet. On a deployed site,
transcription runs on the server, so hosting resources may cost money.

Each recording is processed in a bounded worker process (150-second timeout), with
temporary audio removed afterward. If processing times out, retry a shorter answer.
Silence detection reduces hallucinations, but review every transcript. Local reports
use a distinct pipeline version to avoid comparisons across transcription providers.


Rubric 3.0 uses pace (70%) and long-gap control (30%) for Delivery. Saved legacy reports are adapted on read, with recalculated Delivery and Overall and retired advice removed; original stored history is preserved.

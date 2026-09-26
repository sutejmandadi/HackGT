# Resume import

On the **Stories** tab, choose **Import resume**, upload a text-based PDF or UTF-8
`.txt` file (or paste text), then choose **Find story drafts**. Review the selected
entries and use **Add selected stories**. Expand an entry to edit every field and
compare it with the original extracted text. Added stories use the existing
Story Bank editor, Supabase owner policies, and Strength matrix.

## Run locally

Install backend requirements after pulling this branch:

```powershell
# From the repository root
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd backend
.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In another terminal, run `npm.cmd run dev` from `frontend` and visit
http://localhost:3000. Existing Supabase configuration is reused. No new API key,
database migration, or storage bucket is needed. Restart the Python service after
backend changes. `SCORER_API_URL` points the Next.js server at the Python backend
and defaults to `http://127.0.0.1:8000`.

## Behavior and limits

- PDF extraction uses pypdf in a separate process with a 25-second timeout.
  Uploads are limited to 5 MB, 10 pages, 60,000 text characters, 40 entries, and
  200 bullets. Encrypted, corrupt, and image-only PDFs return actionable errors.
- Common work, project, research, volunteer, and leadership headings identify
  entries. Indented wrapped bullets are joined. Education, skills, and contact
  details are not made into stories. Complex columns and unusual headings can
  require corrections using the extracted-text view and **Paste text**.
- STAR placement combines conservative text rules with semantic similarity from
  the same local all-MiniLM-L6-v2 model used by the matrix. It is a suggestion,
  not a trained or calibrated STAR classifier. Model failures fall back to rules
  with an explicit notice. Mixed action/outcome bullets are preserved together
  for the user to split if desired.
- Draft fields contain extracted wording, not generated achievements. Missing
  context, responsibilities, role, and organization stay blank. For an independent
  project, the user can enter `Independent`; this is not assumed from silence.
- Original wording appears beside draft fields during review. The original file,
  source snippets, and full extracted text are not written to Supabase or server
  disk. They remain in the browser's current importer state until leaving/reloading
  the page. Only chosen story fields are saved. No external AI provider receives
  the resume; model weights may be downloaded when starting the backend.
- Imports are one atomic database batch. Stable UUIDs and conflict-ignore inserts
  make a retry safe if the database accepted an import but its response was lost.
  Saved entries with the same normalized title, organization, and role are skipped.
  Editing those fields can make a repeated upload appear new; review selection.
- In local-only development mode, selected stories use existing browser storage.
  Cloud mode never falls back to browser storage after a save error.

## Service boundary

`POST /api/resume` is the browser-facing Next.js route. It verifies the Supabase
access token, enforces a streaming upload limit (including requests without a
Content-Length header), and forwards only raw PDF/text bytes to the private
backend's `POST /api/resume/parse`. Production requires authentication. The Python
service retains the existing private/loopback deployment boundary; do not expose
its unauthenticated internal routes publicly. Resume extraction has two concurrent
slots per backend process. Production deployments should additionally configure
gateway request limits, rate limits, and worker memory limits.

## Verification

```powershell
# In backend
.venv/Scripts/python.exe -m unittest discover -s tests -v
# In frontend
npm.cmd run lint
npm.cmd run build
node tests/strength-grid-route.cjs
node tests/resume-route.cjs
```

Regression tests use synthetic resume text and in-memory PDFs, not personal resume
files. Browser verification used the provided sample PDF against the real local
extractor and mocked authentication/storage: seven entries, editable fields,
390px/1440px layouts, save-response loss and retry, reload, and duplicate detection.
No test stories were inserted into the shared Supabase database.

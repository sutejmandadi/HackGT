import asyncio
import json
import subprocess
import sys
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from resume_parser import draft_stories

router = APIRouter()
MAX_BYTES = 5 * 1024 * 1024
_slots = asyncio.Semaphore(2)


def extract(data: bytes, content_type: str) -> str:
    if content_type == "text/plain":
        try:
            return data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("Text files must use UTF-8. Paste the text instead.") from exc
    try:
        process = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("resume_pdf.py"))],
            input=data, capture_output=True, timeout=25,
        )
        if process.returncode:
            raise ValueError("Could not read the PDF. Export a new PDF or paste its text.")
        result = json.loads(process.stdout)
        if "error" in result:
            raise ValueError(result["error"])
        return result["text"]
    except subprocess.TimeoutExpired as exc:
        raise ValueError("PDF extraction took too long. Export a simpler PDF or paste its text.") from exc


@router.post("/api/resume/parse")
async def parse_resume(request: Request):
    content_type = request.headers.get("content-type", "").split(";")[0]
    if content_type not in {"application/pdf", "text/plain"}:
        raise HTTPException(415, "Upload a PDF or UTF-8 text file.")
    if _slots.locked():
        raise HTTPException(429, "Resume processing is busy. Please retry shortly.")
    async with _slots:
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                raise HTTPException(413, "Resume exceeds the 5 MB limit.")
        try:
            text = await run_in_threadpool(extract, bytes(data), content_type)
            # Reuse the model already loaded for the matrix, without a second download.
            scorer = getattr(request.app.state, "scorer", None)
            return await run_in_threadpool(draft_stories, text, getattr(scorer, "model", None))
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

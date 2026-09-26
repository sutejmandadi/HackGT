"""Bounded PDF subprocess. Input/output use pipes, never persistent upload files."""
import io
import json
import sys
from pypdf import PdfReader

MAX_BYTES = 5 * 1024 * 1024


def extract_pdf(data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise ValueError("PDF exceeds the 5 MB limit.")
    if not data.startswith(b"%PDF-"):
        raise ValueError("This file is not a valid PDF. Upload a PDF or paste text.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("Password-protected PDFs are not supported. Export an unlocked copy.")
        if len(reader.pages) > 10:
            raise ValueError("Use a resume of 10 pages or fewer.")
        chunks = []
        for page in reader.pages:
            chunks.append((page.extract_text(extraction_mode="layout") or "") if "/Contents" in page else "")
            if sum(map(len, chunks)) > 60_000:
                raise ValueError("Resume text exceeds 60,000 characters.")
        text = "\n".join(chunks).strip()
        if len(text) < 30:
            raise ValueError("This PDF has no readable text. Scanned PDFs need OCR first; you can paste their text instead.")
        return text
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not read this PDF. Export a new PDF or paste its text instead.") from exc


if __name__ == "__main__":
    try:
        result = {"text": extract_pdf(sys.stdin.buffer.read(MAX_BYTES + 1))}
    except ValueError as exc:
        result = {"error": str(exc)}
    sys.stdout.buffer.write(json.dumps(result).encode("utf-8"))

"""Extractive resume drafts: never generate facts, execute document instructions, or save uploads."""
import re
from dataclasses import dataclass, field

MAX_TEXT = 60_000
MAX_STORIES = 40
BULLET = re.compile(r"^\s*[•●▪◦‣\uf0b7*\-]\s+")
DATE = re.compile(r"\s+(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\b.*$", re.I)
ACTIVE = re.compile(r"\b(experience|employment|projects?|leadership|volunteer(?:ing)?|community engagement|research|internships?)\b", re.I)
INACTIVE = re.compile(r"\b(education|skills|interests|certifications?|awards|publications|references|summary|profile|coursework|languages)\b", re.I)
HEADING_WORDS = set("work professional relevant technical selected personal academic employment experience experiences project projects leadership volunteer volunteering community engagement research internships internship education skills interests certifications certification awards publications references summary profile coursework languages additional and activities extracurricular extracurriculars honors achievements training involvement service positions employment history employment professional background".split())
ROLE = re.compile(r"\b(intern|engineer|developer|tutor|analyst|assistant|manager|lead|leader|organizer|researcher|president|coordinator|designer|consultant|founder)\b", re.I)
ACTION = re.compile(r"^(?:I\s+)?(?:led|built|developed|designed|implemented|integrated|organized|merged|generated|performed|applied|engineered|provided|coordinated|created|trained|analyzed|managed|launched|researched|wrote|tested|automated|collaborated|mentored)\b", re.I)
RESULT = re.compile(r"^(?:I\s+)?(?:achieved|increased|reduced|improved|saved|earned|won|received|observed|identified statistically|resulted|delivered|secured)\b", re.I)
TASK = re.compile(r"^(?:I\s+)?(?:was tasked|was responsible|needed to|tasked with|responsible for|my goal|our goal|aimed to)\b", re.I)
SITUATION = re.compile(r"^(?:faced with|during|when|the team faced|our team faced|the problem|the challenge|existing|previously)\b", re.I)
ANCHORS = {
    "situation": "The context was a difficult problem, an existing challenge, or a need faced by the team before work began.",
    "task": "My responsibility and assigned goal was to complete this objective. I was tasked with this requirement.",
    "actions": "I built, researched, designed, implemented, analyzed, organized, collaborated, and tested a solution.",
    "result": "The outcome achieved measurable improvements, won recognition, reduced costs, or demonstrated findings and lessons.",
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


@dataclass
class Entry:
    section: str
    headers: list[str] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)


def split_entries(text: str) -> list[Entry]:
    """Group headers and wrapped bullets; skip contact, skills and education sections."""
    entries: list[Entry] = []
    section = ""
    current = None
    previous_indent = 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line or re.fullmatch(r"(?:Page\s+)?\d+(?:\s+of\s+\d+)?", line, re.I):
            continue
        bullet = bool(BULLET.match(line))
        heading = clean(line).rstrip(":")
        is_heading = (not bullet and len(heading) < 65 and not DATE.search(heading)
                      and (ACTIVE.search(heading) or INACTIVE.search(heading))
                      and set(re.findall(r"[a-z]+", heading.lower())).issubset(HEADING_WORDS))
        if is_heading:
            section = heading if ACTIVE.search(heading) and not INACTIVE.search(heading) else ""
            current = None
            continue
        if not section:
            continue
        indent = len(raw) - len(raw.lstrip())
        if bullet:
            if current:
                current.bullets.append(clean(BULLET.sub("", line)))
                previous_indent = indent
            continue
        # Wrapped bullet lines are indented, or lowercase continuations. Unbulleted
        # action sentences are accepted too; headings are normally short and dated.
        continuation = current and current.bullets and (
            indent > previous_indent + 1 or line[0].islower()
        ) and not DATE.search(line)
        if continuation:
            current.bullets[-1] += " " + clean(line)
        elif current and any(pattern.match(line) for pattern in (ACTION, RESULT, TASK, SITUATION)):
            current.bullets.append(clean(line))
            previous_indent = indent
        elif current and not current.bullets:
            current.headers.append(line)
        else:
            current = Entry(section=section, headers=[line])
            entries.append(current)
    return [entry for entry in entries if entry.bullets]


def metadata(entry: Entry) -> dict:
    headers = [clean(DATE.sub("", h)) for h in entry.headers]
    headers = [h for h in headers if h]
    first = headers[0] if headers else "Untitled experience"
    is_project = bool(re.search(r"project|research", entry.section, re.I))
    title, organization, role = first, "", ""
    if not is_project:
        parts = re.split(r"\s+[–—|\-]\s+", first, maxsplit=1)
        if len(parts) == 2:
            organization, role = parts
            organization = organization.split(",")[0].strip()
            title = f"{role} at {organization}"
        elif len(headers) > 1:
            if ROLE.search(first):
                role, organization = first, headers[1]
            else:
                organization, role = first, headers[1]
            title = f"{role} at {organization}"
        else:
            organization = first
    elif len(headers) > 1:
        # Only explicit metadata; do not invent 'Independent' or an employer.
        organization = headers[1]
    return dict(title=title[:160], organization=organization, role=role)


def classify(text: str, semantic: tuple[str, float, float] | None = None) -> str:
    if TASK.search(text):
        return "task"
    if SITUATION.search(text):
        return "situation"
    if RESULT.search(text):
        return "result"
    if ACTION.search(text):
        return "actions"
    if semantic and semantic[1] >= .32 and semantic[2] >= .06:
        return semantic[0]
    return "actions"


def draft_stories(text: str, model=None) -> dict:
    if len(text) > MAX_TEXT:
        raise ValueError("Resume text is too long. Use at most 60,000 characters.")
    if len(text.strip()) < 30:
        raise ValueError("Not enough readable text. Upload a text-based PDF or paste the resume text.")
    entries = split_entries(text)
    if len(entries) > MAX_STORIES:
        raise ValueError("More than 40 entries found. Import a shorter resume in separate parts.")
    warnings = []
    semantic = {}
    method = "rules"
    bullets = [b for e in entries for b in e.bullets]
    if len(bullets) > 200 or any(len(b) > 6000 for b in bullets):
        raise ValueError("Resume entries are too long. Use up to 200 bullets, each under 6,000 characters.")
    if model is not None and bullets:
        try:
            keys = list(ANCHORS)
            anchors = model.encode(list(ANCHORS.values()), normalize_embeddings=True)
            vectors = model.encode(bullets, normalize_embeddings=True)
            scores = vectors @ anchors.T
            for bullet, row in zip(bullets, scores):
                order = row.argsort()
                semantic[bullet] = (keys[int(order[-1])], float(row[order[-1]]), float(row[order[-1]] - row[order[-2]]))
            method = "local-ml"
        except Exception:
            warnings.append("ML categorization is unavailable; drafts use text rules. Review the STAR placement.")
    elif bullets:
        warnings.append("Drafts use text rules while the local ML model is unavailable.")
    stories = []
    for entry in entries:
        story = {**metadata(entry), **{key: "" for key in ANCHORS}}
        for bullet in entry.bullets:
            key = classify(bullet, semantic.get(bullet))
            story[key] += ("\n" if story[key] else "") + bullet
        story["sourceText"] = "\n".join(entry.headers + ["• " + b for b in entry.bullets])
        stories.append(story)
    if not stories:
        warnings.append("No clear entries found. Check the extracted text and use headings such as Work Experience or Projects, with a title and bullets for each entry.")
    return {"stories": stories, "extractedText": text, "warnings": warnings, "method": method}

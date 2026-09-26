"""Transparent coaching signals. No personality, emotion or hiring judgments."""
import re
from collections import Counter
from practice_models import Segment, Analysis, Feedback, RUBRIC
from resume_parser import ANCHORS, classify

TOKEN = re.compile(r"\b[\w]+(?:['’-][\w]+)*\b")
NUMBER = re.compile(r"\b\d+(?:[.,]\d+)*(?:%|\b)|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b", re.I)
VAGUE = re.compile(r"\b(?:things|stuff|somehow|very good|really great|a lot better|helped a lot)\b", re.I)
OWN = re.compile(r"\b(?:I|me|my|mine)\b", re.I)
TEAM = re.compile(r"\b(?:we|us|our|ours)\b", re.I)
DECISION = re.compile(r"\b(?:because|decided|chose|tested|compared|trade-off|tradeoff|instead|measured|verified|diagnosed)\b", re.I)
KEYS = ["situation", "task", "actions", "result", "unknown"]

def words(text):
    return TOKEN.findall(text)

def metrics(segments: list[Segment], duration: float, activity: dict | None = None):
    text = " ".join(s.text for s in segments)
    count = len(words(text))
    allocation = {k: {"words": 0, "seconds": 0.0, "percent": 0.0} for k in KEYS}
    all_words = [w for s in segments for w in s.words]
    for s in segments:
        n = len(words(s.text))
        s.wpm = round(n * 60 / max(s.end-s.start, .1), 1)
        allocation[s.star]["words"] += n
        allocation[s.star]["seconds"] += s.end-s.start
    spans = sum(v['seconds'] for v in allocation.values())
    for value in allocation.values():
        value['percent'] = round(100 * value['seconds'] / max(spans, .1), 1)
        value['seconds'] = round(value['seconds'], 2)
    pauses = []
    last = 0.0
    for word in all_words:
        if word.start-last >= 1.5:
            pauses.append({"start": round(last, 2), "end": word.start, "seconds": round(word.start-last, 2), "long": word.start-last >= 3})
        last = max(last, word.end)
    if duration-last >= 1.5:
        pauses.append({"start": last, "end": duration, "seconds": round(duration-last, 2), "long": duration-last >= 3})
    bounds = [0.0] + [p['end'] for p in pauses]
    ends = [p['start'] for p in pauses] + [duration]
    longest = max((e-b for b,e in zip(bounds,ends)), default=0)
    normalized = [w.lower() for w in words(text)]
    phrases = Counter(' '.join(normalized[i:i+3]) for i in range(len(normalized)-2))
    repeated = [{"phrase": p, "count": c} for p,c in phrases.most_common(10) if c > 1]
    repeated_words = Counter(a for a,b in zip(normalized, normalized[1:]) if a == b)
    sentences = [s for s in re.split(r"[.!?]+", text) if words(s)]
    return {
        "duration": round(duration,2), "total_words": count, "wpm": round(count*60/max(duration,.1),1),
        "speaking_wpm": round(count*60/max(sum(w.end-w.start for w in all_words),.1),1),
        "pace_definition": "WPM uses total recording time. Speaking WPM uses the sum of recognized word durations, not a physiological articulation measure.",
        "pauses": pauses, "pause_definition": "Gaps of at least 1.5s between recognized words; long gaps are at least 3s. These may include noise or unrecognized speech.",
        "repeated_phrases": repeated, "repeated_words": dict(repeated_words),
        "average_sentence_length": round(count/max(len(sentences),1),1), "longest_monologue": round(longest,2),
        "star": allocation, "numeric_mentions": len(NUMBER.findall(text)),
        "ownership": {"individual": len(OWN.findall(text)), "team": len(TEAM.findall(text))},
        "activity": activity, "redundancy_ratio": round(sum(c-1 for c in phrases.values() if c>1)/max(len(normalized),1),3),
    }

def semantic(segments, prompt, competency, model):
    method = "rules-only (semantic model unavailable)"
    if model is not None:
        import numpy as np
        anchors = model.encode(list(ANCHORS.values()) + [prompt, competency.replace('_',' ')], normalize_embeddings=True)
        vectors = model.encode([s.text for s in segments], normalize_embeddings=True)
        values = vectors @ anchors.T
        for s,row in zip(segments, values):
            order = np.argsort(row[:4])
            best = int(order[-1])
            # Unknown is retained when neither explicit language nor embeddings support STAR.
            explicit = classify(s.text)
            s.star = explicit if explicit != 'actions' else (list(ANCHORS)[best] if row[best] >= .30 and row[best]-row[order[-2]] >= .04 else 'unknown')
            if re.search(r"\b(?:built|created|implemented|led|designed|tested|decided|chose|analyzed|organized|I did)\b",s.text,re.I):
                s.star = 'actions'
            if re.search(r"^(?:as a result|the result|we achieved|I achieved|we reduced|I reduced)",s.text,re.I):
                s.star = 'result'
            s.relevance = round(float(max(row[4], row[5])),3)
        method = "local MiniLM semantic similarity + explicit STAR cues"
    else:
        for s in segments:
            s.star = classify(s.text)
    for s in segments:
        s.evidence = bool(NUMBER.search(s.text))
        s.vague = bool(VAGUE.search(s.text))
    return method

def score_components(m, segments):
    # Continuous, bounded evidence factors. Repeating keywords cannot add points.
    def clamp(value): return max(0.0, min(1.0, value))
    n = max(m['total_words'], 1)
    pace = clamp(1 - abs(m['wpm']-145)/100)
    gap_ratio = sum(p['seconds'] for p in m['pauses'] if p['long'])/max(m['duration'],1)
    delivery = 100*(.7*pace + .3*clamp(1-gap_ratio/.3))
    target = {'situation':.15,'task':.10,'actions':.50,'result':.25}
    coverage = sum(clamp(m['star'][k]['words']/minimum) for k,minimum in
                   [('situation',12),('task',10),('actions',30),('result',18)])/4
    balance = sum(min(m['star'][k]['percent']/100,share) for k,share in target.items())
    order = [KEYS.index(s.star) for s in segments if s.star!='unknown']
    sequence = clamp(1-sum(b<a for a,b in zip(order,order[1:]))/max(len(order)-1,1))
    structure = 100*(.5*coverage+.35*balance+.15*sequence)*coverage
    actions = ' '.join(s.text for s in segments if s.star=='actions')
    personal = bool(OWN.search(actions))
    reasoning = bool(DECISION.search(actions))
    verification = bool(re.search(r'\b(?:tested|measured|verified|validated|compared)\b',actions,re.I))
    concrete = clamp(sum(len(words(s.text)) for s in segments if s.evidence)/n/.35)
    precision = clamp(1-sum(len(words(s.text)) for s in segments if s.vague)/n)
    specificity = 100*(.25*personal+.25*reasoning+.2*verification+.2*concrete+.1*precision)
    specificity *= clamp(len(words(actions))/30)*(1-min(.5,m['redundancy_ratio']))
    relevance_values = [(s.relevance,len(words(s.text))) for s in segments if s.relevance is not None]
    relevance = None
    if relevance_values:
        mean = sum(v*w for v,w in relevance_values)/max(1,sum(w for _,w in relevance_values))
        relevance = 100*clamp((mean-.05)/.70)
    results = ' '.join(s.text for s in segments if s.star=='result')
    outcome = bool(re.search(r'\b(?:reduced|increased|improved|achieved|delivered|resolved|saved|completed|launched|adopted|passed|prevented)\b',results,re.I))
    measure = bool(NUMBER.search(results))
    learning = bool(re.search(r'\b(?:learned|next time|lesson)\b',results,re.I))
    causal = bool(re.search(r'\b(?:because|enabled|allowed|led to|as a result)\b',results,re.I))
    impact = 100*(.35*outcome+.25*measure+.2*learning+.2*causal)*clamp(len(words(results))/25)
    scores = {'Delivery':round(delivery,1),'Structure':round(structure,1),
              'Specificity':round(specificity,1),'Impact':round(impact,1)}
    if relevance is not None: scores['Relevance']=round(relevance,1)
    scores['Overall']=round(sum(scores.values())/len(scores),1)
    return scores


def analyze(segments, duration, prompt, competency, model=None, activity=None, is_mock=False):
    method = semantic(segments, prompt, competency, model)
    m = metrics(segments,duration,activity)
    scores = score_components(m, segments)
    refs = [s.index for s in segments]
    by_star = {k: [s for s in segments if s.star == k] for k in KEYS}
    def feedback(kind,text,ss):
        return Feedback(kind=kind,text=text,segments=[s.index for s in ss])
    strengths = []
    specific = [s for s in segments if s.evidence]
    decisions = [s for s in segments if DECISION.search(s.text)]
    if specific:
        strengths.append(feedback('observation', 'You included concrete numeric details. Preserve these when tightening the answer; a number is not by itself proof of impact.', specific[:2]))
    if decisions:
        strengths.append(feedback('observation', 'You described a decision or verification step. Keep the reasoning attached to your personal action.', decisions[:2]))
    if len(strengths)<2:
        strengths.append(feedback('observation', f"You supplied {m['total_words']} words of material to refine. Use the highlighted passage as a starting point, not a completed answer.", segments[:1]))
    improvements = []
    for k in ['actions','result','task','situation']:
        if m['star'][k]['words'] < 5:
            improvements.append(feedback('recommendation', {'actions':'State one decision you personally made, the alternative, and why you chose it.', 'result':'End with what changed, a truthful measure if available, or a concrete lesson.', 'task':'Name your personal responsibility and what success required.', 'situation':'Open with one sentence naming the problem and who it affected.'}[k], segments[-1:] if k=='result' else segments[:1]))
    vague = [s for s in segments if s.vague]
    if vague:
        improvements.append(feedback('recommendation','Replace vague wording in the highlighted passage with the specific object, decision, or observable change.',vague[:2]))
    if by_star['result'] and not any(s.evidence for s in by_star['result']):
        improvements.append(feedback('recommendation','Your detected Result has no numeric detail. Add a real measure if you have one; otherwise describe an observable outcome without inventing a number.',by_star['result']))
    improvements.extend([
        feedback('recommendation','Rehearse the highlighted action in two sentences: what you chose, then why that choice mattered.',by_star['actions'][:1] or segments[:1]),
        feedback('recommendation','Tie the final sentence directly to the question; explain what this example demonstrates.',segments[-1:]),
        feedback('recommendation','Remove one repeated setup detail while retaining the specific decision and outcome.',segments[:1]),
    ])
    intersections = []
    context = m['star']['situation']['percent']+m['star']['task']['percent']
    intersections.append(feedback('inference',f"Detected context takes {context:.0f}% of transcript-segment time; actions take {m['star']['actions']['percent']:.0f}%. Review the section labels before using this balance.",segments))
    for key in ['actions','result']:
        group = by_star[key]
        if group:
            n = sum(len(words(s.text)) for s in group); seconds = sum(s.end-s.start for s in group)
            pace = n*60/max(seconds,.1)
            intersections.append(feedback('inference',f"Detected {key} pace is {pace:.0f} WPM versus {m['wpm']:.0f} WPM for the full recording. Segment pace excludes between-segment pauses.",group))
    if by_star['actions'] and by_star['result']:
        if any(s.evidence for s in by_star['actions']) and not any(s.evidence for s in by_star['result']):
            intersections.append(feedback('inference','Numeric detail appears in Actions but not the detected Result. State the actual outcome rather than repeating effort.',by_star['actions']+by_star['result']))
    ownership = m['ownership']
    ordering = [KEYS.index(s.star) for s in segments if s.star != 'unknown']
    backwards = sum(b<a for a,b in zip(ordering,ordering[1:]))
    analysis = Analysis(
        scores=scores,
        score_explanation="Overall averages the available category scores. Delivery weights pace around 145 WPM (70%) and long-gap control (30%). Structure combines meaningful STAR coverage (50%), a 15/10/50/25 time balance (35%), and section order (15%), scaled by coverage. Specificity rewards personal actions (25%), reasoning (25%), verification (20%), concrete detail (20%), and precise wording (10%), scaled by action depth and repetition. Relevance uses word-weighted semantic similarity, mapped from 0.05–0.75 to 0–100; it is omitted when unavailable. Impact rewards an observable outcome (35%), a measure (25%), learning (20%), and a causal link (20%), scaled by result detail. Targets are adjustable coaching heuristics, not validated hiring standards.",
        summary=improvements[0].text,
        strengths=strengths[:2], improvements=improvements[:3], exercise="Record another answer using four short beats: context, your responsibility, your decision and reason, then the observable outcome. " + improvements[0].text,
        outline=[{"section":k, "segments":[s.index for s in by_star[k]], "prompt":p} for k,p in zip(KEYS[:4],['One sentence: what problem mattered?','One sentence: what did you own?','Two sentences: what did you decide, do, and verify?','One sentence: what changed or what did you learn?'])],
        intersections=intersections, confidence='limited' if is_mock or m['total_words']<60 or model is None else 'moderate',
        limitations=['Transcription can miss words or mishear numbers; check the transcript.', 'STAR and relevance use an uncalibrated local similarity model, not a trained interview evaluator.', 'Numeric mentions are evidence cues, not fact checking. Vague-word flags do not prove a claim is unsupported.', 'No assessment of personality, honesty, emotion, confidence, accent, or employability.', 'Sentence boundaries depend on transcription punctuation. Segment time is not the same as pure speech time.'] + (['DEMO FIXTURE: the transcript is synthetic and does not describe this recording.'] if is_mock else []),
        semantic_method=method,
        intent_assessment='Semantic overlap is a preliminary relevance signal; it cannot establish that the interviewer’s intent was fully answered.',
        ownership_clarity=f"{ownership['individual']} individual versus {ownership['team']} team pronouns. Team language is appropriate; clarify your own decision when relevant.",
        action_depth=f"{len(decisions)} segments contain decision or verification cues. Inspect the linked transcript, not just the count.",
        result_strength=f"{len(by_star['result'])} Result segments; {sum(s.evidence for s in by_star['result'])} include a numeric mention.",
        coherence=f"{backwards} backward transitions in inferred STAR order. This is a review cue, not a logical-coherence verdict.",
    )
    # Every cited index must refer to actual transcript evidence.
    for item in analysis.strengths+analysis.improvements+analysis.intersections:
        if any(i not in refs for i in item.segments):
            raise ValueError('Invalid evidence reference')
    return m, analysis

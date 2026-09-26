import io
import os
import subprocess
import tempfile
import wave
from pathlib import Path
import httpx
import numpy as np
from practice_models import Segment, Word

MAX_BYTES = 12 * 1024 * 1024
MAX_SECONDS = 300

def normalize(data: bytes):
    import imageio_ffmpeg
    if not 100 <= len(data) <= MAX_BYTES:
        raise ValueError('Choose a non-empty recording under 12 MB.')
    # No URLs, user filenames or shell interpolation. Temporary directory is removed
    # on success AND failure. Restrict demuxers to browser audio containers.
    with tempfile.TemporaryDirectory(prefix='mecode-audio-') as folder:
        source = Path(folder)/'input.audio'; output = Path(folder)/'normalized.wav'
        source.write_bytes(data)
        try:
            result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-nostdin', '-v','error',
                '-protocol_whitelist','file,pipe', '-format_whitelist','matroska,webm,mov,mp4,m4a,3gp,3g2,mj2,ogg,wav,mp3',
                '-i',str(source),'-vn','-ac','1','-ar','16000','-t','301','-c:a','pcm_s16le',str(output)],
                capture_output=True,timeout=25)
        except subprocess.TimeoutExpired as exc:
            raise ValueError('Audio decoding timed out. Re-record a shorter answer.') from exc
        if result.returncode or not output.exists():
            raise ValueError('This recording could not be decoded. Try WebM, MP4, Ogg, MP3, or WAV audio.')
        wav = output.read_bytes()
    with wave.open(io.BytesIO(wav)) as recording:
        duration = recording.getnframes()/recording.getframerate()
        pcm = np.frombuffer(recording.readframes(recording.getnframes()),dtype='<i2').astype(float)/32768
    if duration < 2 or duration > MAX_SECONDS:
        raise ValueError('Record between 2 seconds and 5 minutes of audio.')
    # Transparent energy gate; do not label this physiological articulation time.
    frame = 320
    rms = np.array([np.sqrt(np.mean(pcm[i:i+frame]**2)) for i in range(0,len(pcm),frame)])
    threshold = max(.012, float(np.percentile(rms,20))*3)
    active = min(duration, float(np.sum(rms>threshold))*.02)
    return wav, duration, {"active_seconds":round(active,2),"quiet_seconds":round(duration-active,2),"method":"20ms RMS energy gate; may include noise and miss quiet speech, not precise articulation/silence"}

def provider_name():
    name = os.getenv('PRACTICE_PROVIDER','deepgram')
    if name == 'mock':
        if os.getenv('APP_ENV') == 'production' or os.getenv('PRACTICE_ALLOW_MOCK') != 'true':
            raise ValueError('Mock transcription is disabled. Enable PRACTICE_ALLOW_MOCK=true only for local testing.')
    elif name != 'deepgram':
        raise ValueError('Set PRACTICE_PROVIDER=deepgram (or mock for local tests).')
    elif not os.getenv('DEEPGRAM_API_KEY'):
        raise ValueError('Transcription is not configured. Add DEEPGRAM_API_KEY to backend/.env and restart the backend. Your recording is still available to retry.')
    return name

def segment_words(items, duration):
    if len(items)>3000:
        raise ValueError('Transcript exceeded the supported word limit.')
    validated = [Word.model_validate(w) for w in items]
    if len(validated)<3:
        raise ValueError('Too little speech was recognized. Check the microphone and try again.')
    last = 0
    for word in validated:
        if word.start < last-.02 or word.end > duration+.25:
            raise ValueError('Transcriber returned inconsistent timestamps. Please retry.')
        word.end = min(word.end,duration); last = word.end
    groups=[]; group=[]
    for word in validated:
        if group and (word.start-group[-1].end>=1.5 or len(group)>=35 or group[-1].text.endswith(('.', '?', '!'))):
            groups.append(group);group=[]
        group.append(word)
    if group: groups.append(group)
    return [Segment(index=i,start=g[0].start,end=g[-1].end,text=' '.join(w.text for w in g),words=g) for i,g in enumerate(groups)]

async def transcribe(wav, duration, provider):
    if provider == 'mock':
        phrases = [
            'During our launch, the team faced a backlog of customer requests.',
            'I was responsible for reducing the backlog before the next release.',
            'Um, I compared two options and chose a queue because it isolated failures.',
            'I built a prototype and tested it with 50 requests, you know, before launch.',
            'As a result, we reduced response time by 30 percent and I learned to verify load earlier.'
        ]
        tokens = ' '.join(phrases).split(); step = duration/(len(tokens)+10)
        items=[dict(text=t,start=round(step*(i+2),3),end=round(step*(i+2.75),3),confidence=1) for i,t in enumerate(tokens)]
        return segment_words(items,duration)
    try:
        async with httpx.AsyncClient(timeout=75) as client:
            response = await client.post('https://api.deepgram.com/v1/listen',
                params={'model':os.getenv('DEEPGRAM_MODEL','nova-3'),'language':'en','punctuate':'true','filler_words':'true','smart_format':'false'},
                headers={'Authorization':'Token '+os.environ['DEEPGRAM_API_KEY'],'Content-Type':'audio/wav'},content=wav)
        if response.status_code in (401,403):
            raise ValueError('The transcription provider rejected its API key. Update DEEPGRAM_API_KEY on the server.')
        if response.status_code == 429:
            raise ValueError('The transcription provider is busy or out of quota. Retry later.')
        if response.status_code != 200:
            raise ValueError('Transcription service failed. Your recording is preserved; retry shortly.')
        raw = response.json()['results']['channels'][0]['alternatives'][0]['words']
        return segment_words([{'text':w.get('punctuated_word',w['word']),'start':w['start'],'end':w['end'],'confidence':w.get('confidence',0)} for w in raw],duration)
    except httpx.HTTPError as exc:
        raise ValueError('Transcription connection timed out. Your recording is preserved; retry.') from exc
    except (KeyError,TypeError) as exc:
        raise ValueError('The transcription provider returned an unreadable result. Retry this recording.') from exc

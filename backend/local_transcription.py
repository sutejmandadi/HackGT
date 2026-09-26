"""Isolated CPU transcription worker. No audio leaves this process."""
import json
import sys
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent / '.models' / 'whisper-base.en'

def recognize(path):
    from faster_whisper import WhisperModel
    model = WhisperModel(str(MODEL_DIR), device='cpu', compute_type='int8',
                         cpu_threads=4, local_files_only=True)
    segments, _ = model.transcribe(path, language='en', word_timestamps=True,
        beam_size=5, vad_filter=True, condition_on_previous_text=False)
    return [dict(text=w.word.strip(), start=w.start, end=w.end, confidence=w.probability)
            for segment in segments for w in (segment.words or []) if w.word.strip() and w.end>w.start]

if __name__ == '__main__':
    if sys.argv[1:] == ['--download']:
        from faster_whisper.utils import download_model
        download_model('base.en', output_dir=str(MODEL_DIR))
        print('Local English transcription model is ready.')
    else:
        try:
            print(json.dumps(recognize(sys.argv[1])))
        except Exception:
            print('Local transcription failed. Verify the model installation and retry.', file=sys.stderr)
            sys.exit(1)

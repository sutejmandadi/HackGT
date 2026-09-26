import asyncio
import base64
import json
import os
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from practice_models import Metadata, Report
from practice_audio import MAX_BYTES, normalize, transcribe, provider_name
from practice_metrics import analyze
from practice_store import authenticate

router=APIRouter()
slots=asyncio.Semaphore(2)
active=set()
def event(kind,data):return 'data: '+json.dumps({'type':kind,**data})+'\n\n'

@router.get('/api/practice/config')
async def configuration(request: Request):
    await authenticate(request.headers.get('authorization'))
    try:
        mode=provider_name()
        return {'mode':mode,'ready':True}
    except ValueError as exc:
        return {'mode':os.getenv('PRACTICE_PROVIDER','deepgram'),'ready':False,'message':str(exc)}

@router.get('/api/practice')
async def list_attempts(request: Request, offset: int=0):
    store=await authenticate(request.headers.get('authorization'))
    if offset<0 or offset>100000:raise HTTPException(400,'Invalid page.')
    if store is None:return {'attempts':[],'total':0,'next':None,'local':True}
    try:return await store.list(offset)
    except ValueError as exc:raise HTTPException(503,str(exc)) from exc

@router.delete('/api/practice/{id}')
async def delete_attempt(id: UUID, request: Request):
    store=await authenticate(request.headers.get('authorization'))
    if store:
        try:await store.delete(str(id))
        except ValueError as exc:raise HTTPException(503,str(exc)) from exc
    return {'deleted':str(id)}

@router.post('/api/practice')
async def submit(request: Request):
    store=await authenticate(request.headers.get('authorization'))
    try:
        raw=request.headers.get('x-practice-meta','')
        if len(raw)>8000:raise ValueError()
        meta=Metadata.model_validate_json(base64.b64decode(raw,validate=True))
    except (ValueError,ValidationError):raise HTTPException(400,'Invalid question or attempt metadata.')
    if request.headers.get('content-type','').split(';')[0] not in {'audio/webm','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/mpeg'}:
        raise HTTPException(415,'Record WebM, MP4, Ogg, MP3, or WAV audio.')
    try:provider=provider_name()
    except ValueError as exc:raise HTTPException(503,str(exc)) from exc
    owner=store.owner if store else 'local'
    if slots.locked() or owner in active:raise HTTPException(429,'An answer is already processing. Please retry shortly.')
    await slots.acquire();active.add(owner)
    data=bytearray()
    try:
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data)>MAX_BYTES:raise HTTPException(413,'Recording exceeds 12 MB. Record a shorter answer.')
    except BaseException:
        slots.release();active.discard(owner);raise
    async def pipeline():
        begun=False
        try:
            yield event('stage',{'stage':'Validating audio'})
            wav,duration,activity=await run_in_threadpool(normalize,bytes(data))
            if store:
                current=await store.begin(meta);begun=True
                if current['status']=='completed':
                    yield event('result',{'report':current});return
            yield event('stage',{'stage':'Transcribing'})
            segments=await transcribe(wav,duration,provider)
            del wav
            yield event('stage',{'stage':'Analyzing'})
            scorer=getattr(request.app.state,'scorer',None)
            m,a=await run_in_threadpool(analyze,segments,duration,meta.prompt,meta.competency,getattr(scorer,'model',None),activity,provider=='mock')
            report=Report(**meta.model_dump(mode='json'),created_at=datetime.now(timezone.utc).isoformat(),duration=duration,
                transcript=' '.join(s.text for s in segments),segments=segments,metrics=m,analysis=a,is_mock=provider=='mock')
            yield event('stage',{'stage':'Saving report'})
            saved=await store.finish(report) if store else report.model_dump(mode='json')
            yield event('result',{'report':saved,'local':store is None})
        except asyncio.CancelledError:
            if store and begun:
                try:await asyncio.shield(store.fail(str(meta.id),'Processing was interrupted. Retry the original recording.'))
                except Exception:pass
            raise
        except Exception as exc:
            message=str(exc) if isinstance(exc,ValueError) and not isinstance(exc,ValidationError) else 'Analysis failed. Your recording is preserved. Retry shortly.'
            if store and begun:
                try:await store.fail(str(meta.id),message)
                except Exception:pass
            yield event('error',{'error':message})
        finally:
            data.clear();active.discard(owner);slots.release()
    return StreamingResponse(pipeline(),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})

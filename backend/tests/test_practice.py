import asyncio
import base64
import io
import json
import math
import os
import unittest
import wave
from array import array
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from practice_models import Segment, Word, Metadata
from practice_metrics import metrics, analyze, score_components, fill
from practice_audio import normalize, segment_words, provider_name, transcribe
from practice_routes import router
from practice_store import authenticate, Store

def segment(text,start=0,step=.5,section='actions',index=0):
    tokens=text.split()
    return Segment(index=index,start=start,end=start+len(tokens)*step,text=text,star=section,
        words=[Word(text=t,start=start+i*step,end=start+(i+1)*step) for i,t in enumerate(tokens)])

def wav(seconds=3):
    buf=io.BytesIO()
    with wave.open(buf,'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(16000)
        f.writeframes(array('h',(int(math.sin(i*.1)*4000) for i in range(int(16000*seconds)))).tobytes())
    return buf.getvalue()

META={'id':'712d7272-89e8-4c67-8777-df13b5d1e5ad','question_id':'lead-1','prompt':'Tell me about a time you led a team.','competency':'leadership','linked_story_id':None}

class MetricsTests(unittest.TestCase):
    def test_wpm(self):
        m=metrics([segment('one two three four five six',step=5)],60)
        self.assertEqual(m['wpm'],6)
        self.assertEqual(m['speaking_wpm'],12)

    def test_filler_precision(self):
        s=segment('Um, I like coding. It looks like rain. Uh, you know, I mean, like, really.')
        detected=fill(s)
        self.assertEqual([f['type'] for f in detected],['um','uh','you know','i mean','like (discourse cue)'])

    def test_pauses_and_star(self):
        segments=[segment('The release was blocked.',section='situation'),segment('I built a queue.',start=6,section='actions',index=1)]
        m=metrics(segments,10)
        self.assertEqual(m['pauses'][0]['seconds'],4)
        self.assertTrue(m['pauses'][0]['long'])
        self.assertEqual(m['star']['actions']['percent'],50)
        self.assertEqual(m['star']['situation']['words'],4)

    def test_score_formula(self):
        s=segment('I built a service and reduced time by 30 percent because tests showed a bottleneck.',step=.4)
        s.evidence=True;s.relevance=.4
        m=metrics([s],6)
        scores=score_components(m,[s])
        self.assertEqual(scores['Specificity'],40)
        self.assertEqual(scores['Relevance'],80)
        self.assertAlmostEqual(scores['Overall'],round(sum(v for k,v in scores.items() if k!='Overall')/5,1))

    def test_no_empty_results_invented(self):
        s=segment('I built a prototype because testing mattered.')
        m,a=analyze([s],10,META['prompt'],'leadership')
        self.assertEqual(m['star']['result']['words'],0)
        self.assertEqual(a.scores['Impact'],0)
        self.assertEqual(len(a.improvements),3)
        self.assertNotIn('Relevance',a.scores)
        self.assertTrue(all(i in [0] for f in a.improvements for i in f.segments))

    def test_ownership_repetition(self):
        m=metrics([segment('I built it. We tested it. I built it. We we tested it.')],15)
        self.assertEqual(m['ownership'],{'individual':2,'team':3})
        self.assertEqual(m['repeated_words']['we'],1)
        self.assertIn({'phrase':'i built it','count':2},m['repeated_phrases'])

    def test_timestamp_validation(self):
        with self.assertRaises(ValueError):
            segment_words([{'text':'word','start':i,'end':i+1} for i in [3,2,1]],10)

    def test_decode_and_duration(self):
        normalized,duration,activity=normalize(wav())
        self.assertTrue(normalized.startswith(b'RIFF'));self.assertAlmostEqual(duration,3,places=1)
        self.assertTrue(activity['active_seconds']>=0)
        with self.assertRaises(ValueError):normalize(b'not audio'*100)
        with self.assertRaises(ValueError):normalize(wav(.5))

    def test_missing_credentials_and_mock_gate(self):
        with patch.dict(os.environ,{'PRACTICE_PROVIDER':'deepgram','DEEPGRAM_API_KEY':''}):
            with self.assertRaisesRegex(ValueError,'DEEPGRAM_API_KEY'):provider_name()
        with patch.dict(os.environ,{'PRACTICE_PROVIDER':'mock','PRACTICE_ALLOW_MOCK':'true','APP_ENV':'production'}):
            with self.assertRaises(ValueError):provider_name()

    def test_mock_provider(self):
        segments=asyncio.run(transcribe(b'',60,'mock'))
        self.assertEqual(len(segments),5)
        m,a=analyze(segments,60,META['prompt'],'leadership',is_mock=True)
        self.assertTrue(any('DEMO' in l for l in a.limitations))
        self.assertEqual(m['filler_count'],2)

class ApiTests(unittest.TestCase):
    def setUp(self):
        app=FastAPI();app.include_router(router);self.client=TestClient(app)
        self.headers={'content-type':'audio/wav','x-practice-meta':base64.b64encode(json.dumps(META).encode()).decode()}

    def test_authentication_required_and_partial_config(self):
        with patch.dict(os.environ,{'NEXT_PUBLIC_SUPABASE_URL':'https://test.example','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'public'}):
            self.assertEqual(self.client.get('/api/practice').status_code,401)
        with patch.dict(os.environ,{'NEXT_PUBLIC_SUPABASE_URL':'https://test.example','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'','SUPABASE_ANON_KEY':''}):
            self.assertEqual(self.client.get('/api/practice').status_code,503)

    def test_api_validation_and_stream(self):
        with patch('practice_routes.authenticate',AsyncMock(return_value=None)),patch.dict(os.environ,{'PRACTICE_PROVIDER':'mock','PRACTICE_ALLOW_MOCK':'true','APP_ENV':'development'}):
            self.assertEqual(self.client.post('/api/practice',content=wav(),headers={'content-type':'audio/wav'}).status_code,400)
            self.assertEqual(self.client.post('/api/practice',content=b'a',headers={**self.headers,'content-type':'text/html'}).status_code,415)
            self.assertEqual(self.client.post('/api/practice',content=b'a'*(12*1024*1024+1),headers=self.headers).status_code,413)
            response=self.client.post('/api/practice',content=wav(),headers=self.headers)
            events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
            self.assertEqual(events[-1]['type'],'result');self.assertTrue(events[-1]['report']['is_mock'])
            self.assertEqual([e['stage'] for e in events if e['type']=='stage'],['Validating audio','Transcribing','Analyzing','Saving report'])

    def test_owner_scope_store_calls(self):
        store=Store('https://example.test','public','token','owner-a')
        response=type('Response',(),{'json':lambda self:[]})()
        store.request=AsyncMock(return_value=response)
        asyncio.run(store.get(META['id']))
        self.assertEqual(store.request.call_args.kwargs['params']['owner_id'],'eq.owner-a')

    def test_persistence_error_preserves_failure_status(self):
        store=AsyncMock();store.owner='owner-a';store.begin.return_value={'status':'processing'};store.finish.side_effect=ValueError('Database unavailable')
        with patch('practice_routes.authenticate',AsyncMock(return_value=store)),patch.dict(os.environ,{'PRACTICE_PROVIDER':'mock','PRACTICE_ALLOW_MOCK':'true','APP_ENV':'development'}):
            response=self.client.post('/api/practice',content=wav(),headers=self.headers)
            self.assertIn('Database unavailable',response.text);store.fail.assert_awaited_once()

if __name__=='__main__':unittest.main()

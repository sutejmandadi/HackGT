"""User-scoped REST calls: never uses a service-role key or trusts a client owner ID."""
import os
import httpx
from fastapi import HTTPException

class Store:
    def __init__(self, url, key, token, owner):
        self.url=url.rstrip('/'); self.owner=owner
        self.headers={'apikey':key,'Authorization':'Bearer '+token}

    async def request(self, method, path, **kwargs):
        headers={**self.headers,**kwargs.pop('headers',{})}
        async with httpx.AsyncClient(timeout=20) as client:
            res=await client.request(method,self.url+'/rest/v1/'+path,headers=headers,**kwargs)
        if res.status_code>=400:
            if res.status_code in (401,403):
                raise ValueError('Session expired or access denied. Sign in again.')
            if res.status_code==404:
                raise ValueError('Practice tables are unavailable. Apply migration 003_practice_attempts.sql.')
            raise ValueError('Could not save or load practice data. Check your connection and migration 003; retrying the same recording is safe.')
        return res

    async def get(self, id):
        res=await self.request('GET','practice_attempts',params={'id':'eq.'+id,'owner_id':'eq.'+self.owner,'select':'*,practice_segments(*)'})
        rows=res.json()
        if not rows:return None
        row=rows[0]; row['segments']=sorted([s['data'] for s in row.pop('practice_segments',[])],key=lambda s:s['index'])
        return row

    async def begin(self, metadata):
        data=metadata.model_dump(mode='json')
        await self.request('POST','practice_attempts',params={'on_conflict':'id'},headers={'Prefer':'resolution=ignore-duplicates'},json={**data,'owner_id':self.owner,'status':'processing'})
        current=await self.get(str(metadata.id))
        if current is None:raise ValueError('Attempt is not accessible.')
        if any(current[k] != data[k] for k in ['question_id','prompt','competency','linked_story_id']):
            raise ValueError('Attempt metadata changed. Discard and make a new recording.')
        return current

    async def finish(self, report):
        await self.request('POST','rpc/complete_practice_attempt',json={'report':report.model_dump(mode='json')})
        return await self.get(report.id)

    async def fail(self,id,message):
        await self.request('PATCH','practice_attempts',params={'id':'eq.'+id,'owner_id':'eq.'+self.owner,'status':'neq.completed'},json={'status':'failed','error':message[:400]})

    async def list(self,offset):
        res=await self.request('GET','practice_attempts',params={'select':'*,practice_segments(*)','owner_id':'eq.'+self.owner,'order':'created_at.desc,id.desc','limit':'50','offset':str(offset)},headers={'Prefer':'count=exact'})
        rows=res.json()
        for row in rows:row['segments']=sorted([s['data'] for s in row.pop('practice_segments',[])],key=lambda s:s['index'])
        count=res.headers.get('content-range','*/0').split('/')[-1]
        return {'attempts':rows,'total':int(count) if count.isdigit() else len(rows),'next':offset+50 if len(rows)==50 else None}

    async def delete(self,id):
        res=await self.request('DELETE','practice_attempts',params={'id':'eq.'+id,'owner_id':'eq.'+self.owner},headers={'Prefer':'return=representation'})
        if not res.json():raise HTTPException(404,'Attempt not found.')

async def authenticate(authorization):
    url=os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key=os.getenv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    if not url and not key:
        if os.getenv('APP_ENV','development')=='production':raise HTTPException(503,'Configure Supabase authentication on the server.')
        return None
    if not url or not key:raise HTTPException(503,'Configure the Supabase URL and public key on the backend.')
    if not authorization or not authorization.lower().startswith('bearer '):raise HTTPException(401,'Sign in to practice.')
    token=authorization[7:]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res=await client.get(url.rstrip('/')+'/auth/v1/user',headers={'apikey':key,'Authorization':'Bearer '+token})
        if res.status_code!=200 or not res.json().get('id'):raise HTTPException(401,'Your session expired. Sign in again.')
        return Store(url,key,token,res.json()['id'])
    except httpx.HTTPError as exc:raise HTTPException(503,'Could not verify your session. Retry shortly.') from exc

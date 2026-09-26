"""Isolated browser-test server. Never loaded by the production app."""
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['PRACTICE_PROVIDER']='mock';os.environ['PRACTICE_ALLOW_MOCK']='true';os.environ['APP_ENV']='development'
from main import app
import practice_routes
from fastapi import HTTPException
rows={}
class MemoryStore:
    owner='browser-test'
    async def begin(self,meta):
        rows.setdefault(str(meta.id),{**meta.model_dump(mode='json'),'created_at':datetime.now(timezone.utc).isoformat(),'status':'processing','segments':[],'error':None})
        return rows[str(meta.id)]
    async def finish(self,report):
        rows[report.id]=report.model_dump(mode='json');return rows[report.id]
    async def fail(self,id,error):rows[id].update(status='failed',error=error)
    async def list(self,offset):
        values=sorted(rows.values(),key=lambda a:a['created_at'],reverse=True)
        return {'attempts':values[offset:offset+50],'total':len(values),'next':None}
    async def delete(self,id):rows.pop(id,None)
async def authenticate(token):
    if token!='Bearer browser-test':raise HTTPException(401,'Test session required')
    return MemoryStore()
practice_routes.authenticate=authenticate
if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8001)

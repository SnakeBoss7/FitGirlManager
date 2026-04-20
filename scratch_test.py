import sys
import os
import httpx
import asyncio
sys.path.append(os.path.abspath('backend'))
from resolver import resolve_fuckingfast

async def test():
    client = httpx.AsyncClient(headers={'User-Agent': 'Mozilla/5.0'})
    url = 'https://fuckingfast.co/c91qfysft5pp'
    res = await resolve_fuckingfast(url, client)
    print('RESULT:', res)

asyncio.run(test())

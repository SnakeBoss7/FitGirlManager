import httpx
import asyncio
import json

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        req = {"url": "https://fitgirl-repacks.site/elden-ring/"}
        print("Sending request to backend...")
        r = await client.post("http://127.0.0.1:8000/api/scrape", json=req)
        print("Status Code:", r.status_code)
        try:
            data = r.json()
            queue = data.get("queue", [])
            print("Game:", data.get("game"))
            print("Total Files:", data.get("totalFiles"))
            failed = [i for i in queue if i["status"] == "failed"]
            print("Failed:", len(failed))
            if queue:
                first = queue[0]
                print("First File:", first)
        except Exception as e:
            print("Response:", r.text)
            print("Error parsing JSON:", e)

asyncio.run(main())

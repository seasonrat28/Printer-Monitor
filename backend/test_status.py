import httpx
import re

IP = "10.119.34.26"

r = httpx.get(f"http://{IP}/home/monitor.html", verify=False)
html = r.text

print("=== monitor.html ===")
m = re.search(r'class="(moni[A-Za-z0-9]+)"[^>]*>(.*?)</span>', html)
if m:
    print(f"Class: {m.group(1)}")
    print(f"Text: {m.group(2)}")
else:
    print("Could not find status span.")
    print(html[:1000])

print("\n=== status.html ===")
r2 = httpx.get(f"http://{IP}/home/status.html", verify=False)
html2 = r2.text
# Let's search for the paper low text
import bs4
soup = bs4.BeautifulSoup(html2, "html.parser")
print("Text found:", soup.text.replace('\n', ' ')[:500])

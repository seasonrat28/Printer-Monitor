import urllib.request
import urllib.error

url = "http://10.119.34.70/common/js/lcddisplay.js"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=5) as response:
        html = response.read().decode('utf-8')
        with open("printer_status.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Downloaded to printer_status.html")
except Exception as e:
    print(f"Failed to fetch {url}: {e}")

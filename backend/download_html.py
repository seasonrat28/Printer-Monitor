import urllib.request
with urllib.request.urlopen('http://10.119.34.203/PRESENTATION/HTML/TOP/PRTINFO.HTML') as response:
   html = response.read()
with open('raw_epson.html', 'wb') as f:
   f.write(html)

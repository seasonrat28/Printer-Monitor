import re, json
html = open(r'd:\app\Printer-Monitor\Lighthouse\localhost_4173-20261006T103622.html', 'r', encoding='utf-8').read()
m = re.search(r'window\.__LIGHTHOUSE_JSON__ = (\{.*?\});</script>', html, re.DOTALL)
if m:
    data = json.loads(m.group(1))
    scores = {k: v.get('score') for k, v in data.get('categories', {}).items()}
    audits = data.get('audits', {})
    failed = [v for k, v in audits.items() if v.get('score') is not None and v.get('score') < 1 and v.get('scoreDisplayMode') != 'notApplicable']
    failed.sort(key=lambda x: x.get('score', 1))
    with open(r'd:\app\Printer-Monitor\lh_result.txt', 'w', encoding='utf-8') as f:
        f.write(f'SCORES: {scores}\n')
        f.write("ISSUES:\n")
        for a in failed[:20]:
            f.write(f"- [{a.get('score')}] {a.get('id')}: {a.get('title')}\n")

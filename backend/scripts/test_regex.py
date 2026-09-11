import re

html = '<dt>Fuser&#32;Unit</dt><dd>167195<span class="unit">Page(s)</span></dd><dt>(%&#32;of&#32;Life&#32;Remaining)</dt><dd>(84%)</dd>'
html = html.replace('&#32;', ' ')
patterns = {
    'fuser_level': r'<dt>Fuser\s*(?:Unit)?\**</dt>(?:\s*<dd>(\d+)\s*%\s*</dd>|[\s\S]{1,150}?<dd>\((\d+)%\)</dd>)'
}
match = re.search(patterns['fuser_level'], html, re.IGNORECASE)
print(match.groups() if match else 'No match')

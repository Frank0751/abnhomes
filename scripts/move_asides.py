import re, pathlib

d = pathlib.Path('/home/z/my-project/download/slides')
files = ['slide_08.html', 'slide_09.html', 'slide_10.html', 'slide_11.html',
         'slide_12.html', 'slide_13.html', 'slide_14.html']

for name in files:
    p = d / name
    s = p.read_text(encoding='utf-8')
    m = re.search(r'(\n\s*<aside data-notes.*?</aside>)(\s*</div>\s*\n</body>)', s, re.S)
    if not m:
        print(name, 'PATTERN NOT FOUND')
        continue
    aside = m.group(1)
    s = s[:m.start()] + '\n</div>' + aside + '\n</body>' + s[m.end():]
    p.write_text(s, encoding='utf-8')
    # confirm aside is now a direct child of body (only </div> between </aside> and </body>)
    ok = re.search(r'</aside>\s*\n</body>\s*\n</html>\s*$', s) is not None
    print(name, 'moved:', ok)

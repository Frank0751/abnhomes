"""Post-process the generated docx for WPS/Word compatibility:
1. Patch footer PAGE fields with the explicit arabic format switch.
2. Strip empty <w:pgNumType/> elements (confuses WPS).
"""
import re
import shutil
import zipfile

SRC = "/home/z/my-project/download/ABN-Homes-Platform-Documentation.docx"
TMP = "/tmp/docx_postprocess"

shutil.rmtree(TMP, ignore_errors=True)
with zipfile.ZipFile(SRC) as z:
    z.extractall(TMP)

import glob

patched = 0
for path in glob.glob(f"{TMP}/word/footer*.xml"):
    with open(path) as fh:
        xml = fh.read()
    new = re.sub(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* arabic \\* MERGEFORMAT \2",
        xml,
    )
    if new != xml:
        with open(path, "w") as fh:
            fh.write(new)
        patched += 1

doc_path = f"{TMP}/word/document.xml"
with open(doc_path) as fh:
    doc = fh.read()
doc2 = doc.replace("<w:pgNumType/>", "")

# Deduplicate consecutive identical TOC placeholder entries (the injector can
# double-insert the first entry; keep the copy that carries the page number).
para_re = re.compile(r"<w:p\b[^>]*>.*?</w:p>", re.S)
text_re = re.compile(r"<w:t[^>]*>([^<]*)</w:t>")


def para_text(block: str) -> str:
    return "".join(text_re.findall(block))


doc3 = doc2
paras = para_re.findall(doc2)
removed = 0
for i, block in enumerate(paras):
    if i + 1 < len(paras) and para_text(paras[i + 1]).startswith(para_text(block)) and para_text(block):
        if "PAGEREF" in block and "PAGEREF" not in paras[i + 1]:
            # Keep the field-carrying block; drop the plain duplicate after it.
            doc3 = doc3.replace(paras[i + 1], "", 1)
            removed += 1
print(f"duplicate TOC entries removed: {removed}")
doc2 = doc3

if doc2 != doc:
    with open(doc_path, "w") as fh:
        fh.write(doc2)
    print("removed empty pgNumType")

import os

out = SRC
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _dirs, files in os.walk(TMP):
        for name in files:  # os.walk, not glob: must include dotfiles like _rels/.rels
            f = os.path.join(root, name)
            z.write(f, os.path.relpath(f, TMP))
print(f"footers patched: {patched}; written back to {out}")

import subprocess, json, re, os, sys
from docx import Document
D=os.path.dirname(os.path.abspath(__file__))
def run(c): subprocess.run(c,shell=True,check=True,cwd=D,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
run('pandoc proposal.md -o draft.docx --reference-doc reference.docx --number-sections')
heads=[(1 if p.style.name=='Heading 1' else 2,p.text) for p in Document(os.path.join(D,'draft.docx')).paragraphs if p.style.name in('Heading 1','Heading 2')]
toc=[(l,t,0) for l,t in heads]
prev=None
for it in range(4):
    json.dump(toc,open(os.path.join(D,'toc.json'),'w'))
    run('python3 post.py draft.docx proposal.docx toc.json')
    os.makedirs(os.path.join(D,'pdf3'),exist_ok=True)
    run('soffice --headless --convert-to pdf --outdir pdf3 proposal.docx')
    pages=subprocess.run(['pdftotext','-layout',os.path.join(D,'pdf3','proposal.pdf'),'-'],capture_output=True,text=True).stdout.split('\f')
    newtoc=[]; start=2
    for l,t in heads:
        num,_,title=t.partition('\t')
        if not title: title,num=num,''
        key=re.escape(title[:28]).replace('\\ ','\\s+')
        pat=re.compile(r'^\s*'+(re.escape(num)+r'\s+' if num else '')+key,re.M)
        pg=0
        for i in range(start,len(pages)):
            if pat.search(pages[i]): pg=i+1; start=i; break
        newtoc.append((l,t,pg))
    print('iteration',it,[x[2] for x in newtoc])
    if newtoc==toc: break
    toc=newtoc
print('pages',len(pages)-1)

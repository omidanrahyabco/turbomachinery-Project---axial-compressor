import subprocess, json, re, os
from docx import Document
D=os.path.dirname(os.path.abspath(__file__))
def run(c): subprocess.run(c,shell=True,check=True,cwd=D,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
run('pandoc report2.md -o draft.docx --reference-doc reference_r2.docx --number-sections --resource-path=.')
heads=[(1,p.text) for p in Document(os.path.join(D,'draft.docx')).paragraphs if p.style.name=='Heading 1']
toc=[(l,t,0) for l,t in heads]
for it in range(4):
    json.dump(toc,open(os.path.join(D,'toc.json'),'w'))
    run('python3 post.py draft.docx M701JAC_Report2.docx toc.json')
    run('soffice --headless --convert-to pdf --outdir . M701JAC_Report2.docx')
    pages=subprocess.run(['pdftotext','-layout',os.path.join(D,'M701JAC_Report2.pdf'),'-'],capture_output=True,text=True).stdout.split('\f')
    new=[];start=1
    for l,t in heads:
        num,_,title=t.partition('\t')
        if not title: title,num=num,''
        pat=re.compile(r'^\s*'+(re.escape(num)+r'\s+' if num else '')+re.escape(title[:28]).replace('\\ ','\\s+'),re.M)
        pg=0
        for i in range(start,len(pages)):
            body='\n'.join(l for l in pages[i].split('\n') if '.....' not in l and '…' not in l)
            if pat.search(body): pg=i+1; start=i; break
        new.append((l,t,pg))
    print('iter',it,[x[2] for x in new])
    if new==toc: break
    toc=new
for f in ('draft.docx','toc.json'): os.remove(os.path.join(D,f))
print('pages',len(pages)-1)

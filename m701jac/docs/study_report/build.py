import subprocess, json, re, os
from docx import Document
D=os.path.dirname(os.path.abspath(__file__))
def run(c): subprocess.run(c,shell=True,check=True,cwd=D,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
run('pandoc study_report.md -o draft.docx --reference-doc reference_study.docx --number-sections --resource-path=.:../../analysis')
heads=[(1 if p.style.name=='Heading 1' else 2,p.text) for p in Document(os.path.join(D,'draft.docx')).paragraphs if p.style.name in('Heading 1','Heading 2')]
toc=[(l,t,0) for l,t in heads]
for it in range(4):
    json.dump(toc,open(os.path.join(D,'toc.json'),'w'))
    run('python3 post.py draft.docx M701JAC_Study_Report.docx toc.json')
    run('soffice --headless --convert-to pdf --outdir . M701JAC_Study_Report.docx')
    pages=subprocess.run(['pdftotext','-layout',os.path.join(D,'M701JAC_Study_Report.pdf'),'-'],capture_output=True,text=True).stdout.split('\f')
    new=[];start=2
    for l,t in heads:
        num,_,title=t.partition('\t')
        if not title: title,num=num,''
        pat=re.compile(r'^\s*'+(re.escape(num)+r'\s+' if num else '')+re.escape(title[:28]).replace('\\ ','\\s+'),re.M)
        pg=0
        for i in range(start,len(pages)):
            if pat.search(pages[i]): pg=i+1; start=i; break
        new.append((l,t,pg))
    print('iter',it,[x[2] for x in new])
    if new==toc: break
    toc=new
for f in ('draft.docx','toc.json'): os.remove(os.path.join(D,f))
print('pages',len(pages)-1)

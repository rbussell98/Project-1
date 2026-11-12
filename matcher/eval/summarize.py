import json,statistics as st,sys,os
out=[]
for lv in ['mild','harsh','real']:
    f=f'eval/results_{lv}_full.json'
    if not os.path.exists(f): continue
    r=json.load(open(f)); n=len(r)
    t1=sum(x['rank']==1 for x in r); t3=sum(1<=x['rank']<=3 for x in r)
    tt=[x['timing']['done'] for x in r if x.get('timing')]
    fast=sum(1 for x in r if x.get('fast'))
    out.append(f"### {lv}: top-1 {t1}/{n} ({100*t1//n}%), top-3 {t3}/{n} ({100*t3//n}%); runtime mean {st.mean(tt)/1000:.1f}s median {st.median(tt)/1000:.1f}s (warm caches); fast-path (index only) {fast}/{n}; stage-B used {sum(1 for x in r if x.get('stageB'))}")
    if lv!='real':
        for k,lab in [(False,'same-edition photo'),(True,'different-edition photo')]:
            s=[x for x in r if bool(x.get('altEdition'))==k]
            if s: out.append(f"- {lab}: top-1 {sum(x['rank']==1 for x in s)}/{len(s)}, top-3 {sum(1<=x['rank']<=3 for x in s)}/{len(s)}")
        for st_ in sorted({x['style'] for x in r}):
            s=[x for x in r if x['style']==st_]
            out.append(f"- style {st_}: top-1 {sum(x['rank']==1 for x in s)}/{len(s)}")
    out.append("\n| Album | Style | Edition | Rank | OCR read | Top-1 returned | Time s |\n|---|---|---|---|---|---|---|")
    for x in r:
        out.append(f"| {x['artist']} - {x['title']} | {x['style']} | {'alt' if x.get('altEdition') else 'same'} | {x['rank'] or 'miss'} | {' / '.join(x['phrases'][:2]) or '-'} | {(x['top'][0] if x['top'] else '-')[:48]} | {x['timing']['done']/1000:.1f}{' (fast)' if x.get('fast') else ''} |")
    out.append('')
open('RESULTS.md','w').write("# RESULTS\n\nPipeline: crop+CLIP image ranking, 9.6k popular index, OCR->MusicBrainz candidates. Test photos are synthetic phone-photo degradations of CAA covers (30 albums, 25 are alt-edition images).\n\n"+"\n".join(out))
print("\n".join(out[:14]))


const LABELS=[
'birthday','date','month','day','surname','given name\\(s\\)','given names?',
'first name','last name','full name','name','email(?: address)?','mobile','phone(?: number)?',
'address','postcode','zip(?: code)?','city','state','country','position applied for',
'preferred store location','expiry date','visa type','contact name','relationship to you',
'company and position','license number','qualification','name of institute','year',
'signature','employer','supervisor','position','duties','reason for leaving',
'highest school qualification','post graduate qualification','length of time at this address',
'contact telephone no','dates employed','contact information'
];
const pattern=new RegExp('(?:^|\\s)('+LABELS.join('|')+')\\s*:','gi');
export function labelSegments(text){
  const hits=[];
  for(const m of text.matchAll(pattern)){
    const colon=m.index+m[0].lastIndexOf(':');
    const start=m.index+m[0].indexOf(m[1]);
    hits.push({label:m[1],start,end:colon+1});
  }
  return hits;
}
const titleCase=(s)=>s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
function approximateSegmentOffset(item,str){
  const spaceFactor=0.38;
  const score=(s)=>Array.from(s).reduce((acc,c)=>acc+(c===' '?spaceFactor:/[il1|]/.test(c)?.42:/[MW]/.test(c)?1.3:1),0);
  return (Math.abs(item.width)||str.length*5.5)*score(str)/Math.max(1,score(item.str));
}
export async function detectFields(page,pdfjsLib,existing=[],pageNumber=1){
  const content=await page.getTextContent();
  const viewport=page.getViewport({scale:1});
  const lines=new Map();
  for(const item of content.items){
    if(!item.str?.trim()||!item.transform)continue;
    const t=pdfjsLib.Util.transform(viewport.transform,item.transform);
    const y=Math.round(t[5]/4)*4;
    if(!lines.has(y))lines.set(y,[]);
    lines.get(y).push({str:item.str,x:t[4],y:t[5],width:Math.abs(item.width)||item.str.length*5.5,h:Math.max(11,Math.abs(t[3]))});
  }
  const fields=[];
  for(const items of lines.values()){
    items.sort((a,b)=>a.x-b.x);
    const labels=[];
    for(const item of items){
      for(const seg of labelSegments(item.str)){
        const prefix=item.str.slice(0,seg.start);
        const labelText=item.str.slice(seg.start,seg.end);
        const x=item.x+approximateSegmentOffset(item,prefix);
        labels.push({label:titleCase(seg.label),x,endX:Math.min(viewport.width,x+approximateSegmentOffset(item,labelText)),baseline:item.y,h:item.h});
      }
    }
    labels.sort((a,b)=>a.x-b.x);
    for(let i=0;i<labels.length;i++){
      const hit=labels[i],next=labels.slice(i+1).find(v=>v.x>hit.endX+3);
      let left=Math.max(0,hit.endX+5);
      const right=Math.min(viewport.width-21,next?next.x-7:viewport.width-30);
      let width=Math.min(250,right-left);
      let below=false;
      // Inline groups such as BIRTHDAY: DATE: MONTH: have no room after
      // each label. Offer a field immediately below the label instead.
      if(width<23&&next){
        below=true;
        left=hit.x;
        width=Math.min(165,Math.max(28,next.x-hit.x-7));
      }
      if(width<23||hit.baseline<12)continue;
      const top=below?hit.baseline+4:hit.baseline-Math.max(11,hit.h)-1;
      const [x0,y0]=viewport.convertToPdfPoint(left,top);
      const [x1,y1]=viewport.convertToPdfPoint(left+width,top+20);
      const field={id:'suggest-'+pageNumber+'-'+fields.length,page:pageNumber,
        name:hit.label+' · Page '+pageNumber,type:'text',
        x:Math.min(x0,x1),y:Math.min(y0,y1),width:Math.abs(x1-x0),height:Math.abs(y1-y0),
        value:'',source:'suggested',fontSize:11};
      if(!existing.some(e=>e.page===pageNumber&&Math.abs(e.x-field.x)<28&&Math.abs(e.y-field.y)<18))fields.push(field);
    }
  }
  return fields.slice(0,80);
}
export function parsePageRanges(value,total){
 const numbers=[];
 const segments=String(value).split(',').map(s=>s.trim()).filter(Boolean);
 if(!segments.length)throw new Error('Enter pages, for example 1-3, 5');
 for(const seg of segments){
  if(!/^\d+(?:\s*-\s*\d+)?$/.test(seg))throw new Error('Invalid range: '+seg);
  const [a,b]=seg.split('-').map(x=>Number(x.trim())),end=b===undefined?a:b;
  if(a<1||end>total||a>end)throw new Error('Page range is outside this document');
  for(let n=a;n<=end;n++)if(!numbers.includes(n-1))numbers.push(n-1);
 }
 return numbers;
}

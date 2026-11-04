let pdfjs;
async function ensureRenderer(){if(!pdfjs){pdfjs=await import('pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;}return pdfjs;}
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {createIcons, FilePenLine, Files, Scissors, Minimize2, LayoutGrid, ShieldCheck, Sparkles, FileUp, Plus, Type, Layers, MousePointer2, SquareCheck, Calendar, PenLine, ScanText, PanelRightOpen, Minus, ChevronLeft, ChevronRight, FileText, FolderOpen, Save, Undo2, Redo2, Download, CheckCheck, FolderInput, PanelRight, ArrowUpRight, MousePointerClick, FileCheck2, WandSparkles, ArrowUp, ArrowDown, X, RotateCw, ArrowLeft, ArrowRight, SlidersHorizontal} from 'lucide';
const iconPack = {FilePenLine, Files, Scissors, Minimize2, LayoutGrid, ShieldCheck, Sparkles, FileUp, Plus, Type, Layers, MousePointer2, SquareCheck, Calendar, PenLine, ScanText, PanelRightOpen, Minus, ChevronLeft, ChevronRight, FileText, FolderOpen, Save, Undo2, Redo2, Download, CheckCheck, FolderInput, PanelRight, ArrowUpRight, MousePointerClick, FileCheck2, WandSparkles, ArrowUp, ArrowDown, X, RotateCw, ArrowLeft, ArrowRight, SlidersHorizontal};
import {detectFields, parsePageRanges} from './detection.js';
import './style.css';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=> 'field-'+Math.random().toString(36).slice(2,11);
const size=(n)=>n>=1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB';
const icon=(name)=>'<i data-lucide="'+name+'"></i>';
const drawIcons=()=>createIcons({icons:iconPack,attrs:{'stroke-width':'1.8'}});
const S={mode:'edit',fileName:'',raw:null,pdf:null,hash:null,count:0,page:1,scale:1,
  fields:[],suggestions:[],selected:null,action:'select',renderId:0,renderTask:null,viewport:null,
  mergeFiles:[],organize:[],working:false,panelPinned:false,undo:[],redo:[],scanBusy:false};
let toastTimer;
function toast(msg){const e=$('#toast');e.hidden=false;e.textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,4500);}
function reportError(err){console.error(err);toast(err?.message||String(err));}
function download(data,name,type='application/pdf'){const a=document.createElement('a');const u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),20000);}
function stem(name){return String(name||'document').replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9_. -]/g,'_');}
function copyFields(){return JSON.parse(JSON.stringify(S.fields));}
function checkpoint(){S.undo.push(copyFields());if(S.undo.length>35)S.undo.shift();S.redo=[];}
function undo(){if(!S.undo.length)return;S.redo.push(copyFields());S.fields=S.undo.pop();saveDraft();refreshFields();toast('Undone');}
function redo(){if(!S.redo.length)return;S.undo.push(copyFields());S.fields=S.redo.pop();saveDraft();refreshFields();toast('Redone');}
function key(){return S.hash?'pdfmaster.v1.'+S.hash:null;}
function saveDraft(){try{if(key())localStorage.setItem(key(),JSON.stringify(S.fields));}catch(e){console.warn('Local storage unavailable',e);}}
function hashBytes(bytes){return crypto.subtle.digest('SHA-256',bytes.slice()).then(v=>[...new Uint8Array(v)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32));}
function setMode(mode){S.mode=mode;$$('.rail-item').forEach(el=>el.classList.toggle('active',el.dataset.tool===mode));
  $('#main').classList.remove('view-enter');void $('#main').offsetHeight;$('#main').classList.add('view-enter');
  if(mode==='edit'){if(S.pdf)showEditor();else showWelcome();}else showUtility(mode);
}
function bindDrop(zone,multi=false){
 zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover')});
 zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
 zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');const files=[...e.dataTransfer.files].filter(f=>/\.pdf$/i.test(f.name));if(files.length)multi?addMergeFiles(files):loadPdf(files[0]);});
}
function showWelcome(){
 $('#main').innerHTML=`
 <section class="landing">
  <span class="eyebrow">${icon('sparkles')} ALL YOUR PDF TOOLS IN ONE PLACE</span>
  <h1>PDFs, made<br/>effortless.</h1>
  <p class="intro">Edit, fill, sign, merge, split, compress or reorder pages. Your documents stay on your device, exactly where they belong.</p>
  <div class="upload-zone" id="drop-zone" role="button" tabindex="0" aria-label="Upload PDF">
   <div class="upload-icon">${icon('file-up')}</div><strong>Drop your PDF here</strong>
   <p>Or browse files on your computer</p><span class="btn primary">${icon('plus')} Choose PDF</span>
  </div>
  <div class="feature-grid">
   <div class="feature-card"><div class="feature-icon">${icon('type')}</div><strong>Smart forms & editing</strong><p>Fill existing forms or add text, dates and checkboxes to almost any PDF.</p></div>
   <div class="feature-card"><div class="feature-icon">${icon('layers')}</div><strong>Every page, your way</strong><p>Merge, extract, reorder and rotate with simple controls.</p></div>
   <div class="feature-card"><div class="feature-icon">${icon('shield-check')}</div><strong>Local-first privacy</strong><p>Documents are processed in the browser. Nothing is uploaded to PDF Master.</p></div>
  </div>
 </section>`;
 $('#drop-zone').addEventListener('click',()=>$('#file-input').click());
 $('#drop-zone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file-input').click();}});
 bindDrop($('#drop-zone'));drawIcons();
}
async function loadPdf(file){
 try{
  await ensureRenderer();
  const raw=new Uint8Array(await file.arrayBuffer());
  if(String.fromCharCode(...raw.slice(0,4))!=='%PDF')throw Error('Choose a valid PDF file.');
  S.renderId++;if(S.renderTask){try{S.renderTask.cancel();}catch{}}
  if(S.pdf){try{await S.pdf.destroy();}catch{}}
  const pdf=await pdfjs.getDocument({data:raw.slice(),useSystemFonts:true}).promise;
  S.pdf=pdf;S.raw=raw;S.fileName=file.name;S.count=pdf.numPages;S.page=1;S.fields=[];S.suggestions=[];S.undo=[];S.redo=[];S.selected=null;S.action='select';S.scale=1;S.manualZoom=false;
  S.hash=await hashBytes(raw);
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);
    const annotations=await page.getAnnotations();
    for(const a of annotations){
      if(a.subtype!=='Widget'||!a.rect||!a.fieldName)continue;
      if(!['Tx','Ch','Btn'].includes(a.fieldType)||a.fieldType==='Btn'&&!a.checkBox)continue;
      const r=a.rect;
      S.fields.push({id:'native-'+n+'-'+S.fields.length,name:a.fieldName,page:n,type:a.checkBox?'checkbox':'text',
        x:Math.min(r[0],r[2]),y:Math.min(r[1],r[3]),width:Math.abs(r[2]-r[0]),height:Math.abs(r[3]-r[1]),
        value:a.checkBox?(a.fieldValue&&a.fieldValue!=='Off'):String(a.fieldValue??''),
        source:'existing',fieldName:a.fieldName,fontSize:11});
    }
    page.cleanup();
  }
  try{
    const saved=JSON.parse(localStorage.getItem(key())||'null');
    if(Array.isArray(saved)){
      for(const f of saved){
        const orig=S.fields.find(a=>a.source==='existing'&&a.fieldName===f.fieldName&&a.page===f.page);
        if(orig)orig.value=f.value;
        else if(f.source==='added'&&f.page<=S.count)S.fields.push(f);
      }
      toast('Restored your last locally saved draft');
    }
  }catch(e){console.warn('Could not restore saved draft',e);}
  setMode('edit');void scanFields(true);
 }catch(e){reportError(e);}
}
async function scanFields(silent=false){
 if(!S.pdf||S.scanBusy)return;S.scanBusy=true;
 const result=[];
 try{
  for(let n=1;n<=Math.min(S.count,40);n++){
    const page=await S.pdf.getPage(n);
    result.push(...await detectFields(page,pdfjs,S.fields,n));
    page.cleanup();
  }
  S.suggestions=result.filter(f=>!S.fields.some(x=>x.page===f.page&&Math.abs(x.x-f.x)<30&&Math.abs(x.y-f.y)<18));
  if(S.mode==='edit')refreshFields();
  if(!silent)toast(result.length?'Found '+result.length+' possible fields. Review them in the sidebar.':'No text labels found. You can add fields manually, including on scanned PDFs.');
 }catch(e){console.warn('Field scan',e);if(!silent)toast('Automatic detection unavailable for this PDF. Manual editing works.');}
 finally{S.scanBusy=false;}
}

function showEditor(){
  $('#main').innerHTML=`
  <div class="editor">
   <div class="editor-header">
    <div class="file-heading"><span class="file-icon">${icon('file-text')}</span><span><strong title="${esc(S.fileName)}">${esc(S.fileName)}</strong><small>${S.count} pages · ${size(S.raw.length)}</small></span></div>
    <div class="header-actions">
     <button type="button" class="btn small" data-action="open">${icon('folder-open')} Open</button>
     <button type="button" class="btn small" data-action="save-data" title="Download field values as JSON">${icon('save')} Save fields</button>
     <button type="button" class="btn small" data-action="undo" aria-label="Undo">${icon('undo-2')}</button>
     <button type="button" class="btn small" data-action="redo" aria-label="Redo">${icon('redo-2')}</button>
     <button type="button" class="btn primary" data-action="export">${icon('download')} Export PDF</button>
    </div>
   </div>
   <div class="editor-body">
    <div class="page-panel">
     <div class="editor-toolbar">
      <div class="tool-group" role="toolbar" aria-label="PDF editing tools">
       ${[['select','mouse-pointer-2','Select'],['text','type','Text'],['checkbox','square-check','Checkbox'],['date','calendar','Date'],['signature','pen-line','Sign']].map(([id,ico,label])=>`<button class="tool-switch ${S.action===id?'active':''}" data-action="pick-tool" data-tool="${id}" type="button" aria-label="${label} tool" aria-pressed="${S.action===id}">${icon(ico)} <span>${label}</span></button>`).join('')}
      </div>
      <div class="tool-group">
       <button class="btn small" type="button" data-action="scan">${icon('scan-text')} Detect</button><button class="btn small" type="button" data-action="toggle-fields" aria-label="Toggle document fields panel">${icon('panel-right-open')} Fields</button>
       <span class="toolbar-divider"></span>
       <button class="btn small" type="button" data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button>
       <span id="zoom-label" style="min-width:43px;text-align:center;font-size:12px;font-weight:800;color:#566a85">${Math.round(S.scale*100)}%</span>
       <button class="btn small" type="button" data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button>
      </div>
     </div>
     <div id="canvas-scroll" class="canvas-scroll"><div id="page-shell" class="page-shell"><canvas id="pdf-canvas" aria-label="PDF page ${S.page}"></canvas><div id="annotation-layer" class="annotation-layer"></div></div></div>
     <div class="bottom-nav">
      <button data-action="prev" aria-label="Previous page" type="button">${icon('chevron-left')}</button>
      <span>Page</span><input type="number" id="page-number" aria-label="Page number" min="1" max="${S.count}" value="${S.page}"/>
      <span>of ${S.count}</span>
      <button data-action="next" aria-label="Next page" type="button">${icon('chevron-right')}</button>
     </div>
    </div>
    <aside id="field-panel" class="field-panel ${S.panelPinned?'pinned':''}" aria-label="PDF fields" tabindex="0">
     <div class="panel-peek" aria-hidden="true">${icon('sliders-horizontal')}<span>FIELDS</span>${icon('chevron-left')}</div>
     <div class="panel-content">
      <div class="field-panel-head">
       <div class="field-panel-title"><div><span class="mini-eyebrow">WORKSPACE</span><h3>Document fields</h3></div><button type="button" class="pin-panel" data-action="pin-panel" aria-label="${S.panelPinned?'Unpin':'Pin'} field sidebar" aria-pressed="${S.panelPinned}">${icon('panel-right')}</button></div>
       <p>Add fields by clicking anywhere on the document. You can also let an AI agent fill the inputs here.</p>
       <div class="field-panel-actions"><button class="btn small" type="button" data-action="accept">${icon('check-check')} Accept detected</button><button class="btn small" type="button" data-action="import">${icon('folder-input')} Load data</button></div>
      </div>
      <div class="field-list" id="field-list" role="group" aria-label="Document field list"></div>
      <div class="field-panel-footer">${icon('shield-check')} Locally autosaved. <strong>AI-ready:</strong> labeled fields and stable selectors.</div>
     </div>
    </aside>
   </div>
  </div>`;
  drawIcons();bindPlacement();renderFieldList();void renderPage();
}
async function renderPage(){
  if(!S.pdf||S.mode!=='edit')return;
  const myId=++S.renderId;
  if(S.renderTask){try{S.renderTask.cancel();}catch(e){}}
  const page=await S.pdf.getPage(S.page);
  if(myId!==S.renderId)return;
  const base=page.getViewport({scale:1});
  const available=$('#canvas-scroll')?.clientWidth||850;
  // Keep the document centered and fit within viewport without aggressively shrinking.
  if(!S.manualZoom)S.scale=Math.min(1.2,Math.max(.5,(available-82)/base.width));
  const viewport=page.getViewport({scale:S.scale});
  S.viewport=viewport;
  const canvas=$('#pdf-canvas'),shell=$('#page-shell'),layer=$('#annotation-layer');
  if(!canvas||!shell)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const context=canvas.getContext('2d',{alpha:false});
  canvas.width=Math.ceil(viewport.width*dpr);canvas.height=Math.ceil(viewport.height*dpr);
  canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  shell.style.width=viewport.width+'px';shell.style.height=viewport.height+'px';
  layer.style.width=viewport.width+'px';layer.style.height=viewport.height+'px';
  const zoom=$('#zoom-label');if(zoom)zoom.textContent=Math.round(S.scale*100)+'%';
  try{
   const task=page.render({canvasContext:context,viewport,transform:dpr===1?undefined:[dpr,0,0,dpr,0,0]});S.renderTask=task;await task.promise;
  }catch(e){if(e.name!=='RenderingCancelledException')console.warn(e);}
  finally{page.cleanup();}
  if(myId!==S.renderId)return;
  drawFields();renderFieldList();
}
function rectangle(f){
 const v=S.viewport;
 const r=[...v.convertToViewportPoint(f.x,f.y),...v.convertToViewportPoint(f.x+f.width,f.y+f.height)];
 return {left:Math.min(r[0],r[2]),top:Math.min(r[1],r[3]),width:Math.abs(r[0]-r[2]),height:Math.abs(r[1]-r[3])};
}
function allFields(){return [...S.fields,...S.suggestions];}
function drawFields(){
 const layer=$('#annotation-layer');if(!layer||!S.viewport)return;
 layer.innerHTML='';layer.classList.toggle('placing',S.action!=='select');
 for(const f of allFields().filter(f=>f.page===S.page)){
  const r=rectangle(f);
  const node=document.createElement('div');
  node.className='pdf-field '+(f.source==='existing'?'existing ':'')+(f.source==='suggested'?'suggestion ':'')+(S.selected===f.id?'selected':'');
  node.dataset.fieldId=f.id;node.dataset.pdfFieldName=f.name;
  Object.assign(node.style,{left:r.left+'px',top:r.top+'px',width:Math.max(12,r.width)+'px',height:Math.max(12,r.height)+'px'});
  const input=document.createElement('input');
  input.id='overlay-'+f.id;input.dataset.fieldId=f.id;input.setAttribute('aria-label',f.name+' on page '+f.page);
  input.type=f.type==='checkbox'?'checkbox':'text';
  if(f.type==='checkbox')input.checked=!!f.value;else{input.value=String(f.value??'');input.style.fontSize=Math.max(10,(f.fontSize||11)*S.scale)+'px';if(f.type==='signature')input.style.fontFamily='cursive';}
  input.addEventListener('input',()=>changeValue(f.id,f.type==='checkbox'?input.checked:input.value,'overlay'));
  input.addEventListener('focus',()=>selectField(f.id));
  node.append(input);
  if(f.source!=='existing'){
   const mover=document.createElement('span');mover.className='drag-handle';mover.textContent='⠿';mover.title='Move field';mover.addEventListener('pointerdown',e=>beginTransform(e,f.id,'move'));node.append(mover);
   const resizer=document.createElement('span');resizer.className='resize-handle';resizer.title='Resize field';resizer.addEventListener('pointerdown',e=>beginTransform(e,f.id,'size'));node.append(resizer);
  }
  layer.append(node);
 }
}
function beginTransform(event,id,kind){
 event.preventDefault();event.stopPropagation();selectField(id);checkpoint();
 const field=allFields().find(x=>x.id===id),rect=$('#annotation-layer').getBoundingClientRect();
 const start=S.viewport.convertToPdfPoint(event.clientX-rect.left,event.clientY-rect.top);
 const original={...field};
 const move=(e)=>{
  const now=S.viewport.convertToPdfPoint(e.clientX-rect.left,e.clientY-rect.top),dx=now[0]-start[0],dy=now[1]-start[1];
  if(kind==='move'){field.x=Math.max(0,original.x+dx);field.y=Math.max(0,original.y+dy);}
  else{field.width=Math.max(14,original.width+dx);field.height=Math.max(12,original.height-dy);field.y=original.y+dy;}
  const node=$('.pdf-field[data-field-id="'+id+'"]');if(node){const r=rectangle(field);Object.assign(node.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
 };
 const end=()=>{window.removeEventListener('pointermove',move);saveDraft();};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});
}
function selectField(id,focusSide=false){
 S.selected=id;
 $$('.pdf-field').forEach(el=>el.classList.toggle('selected',el.dataset.fieldId===id));
 $$('.field-row').forEach(el=>el.classList.toggle('selected',el.dataset.fieldId===id));
 if(focusSide){const el=$('.field-row[data-field-id="'+id+'"] input');el?.focus();}
}
function changeValue(id,value,from){
 const f=allFields().find(x=>x.id===id);if(!f)return;
 f.value=value;saveDraft();
 if(from!=='overlay'){const input=$('#overlay-'+id);if(input){if(f.type==='checkbox')input.checked=!!value;else input.value=String(value);}}
 if(from!=='side'){const input=$('.field-row[data-field-id="'+id+'"] input');if(input){if(f.type==='checkbox')input.checked=!!value;else input.value=String(value);}}
}
function renderFieldList(){
 const area=$('#field-list');if(!area)return;
 const list=allFields();
 const suggestions=S.suggestions.length;
 const btn=$('[data-action="accept"]');if(btn){btn.disabled=!suggestions;btn.innerHTML=icon('check-check')+' Accept '+suggestions+' suggestions';}
 if(!list.length){area.innerHTML='<div class="no-fields">'+icon('mouse-pointer-click')+'<p>No fields yet.</p><p>Pick Text, Date or Checkbox above, then click on the page.</p></div>';drawIcons();return;}
 const groups=new Map();
 for(const f of list){if(!groups.has(f.page))groups.set(f.page,[]);groups.get(f.page).push(f);}
 area.innerHTML=[...groups.entries()].map(([page,fs])=>`
  <div class="field-group-heading"><span>PAGE ${page}</span><button type="button" data-action="jump" data-page="${page}">View ${icon('arrow-up-right')}</button></div>
  ${fs.map(f=>{
   const label=esc(f.name);
   const isChecked=f.type==='checkbox';
   return `<div class="field-row ${S.selected===f.id?'selected':''}" data-field-id="${esc(f.id)}" data-field-page="${f.page}" data-field-label="${label}">
    <div class="field-row-top"><label for="side-${esc(f.id)}">${label}</label><small>${f.source==='suggested'?'Suggested':f.source==='existing'?'Original':'Added'}</small></div>
    ${isChecked?`<label class="checkbox-row"><input type="checkbox" id="side-${esc(f.id)}" data-field-value="${esc(f.id)}" ${f.value?'checked':''}/> Marked</label>`:
    `<input type="text" autocomplete="off" id="side-${esc(f.id)}" data-field-value="${esc(f.id)}" value="${esc(f.value??'')}" placeholder="${f.type==='date'?'e.g. 04/11/2026':'Enter '+label}"/>`}
    <div class="row-foot"><button type="button" data-action="goto-field" data-field-id="${esc(f.id)}">Show on page</button>${f.source==='suggested'?`<button type="button" data-action="accept-one" data-field-id="${esc(f.id)}">Add field</button>`:f.source==='added'?`<button type="button" class="remove" data-action="remove-field" data-field-id="${esc(f.id)}">Remove</button>`:''}</div>
   </div>`;}).join('')}`).join('');
 area.querySelectorAll('[data-field-value]').forEach(el=>{
  el.addEventListener('focus',()=>selectField(el.dataset.fieldValue));
  el.addEventListener('change',()=>{const f=allFields().find(x=>x.id===el.dataset.fieldValue);if(f)changeValue(f.id,f.type==='checkbox'?el.checked:el.value,'side');});
  el.addEventListener('input',()=>{const f=allFields().find(x=>x.id===el.dataset.fieldValue);if(f&&f.type!=='checkbox')changeValue(f.id,el.value,'side');});
 });
 drawIcons();
}
function refreshFields(){renderFieldList();drawFields();}
function bindPlacement(){
 const layer=$('#annotation-layer');
 layer.addEventListener('click',e=>{
  if(S.action==='select'||e.target!==layer||!S.viewport)return;
  const rect=layer.getBoundingClientRect(),p=S.viewport.convertToPdfPoint(e.clientX-rect.left,e.clientY-rect.top);
  checkpoint();
  const type=S.action;
  const h=type==='checkbox'?17:22,w=type==='checkbox'?17:(type==='date'?130:200);
  const f={id:uid(),page:S.page,name:(type==='checkbox'?'Checkbox':type==='signature'?'Typed signature':type==='date'?'Date':'Text')+' '+(S.fields.length+1),type,
    x:Math.max(0,p[0]),y:Math.max(0,p[1]-h/2),width:w,height:h,value:type==='checkbox'?false:'',source:'added',fontSize:11};
  S.fields.push(f);saveDraft();S.action='select';
  $$('.tool-switch').forEach(b=>{b.classList.toggle('active',b.dataset.tool==='select');b.setAttribute('aria-pressed',b.dataset.tool==='select'?'true':'false');});
  refreshFields();selectField(f.id);$('#overlay-'+f.id)?.focus();
 });
}

function showUtility(mode){
 $('#merge-file-input').value='';
 const metadata={
  merge:['files','Merge PDF','Combine multiple PDFs into one clean, correctly ordered document.'],
  split:['scissors','Split PDF','Extract precisely the pages you need. Keep the original intact.'],
  compress:['minimize-2','Compress PDF','Optimize without losing information, or choose a smaller image-based copy.'],
  organize:['layout-grid','Organize pages','Reorder, rotate or remove pages in one PDF.']
 }[mode];
 const fileHelp=mode==='merge'?'Choose two or more documents; adjust their order before merging.':'Select a PDF to begin.';
 $('#main').innerHTML=`
 <section class="utility-page">
  <span class="eyebrow">${icon('wand-sparkles')} PDF MASTER TOOLS</span>
  <div class="utility-heading"><span class="icon">${icon(metadata[0])}</span><h1>${metadata[1]}</h1></div>
  <p class="subtitle">${metadata[2]}</p>
  <div class="utility-card">
   <div class="utility-drop" id="utility-drop" role="button" tabindex="0">
    <span class="upload-icon" style="margin:0 auto">${icon('file-up')}</span><strong>${mode==='merge'?'Add PDF files':'Choose a PDF'}</strong>
    <p>${fileHelp}</p><button class="btn primary" type="button" data-action="utility-choose">${icon('plus')} Choose files</button>
   </div>
   <div id="utility-files"></div>
   <div id="utility-options"></div>
   <div id="utility-progress" class="tool-progress" role="status"></div>
   <div class="utility-actions"><button type="button" class="btn primary" id="utility-run" data-action="utility-run">${icon('download')} ${mode==='merge'?'Merge & download':mode==='split'?'Extract & download':mode==='compress'?'Compress & download':'Save organized PDF'}</button></div>
  </div>
  <div class="feature-grid" style="grid-template-columns:repeat(2,1fr)">
   <div class="feature-card"><strong>${icon('shield-check')} Everything stays local</strong><p>Your documents never leave your browser for processing.</p></div>
   <div class="feature-card"><strong>${icon('file-check-2')} Preserve the original</strong><p>PDF Master always downloads a new file. Your source remains untouched.</p></div>
  </div>
 </section>`;
 const zone=$('#utility-drop');
 zone.addEventListener('click',e=>{if(!e.target.closest('[data-action]'))$('#merge-file-input').click();});
 zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#merge-file-input').click();}});
 bindDrop(zone,true);
 if(mode==='merge'){renderUtilityFiles();renderUtilityOptions();}
 else if(S.pdf){ S.mergeFiles=[{name:S.fileName,bytes:S.raw.slice()}];renderUtilityFiles();renderUtilityOptions();}
 else {S.mergeFiles=[];renderUtilityFiles();renderUtilityOptions();}
 drawIcons();
}
function addMergeFiles(files){
 Promise.all(files.map(async f=>{
  const bytes=new Uint8Array(await f.arrayBuffer());
  if(String.fromCharCode(...bytes.slice(0,4))!=='%PDF')throw Error(f.name+' is not a valid PDF');
  return {name:f.name,bytes};
 })).then(items=>{
  if(S.mode!=='merge')S.mergeFiles=items;
  else S.mergeFiles.push(...items);
  renderUtilityFiles();renderUtilityOptions();
  toast(items.length+' document(s) added');
 }).catch(reportError);
}
function renderUtilityFiles(){
 const e=$('#utility-files');if(!e)return;
 e.innerHTML=S.mergeFiles.length?'<div class="file-list">'+S.mergeFiles.map((f,i)=>`
  <div class="file-list-item" data-file-index="${i}">
   <span class="file-icon">${icon('file-text')}</span>
   <strong title="${esc(f.name)}">${esc(f.name)}</strong>
   <small>${size(f.bytes.length)}</small>
   ${S.mode==='merge'||S.mode==='organize'?`<button type="button" aria-label="Move up" data-action="move-file-up" data-index="${i}" ${i===0?'disabled':''}>${icon('arrow-up')}</button><button type="button" aria-label="Move down" data-action="move-file-down" data-index="${i}" ${i===S.mergeFiles.length-1?'disabled':''}>${icon('arrow-down')}</button>`:''}
   <button type="button" aria-label="Remove file" data-action="remove-file" data-index="${i}">${icon('x')}</button>
  </div>`).join('')+'</div>':
 '<p class="hint" style="text-align:center;margin:22px 0">No document selected yet.</p>';
 drawIcons();
}
async function renderUtilityOptions(){
 const e=$('#utility-options');if(!e)return;
 const mode=S.mode,selected=S.mergeFiles[0];
 if(mode==='merge'){
  e.innerHTML='<p class="hint">Files will be merged in the order shown above. Use the arrows to reorder them.</p>';
 }else if(mode==='split'){
  e.innerHTML=`<div class="input-row"><label for="page-ranges">Pages to extract</label><input id="page-ranges" type="text" placeholder="e.g. 1-3, 5, 8-10" aria-label="Page ranges to extract"/></div><p class="hint">Separate ranges with commas. For example: 1-3, 5 will export pages 1, 2, 3 and 5 in that order.</p>`;
 }else if(mode==='compress'){
  e.innerHTML=`<div class="input-row"><label for="compress-mode">Compression method</label><select id="compress-mode"><option value="optimize">Preserve text & form fields (safe optimization)</option><option value="raster">Smaller image-based PDF (rasterize pages)</option></select></div>
   <div id="raster-options" hidden><div class="input-row"><label for="compress-quality">Image quality: <span id="quality-percent">72%</span></label><input id="compress-quality" type="range" min="35" max="95" value="72" step="1"/></div><div class="input-row"><label for="compress-resolution">Resolution</label><select id="compress-resolution"><option value="1.25">Balanced (90 DPI)</option><option value="1.7">Clear (122 DPI)</option><option value="2.2">High (158 DPI)</option></select></div>
   <p class="empty-note"><strong>Important:</strong> Rasterization changes each page into an image. Searchable text, editable form fields, links and signatures are not preserved. Keep the original.</p></div>
   <p class="hint" id="compression-hint">Safe optimization may not reduce files with already-compressed images, and can sometimes produce a larger file. PDF Master will show the result size.</p>`;
  $('#compress-mode').addEventListener('change',()=>{
    const raster=$('#compress-mode').value==='raster';
    $('#raster-options').hidden=!raster;
    $('#compression-hint').hidden=raster;
  });
  $('#compress-quality').addEventListener('input',e=>$('#quality-percent').textContent=e.target.value+'%');
 }else if(mode==='organize'){
  e.innerHTML='<div id="organize-preview"><p class="hint">'+(selected?'Loading page thumbnails…':'Choose a PDF above to preview and organize its pages.')+'</p></div><p class="hint">Use the arrow buttons to change page order, rotate to turn pages, and X to exclude pages. Only the downloaded copy is changed.</p>';
  if(selected)void buildOrganizePreview(selected);
 }
 drawIcons();
}
async function buildOrganizePreview(selected){
 const holder=$('#organize-preview');if(!holder)return;
 try{
  await ensureRenderer();
  const doc=await pdfjs.getDocument({data:selected.bytes.slice()}).promise;
  S.organize=Array.from({length:doc.numPages},(_,i)=>({index:i,angle:0,remove:false}));
  const urls=[];
  for(let i=1;i<=Math.min(doc.numPages,75);i++){
   const page=await doc.getPage(i),view=page.getViewport({scale:.17});
   const canvas=document.createElement('canvas');
   canvas.width=view.width;canvas.height=view.height;
   await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
   urls.push(canvas.toDataURL('image/jpeg',.7));page.cleanup();
  }
  if(typeof doc.cleanup==='function')await doc.cleanup();S.previewUrls=urls;
  drawOrganize();
 }catch(e){holder.textContent='Could not preview this document: '+e.message;}
}
function drawOrganize(){
 const holder=$('#organize-preview');if(!holder)return;
 holder.innerHTML='<div class="page-thumbnails">'+S.organize.map((p,i)=>`
  <div class="thumbnail-card ${p.remove?'removed':''}" data-index="${i}">
   <div class="thumbnail-image"><img alt="Original page ${p.index+1} thumbnail" src="${S.previewUrls?.[p.index]||''}" style="transform:rotate(${p.angle}deg)"/></div>
   <div class="thumbnail-title">Page ${p.index+1}</div>
   <div class="thumbnail-actions">
    <button type="button" data-action="organize-up" data-index="${i}" aria-label="Move page ${p.index+1} left" ${i===0?'disabled':''}>${icon('arrow-left')}</button>
    <button type="button" data-action="organize-down" data-index="${i}" aria-label="Move page ${p.index+1} right" ${i===S.organize.length-1?'disabled':''}>${icon('arrow-right')}</button>
    <button type="button" data-action="organize-rotate" data-index="${i}" aria-label="Rotate page ${p.index+1}">${icon('rotate-cw')}</button>
    <button type="button" data-action="organize-delete" data-index="${i}" aria-label="${p.remove?'Restore':'Remove'} page ${p.index+1}">${icon(p.remove?'undo':'x')}</button>
   </div>
  </div>`).join('')+'</div>';
 drawIcons();
}
async function runUtility(){
 if(S.working)return;
 const files=S.mergeFiles;
 if(!files.length){toast('Select PDF files first');return;}
 S.working=true;const run=$('#utility-run');run.disabled=true;
 const progress=$('#utility-progress');progress.classList.add('show');progress.textContent='Processing your PDF locally…';
 try{
  let output,name;
  const {PDFDocument,degrees}=await import('pdf-lib');
  if(S.mode==='merge'){
   const merged=await PDFDocument.create();
   for(let i=0;i<files.length;i++){
    progress.textContent='Merging file '+(i+1)+' of '+files.length;
    const source=await PDFDocument.load(files[i].bytes,{ignoreEncryption:false});
    const pages=await merged.copyPages(source,source.getPageIndices());
    pages.forEach(page=>merged.addPage(page));
   }
   output=await merged.save({useObjectStreams:true});name='merged.pdf';
  }else if(S.mode==='split'){
   const src=await PDFDocument.load(files[0].bytes);
   const indices=parsePageRanges($('#page-ranges').value,src.getPageCount());
   const out=await PDFDocument.create();
   (await out.copyPages(src,indices)).forEach(p=>out.addPage(p));
   output=await out.save();name=stem(files[0].name)+'-extracted.pdf';
  }else if(S.mode==='organize'){
   const src=await PDFDocument.load(files[0].bytes),out=await PDFDocument.create();
   const keep=S.organize.filter(x=>!x.remove);
   if(!keep.length)throw Error('Keep at least one page.');
   for(const item of keep){
    const [p]=await out.copyPages(src,[item.index]);
    p.setRotation(degrees((p.getRotation().angle+item.angle)%360));out.addPage(p);
   }
   output=await out.save();name=stem(files[0].name)+'-organized.pdf';
  }else if(S.mode==='compress'){
   if($('#compress-mode').value==='optimize'){
    const src=await PDFDocument.load(files[0].bytes);
    output=await src.save({useObjectStreams:true,objectsPerTick:30});
   }else{
    await ensureRenderer();
    const source=await pdfjs.getDocument({data:files[0].bytes.slice()}).promise;
    const result=await PDFDocument.create();
    const quality=Number($('#compress-quality').value)/100,scale=Number($('#compress-resolution').value);
    for(let i=1;i<=source.numPages;i++){
     progress.textContent='Compressing page '+i+' of '+source.numPages+'…';
     const page=await source.getPage(i);
     const viewport=page.getViewport({scale}),base=page.getViewport({scale:1});
     const canvas=document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,background:'rgb(255,255,255)'}).promise;
     const dataURL=canvas.toDataURL('image/jpeg',quality),base64=dataURL.split(',')[1];
     const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
     const image=await result.embedJpg(bytes);
     const outPage=result.addPage([base.width,base.height]);
     outPage.drawImage(image,{x:0,y:0,width:base.width,height:base.height});
     canvas.width=0;canvas.height=0;page.cleanup();
    }
    if(typeof source.cleanup==='function')await source.cleanup();
    output=await result.save({useObjectStreams:true});
   }
   name=stem(files[0].name)+'-compressed.pdf';
  }
  download(output,name);
  const original=files.reduce((n,f)=>n+f.bytes.byteLength,0);
  const difference=(1-output.byteLength/original)*100;
  progress.textContent='Downloaded '+size(output.byteLength)+'. '+(difference>=0?'Reduced by '+difference.toFixed(1)+'%':'Output is '+Math.abs(difference).toFixed(1)+'% larger than source.');
  toast('PDF exported: '+size(output.byteLength));
 }catch(e){progress.textContent='Could not process PDF: '+e.message;reportError(e);}
 finally{S.working=false;run.disabled=false;}
}

function makeAddedField(f){
 const field={...f,source:'added'};
 // Suggested text labels remain editable and can be repositioned.
 delete field.fieldName;
 return field;
}
function acceptOne(id){
 const i=S.suggestions.findIndex(f=>f.id===id);if(i<0)return;
 checkpoint();const f=S.suggestions.splice(i,1)[0];S.fields.push(makeAddedField(f));
 saveDraft();refreshFields();toast('Field added to document');
}
function acceptSuggestions(){
 if(!S.suggestions.length){toast('No suggestions to add. Use the tools to place your own fields.');return;}
 checkpoint();S.fields.push(...S.suggestions.map(makeAddedField));S.suggestions=[];
 saveDraft();refreshFields();toast('Added detected fields. Review their positions before exporting.');
}
async function changePage(n){
 const next=Math.max(1,Math.min(S.count,Math.floor(Number(n)||1)));
 if(next===S.page)return;S.page=next;S.selected=null;
 const page=$('#page-number');if(page)page.value=next;
 const area=$('#canvas-scroll');if(area)area.scrollTop=0;
 await renderPage();
}
async function exportEditedPdf(){
 if(!S.raw)return toast('Open a PDF to edit first');
 if(S.working)return;
 S.working=true;
 const btn=$('[data-action="export"]');if(btn)btn.disabled=true;
 try{
  const {PDFDocument,StandardFonts,rgb}=await import('pdf-lib');
  const doc=await PDFDocument.load(S.raw.slice());
  const form=doc.getForm();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const pages=doc.getPages();
  const visited=new Set();
  for(const f of S.fields){
   if(f.source!=='existing'||!f.fieldName||visited.has(f.fieldName))continue;
   visited.add(f.fieldName);
   let field;try{field=form.getField(f.fieldName);}catch(e){console.warn('Cannot find original field',f.fieldName);continue;}
   if(f.type==='checkbox'){
    if(f.value&&typeof field.check==='function')field.check();
    else if(!f.value&&typeof field.uncheck==='function')field.uncheck();
   }else if(typeof field.setText==='function')field.setText(String(f.value??''));
   else if(typeof field.select==='function'&&f.value){try{field.select(String(f.value));}catch(e){console.warn('Unsupported dropdown selection',e);}}
  }
  for(const f of S.fields.filter(f=>f.source==='added')){
   const page=pages[f.page-1];if(!page)continue;
   const x=Math.max(0,f.x),y=Math.max(0,f.y),width=Math.max(12,f.width),height=Math.max(11,f.height);
   const name='pdfmaster_'+f.id.replace(/[^a-zA-Z0-9_]/g,'_');
   const options={x,y,width,height,borderWidth:0,textColor:rgb(0.11,0.17,0.26)};
   if(f.type==='checkbox'){
    const box=form.createCheckBox(name);
    box.addToPage(page,options);
    if(f.value)box.check();
   }else{
    const field=form.createTextField(name);
    field.addToPage(page,options);
    field.setFontSize(Math.max(7,Math.min(20,f.fontSize||11)));
    if(f.value)field.setText(String(f.value));
   }
  }
  form.updateFieldAppearances(font);
  const result=await doc.save({useObjectStreams:true});
  download(result,stem(S.fileName)+'-edited.pdf');
  toast('Exported editable PDF ('+size(result.byteLength)+')');
 }catch(e){
  if(/WinAnsi|encode|glyph/i.test(e.message||''))toast('Unsupported character for this PDF font. Please use Latin text or export another way.');
  else reportError(e);
 }finally{S.working=false;if(btn)btn.disabled=false;}
}
function saveFormData(){
 if(!S.pdf)return;
 const data={format:'pdf-master-draft',version:1,fileName:S.fileName,hash:S.hash,
 fields:copyFields(),updatedAt:new Date().toISOString()};
 download(JSON.stringify(data,null,2),stem(S.fileName)+'-fields.json','application/json');
 toast('Field data saved as JSON');
}
async function importFormData(file){
 try{
  const data=JSON.parse(await file.text());
  if(data.format!=='pdf-master-draft'||!Array.isArray(data.fields))throw Error('Choose a PDF Master fields JSON file.');
  if(data.hash!==S.hash)throw Error('This draft belongs to another PDF. Open the matching document first.');
  checkpoint();
  for(const f of data.fields){
   if(!f.page||f.page>S.count)continue;
   const orig=S.fields.find(a=>a.source==='existing'&&a.fieldName===f.fieldName&&a.page===f.page);
   if(orig)orig.value=f.value;
   else if(f.source==='added'){
    const at=S.fields.findIndex(x=>x.id===f.id);
    if(at>=0)S.fields[at]=f;else S.fields.push(f);
   }
  }
  saveDraft();refreshFields();toast('Saved form values restored');
 }catch(e){reportError(e);}
}
async function handleAction(button){
 const action=button.dataset.action;
 if(!action)return;
 try{
  if(action==='open'){ $('#file-input').value='';$('#file-input').click();return;}
  if(action==='pick-tool'){
   S.action=button.dataset.tool;
   $$('.tool-switch').forEach(el=>{el.classList.toggle('active',el===button);el.setAttribute('aria-pressed',el===button?'true':'false');});
   $('#annotation-layer')?.classList.toggle('placing',S.action!=='select');
   toast(S.action==='select'?'Select and edit fields': 'Click the document to add a '+S.action+' field');
  }else if(action==='scan')await scanFields();
  else if(action==='accept')acceptSuggestions();
  else if(action==='accept-one')acceptOne(button.dataset.fieldId);
  else if(action==='remove-field'){
   checkpoint();S.fields=S.fields.filter(x=>x.id!==button.dataset.fieldId);
   saveDraft();refreshFields();
  }else if(action==='goto-field'){
   const f=allFields().find(x=>x.id===button.dataset.fieldId);
   if(f){await changePage(f.page);selectField(f.id);$('#field-panel')?.classList.add('force-open');setTimeout(()=>$('#field-panel')?.classList.remove('force-open'),1600);}
  }else if(action==='jump')await changePage(button.dataset.page);
  else if(action==='zoom-in'||action==='zoom-out'){
   S.manualZoom=true;S.scale=Math.min(2.6,Math.max(.35,S.scale*(action==='zoom-in'?1.16:1/1.16)));await renderPage();
  }else if(action==='prev')await changePage(S.page-1);
  else if(action==='next')await changePage(S.page+1);
  else if(action==='toggle-fields'){S.panelPinned=!S.panelPinned;$('#field-panel')?.classList.toggle('pinned',S.panelPinned);}
  else if(action==='pin-panel'){S.panelPinned=!S.panelPinned;$('#field-panel')?.classList.toggle('pinned',S.panelPinned);button.setAttribute('aria-pressed',String(S.panelPinned));button.setAttribute('aria-label',S.panelPinned?'Unpin field sidebar':'Pin field sidebar');}
  else if(action==='undo')undo();else if(action==='redo')redo();
  else if(action==='export')await exportEditedPdf();
  else if(action==='import'){
   const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
   input.addEventListener('change',async()=>{if(input.files?.[0])await importFormData(input.files[0]);});input.click();
  }else if(action==='save-data')saveFormData();
  else if(action==='utility-choose'){$('#merge-file-input').value='';$('#merge-file-input').click();}
  else if(action==='utility-run')await runUtility();
  else if(action==='move-file-up'||action==='move-file-down'){
   const from=Number(button.dataset.index),to=from+(action==='move-file-up'?-1:1);
   if(to>=0&&to<S.mergeFiles.length){[S.mergeFiles[from],S.mergeFiles[to]]=[S.mergeFiles[to],S.mergeFiles[from]];renderUtilityFiles();}
  }else if(action==='remove-file'){S.mergeFiles.splice(Number(button.dataset.index),1);renderUtilityFiles();renderUtilityOptions();}
  else if(action.startsWith('organize-')){
   const i=Number(button.dataset.index),p=S.organize[i];if(!p)return;
   if(action==='organize-up'&&i>0)[S.organize[i-1],S.organize[i]]=[S.organize[i],S.organize[i-1]];
   if(action==='organize-down'&&i<S.organize.length-1)[S.organize[i+1],S.organize[i]]=[S.organize[i],S.organize[i+1]];
   if(action==='organize-rotate')p.angle=(p.angle+90)%360;
   if(action==='organize-delete')p.remove=!p.remove;
   drawOrganize();
  }
 }catch(e){reportError(e);}
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-tool].rail-item');
 if(nav){setMode(nav.dataset.tool);location.hash=nav.dataset.tool;return;}
 const button=e.target.closest('[data-action]');
 if(button){e.preventDefault();void handleAction(button);}
});
$('#file-input').addEventListener('change',e=>{if(e.target.files[0])void loadPdf(e.target.files[0]);});
$('#merge-file-input').addEventListener('change',e=>{if(e.target.files.length)addMergeFiles([...e.target.files]);});
document.addEventListener('change',e=>{
 if(e.target.id==='page-number')void changePage(e.target.value);
});
window.addEventListener('keydown',e=>{
 if(S.mode!=='edit'||e.target.matches?.('input,textarea,[contenteditable]'))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
});
let resizeTimeout;
window.addEventListener('resize',()=>{clearTimeout(resizeTimeout);resizeTimeout=setTimeout(()=>{if(S.mode==='edit'&&S.pdf&&!S.manualZoom)void renderPage();},120);});
window.addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(['edit','merge','split','compress','organize'].includes(hash)&&hash!==S.mode)setMode(hash);});
setMode(['edit','merge','split','compress','organize'].includes(location.hash.slice(1))?location.hash.slice(1):'edit');

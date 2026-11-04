import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDocument} from 'pdf-lib';
import {detectFields,labelSegments,parsePageRanges} from '../src/detection.js';

test('detects Birthday / Date / Month separately', async()=>{
 const doc=await PDFDocument.create(),page=doc.addPage([612,792]);
 page.drawText('BIRTHDAY:    DATE:     MONTH:',{x:40,y:730,size:12});
 page.drawText('SURNAME:',{x:40,y:697,size:12});
 const input=doc.getForm().createTextField('email');
 input.addToPage(page,{x:160,y:605,width:240,height:22});
 const bytes=await doc.save();
 await writeFile(new URL('./fixture.pdf',import.meta.url),bytes);
 const other=await PDFDocument.create();other.addPage([300,300]).drawText('SECOND DOCUMENT',{x:18,y:252,size:12});
 await writeFile(new URL('./fixture2.pdf',import.meta.url),await other.save());
 const source=await pdfjs.getDocument({data:bytes.slice()}).promise;
 const result=await detectFields(await source.getPage(1),pdfjs,[],1);
 assert.ok(result.find(f=>f.name.startsWith('Birthday')),JSON.stringify(result));
 assert.ok(result.find(f=>f.name.startsWith('Date')),JSON.stringify(result));
 assert.ok(result.find(f=>f.name.startsWith('Month')),JSON.stringify(result));
 const widgets=await (await source.getPage(1)).getAnnotations();
 assert.ok(widgets.some(w=>w.fieldName==='email'));
 
});
test('parses split ranges and rejects invalid inputs',()=>{
 assert.deepEqual(parsePageRanges('1-3, 5',5),[0,1,2,4]);
 assert.deepEqual(parsePageRanges('2,2,3',5),[1,2]);
 assert.throws(()=>parsePageRanges('4-2',5));
 assert.throws(()=>parsePageRanges('6',5));
 assert.throws(()=>parsePageRanges('foo',5));
});
test('label matcher includes birthday, date, and month',()=>{
 const matches=labelSegments('BIRTHDAY:   DATE:   MONTH:');
 assert.deepEqual(matches.map(m=>m.label.toLowerCase()),['birthday','date','month']);
});

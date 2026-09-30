'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const fixture=require('./sample-responses.json');
const {validateSnapshot,columns,buildReportModel}=require('../services/report.model');
const {buildHTML}=require('../services/pdf.service');
const {createProcessor,hash}=require('../services/evaluation.service');
const {refineEvaluatorNotes,generateInsights,PROMPT_VERSION}=require('../services/openai.evaluation');
const TOPICS=require('../templates/analysis.sections');
const clone=x=>JSON.parse(JSON.stringify(x));
const analysis=()=>({executive_summary:'Recorded evaluation evidence.',sections:TOPICS.map(t=>({title:t.title,summary:'Recorded answers are available.',strengths:[],opportunities:[]}))});
const mockAI=async source=>{
 const refinement=await refineEvaluatorNotes(source);
 return {...analysis(),refined_evaluation:refinement.evaluation,refined_notes:refinement.notes,ai_model:'gpt-4o-mini',input_tokens:1,output_tokens:2,processing_time_ms:3};
};
test('supplied snapshot: 64/100, 40 entries, one informational, YES/NO rendering',()=>{
 validateSnapshot(fixture);
 const model=buildReportModel({responses:fixture});
 assert.equal(model.total,64);assert.equal(model.possible,100);
 assert.equal(model.sections.flatMap(s=>s.questions).length,40);
 assert.equal(model.sections.flatMap(s=>s.questions).filter(q=>q.informational).length,1);
 for(const q of model.sections.flatMap(s=>s.questions)) {
  assert.equal(q.yes,q.yes_column);assert.equal(q.no,q.no_column);
 }
 const html=buildHTML({responses:fixture}).html;
 assert.match(html,/class="points">1<\/td><td class="points">N\/A<\/td>/);
 assert.match(html,/class="points">1<\/td><td class="points">\*\*<\/td>/);
});
test('manual zero, decimal and full points remain numeric YES with notation NO',()=>{
 for(const answer of ['limited','some','nmd']) for(const earned of [0,0.37,5]) {
  const row=columns({answer,earned,possible:5,informational:false});
  assert.equal(row.yes,String(earned));assert.equal(row.no,answer==='limited'?'*':answer==='some'?'**':'NMD');
 }
});
test('reject wrong columns, missing answers, wrong scores, duplicates, draft',()=>{
 const changes=[s=>s.evaluation.sections[0].questions[0].yes_column='999',
  s=>s.evaluation.sections[0].questions[0].answer=null,
  s=>s.evaluation.sections[0].questions[0].earned=null,
  s=>s.evaluation.sections[0].questions[3].earned=0,
  s=>s.evaluation.sections[0].questions[0].possible=2,
  s=>s.evaluation.sections[0].section_score=2,
  s=>s.evaluation.sections[0].questions[0].id='app_2',
  s=>s.evaluation.scores.total_score=0,
  s=>s.evaluation.draft=true];
 for(const mutate of changes) {const s=clone(fixture);mutate(s);assert.throws(()=>validateSnapshot(s));}
});
test('HTML escapes user text and does not emit executable input',()=>{
 const s=clone(fixture);s.evaluation.sales_rep.full_name='<script>alert(1)</script>';
 const html=buildHTML({responses:s}).html;
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
});
test('placeholder notes remain raw in original; no invented refined text and no API call',async()=>{
 const s=clone(fixture),before=JSON.stringify(s);
 const result=await refineEvaluatorNotes(s.evaluation,{client:{}});
 assert.equal(JSON.stringify(s),before);
 assert.ok(result.notes.every(n=>n.status==='insufficient' && n.original.includes('test') && n.refined===''));
 assert.ok(result.evaluation.sections.every(s=>s.evaluator_section_note===''));
});
test('refinement runs before analysis, preserves raw notes and handles ambiguous notes',async()=>{
 const e=clone(fixture.evaluation);e.sections[0].evaluator_section_note='APPROACH Notes: he didnt ask my name';
 let calls=0;
 const client={chat:{completions:{create:async request=>{
   calls++;
   assert.equal(request.response_format.json_schema.strict,true);
   const input=JSON.parse(request.messages[1].content);
   const content=calls===1?{notes:[{key:'approach',refined:'He did not ask my name.',review_needed:false}]}:analysis();
   if(calls===2) assert.equal(input.sections[0].evaluator_section_note,'He did not ask my name.');
   return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{prompt_tokens:10,completion_tokens:5}};
 }}}};
 const result=await generateInsights(e,{client});
 assert.equal(calls,2);assert.equal(result.input_tokens,20);
 assert.equal(e.sections[0].evaluator_section_note,'APPROACH Notes: he didnt ask my name');
 assert.equal(result.refined_notes[0].refined,'He did not ask my name.');
 const ambiguous={chat:{completions:{create:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({notes:[{key:'approach',refined:'Invented replacement',review_needed:true}]})}}]})}}};
 const r=await refineEvaluatorNotes(e,{client:ambiguous});
 assert.equal(r.evaluation.sections[0].evaluator_section_note,'he didnt ask my name');
});
test('AI refusal, truncation and invalid JSON cannot produce a published analysis',async()=>{
 for(const message of [{refusal:'No'},{content:'bad json'}]) {
  const client={chat:{completions:{create:async()=>({choices:[{finish_reason:'stop',message}]})}}};
  await assert.rejects(()=>generateInsights(fixture.evaluation,{client}));
 }
});
function harness(t,{existing,changeSource=false,uploadFail=false}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nhms-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const filePath=path.join(dir,'report.pdf');fs.writeFileSync(filePath,'%PDF-1.4\nmock');
 let record={id:123,nhms_shop_id:fixture.evaluation.shop.id,status:'submitted',submitted_at:fixture.evaluation.metadata.submitted_at,
  total_score:64,percentage:64,responses_json:clone(fixture)};
 let stored=existing?{id:77,evaluation_id:123,total_score:52,percentage:52,max_score:100,ai_analysis_json:{},pdf_report:[]}:null;
 const calls={ai:0,upload:0,create:0,update:0,render:0};
 const client={get:async url=>{
   if(url==='/api/evaluation:get')return {data:{data:clone(record)}};
   if(url==='/api/evaluation_results:list')return {data:{data:stored?[clone(stored)]:[]}};
   if(url==='/api/edited_videos:list')return {data:{data:[]}};
   throw new Error('Unexpected GET '+url);
 },post:async(url,payload)=>{
   if(url==='/api/evaluation_results:create'){calls.create++;stored={id:88,...clone(payload)};}
   else if(url==='/api/evaluation_results:update'){calls.update++;stored={id:stored.id,...clone(payload)};}
   else throw new Error('Unexpected write '+url);
   return {data:{data:stored}};
 }};
 const run=createProcessor({client,generateInsights:async source=>{calls.ai++;return mockAI(source);},
   generatePDF:async data=>{calls.render++;assert.equal(data.total_score,64);
     if(changeSource)record.responses_json.evaluation.final_evaluator_note='Changed during rendering';
     return {filePath,pageCount:5,issues:[]};},
   uploadPDF:async()=>{calls.upload++;if(uploadFail)throw new Error('Upload failed');return {id:999};}});
 return {run,calls,getStored:()=>stored,getRecord:()=>record};
}
test('new result persists original snapshot and separate refined notes with PDF',async t=>{
 const h=harness(t);const out=await h.run('123');
 assert.equal(out.total_score,64);assert.equal(h.calls.create,1);assert.equal(h.calls.update,0);
 const saved=h.getStored();assert.deepEqual(saved.responses_snapshot,fixture);
 assert.equal(saved.ai_analysis_json.refined_notes[0].original,'APPROACH Notes: test');
 assert.equal(saved.ai_analysis_json.refined_evaluation.sections[0].evaluator_section_note,'');
 assert.equal(saved.ai_analysis_json.source_hash,hash(fixture));assert.equal(saved.pdf_report[0].id,999);
});
test('regeneration updates stale result and repeat uses unchanged analysis cache',async t=>{
 const h=harness(t,{existing:true});await h.run(123);
 assert.equal(h.calls.update,1);assert.equal(h.calls.create,0);assert.equal(h.getStored().total_score,64);
 await h.run(123);assert.equal(h.calls.ai,1);assert.equal(h.calls.update,2);
});
test('source drift stops publication before upload',async t=>{
 const h=harness(t,{changeSource:true});await assert.rejects(()=>h.run(123),/changed during generation/);
 assert.equal(h.calls.upload,0);assert.equal(h.calls.create,0);
});
test('upload failure leaves existing result untouched',async t=>{
 const h=harness(t,{existing:true,uploadFail:true});await assert.rejects(()=>h.run(123),/Upload failed/);
 assert.equal(h.calls.update,0);assert.equal(h.getStored().total_score,52);
});

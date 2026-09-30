"use strict";
const fs=require('fs');
const crypto=require('crypto');
const {validateSnapshot,buildReportModel,parseSnapshot,number,safeURL}=require('./report.model');
const {generateChartData}=require('./chart.service');
const {PROMPT_VERSION,validateAnalysis}=require('./openai.evaluation');
const active=new Map();
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function id(value) {
  if (typeof value==='number' && !Number.isSafeInteger(value)) throw new Error('Send large IDs as strings');
  const result=String(value??'');
  if (!/^[1-9]\d*$/.test(result)) throw new Error('A positive numeric evaluationId is required');
  return result;
}
function checkRecord(record,expectedId) {
  if (!record || String(record.id)!==expectedId) throw new Error('Evaluation not found or ID mismatch');
  const snapshot=validateSnapshot(record.responses_json);
  if (!record.submitted_at || record.status!=='submitted') throw new Error('Only submitted evaluations can generate reports');
  for (const key of ['total_score','percentage']) if (number(record[key])===null || Math.abs(number(record[key])-number(snapshot.evaluation.scores[key]))>.011)
    throw new Error(`Snapshot scores.${key} differs from evaluation.${key}`);
  return snapshot;
}
function recordFingerprint(record) {
  return hash({responses:parseSnapshot(record.responses_json),total_score:record.total_score,
    percentage:record.percentage,submitted_at:record.submitted_at,status:record.status,
    nhms_shop_id:record.nhms_shop_id});
}
function createProcessor(deps={}) {
  return async function run(evaluationId) {
    const evaluationKey=id(evaluationId);
    let client=deps.client;
    if (!client) {
      const base=process.env.NOCOBASE_URL||process.env.BASE_URL;
      if (!base||!process.env.NOCOBASE_TOKEN) throw new Error('Set NOCOBASE_URL (or BASE_URL) and NOCOBASE_TOKEN');
      client=require('axios').create({baseURL:base.replace(/\/+$/,''),
        headers:{Authorization:`Bearer ${process.env.NOCOBASE_TOKEN}`},timeout:30000});
    }
    const getEvaluation=async()=> (await client.get('/api/evaluation:get',{params:{filterByTk:evaluationKey}})).data?.data;
    const getResults=async()=>{
      const rows=(await client.get('/api/evaluation_results:list',{params:{
        filter:JSON.stringify({evaluation_id:{$eq:evaluationKey}}),pageSize:2,appends:['pdf_report']}})).data?.data;
      if (!Array.isArray(rows)||rows.length>1) throw new Error('Expected zero or one evaluation result; resolve duplicate results before retrying');
      if (rows.some(r=>String(r.evaluation_id)!==evaluationKey)) throw new Error('Result belongs to another evaluation');
      return rows;
    };
    const record=await getEvaluation();
    const snapshot=checkRecord(record,evaluationKey), source=snapshot.evaluation;
    // Validate report identity/date before spending tokens or creating a PDF.
    buildReportModel({responses:snapshot,total_score:record.total_score,percentage:record.percentage});
    const fingerprint=recordFingerprint(record), sourceHash=hash(snapshot);
    const existing=(await getResults())[0];
    const existingHash=hash(existing||null);
    const modelName=process.env.OPENAI_MODEL||'gpt-4o-mini';
    const cached=typeof existing?.ai_analysis_json==='string' ? JSON.parse(existing.ai_analysis_json) : existing?.ai_analysis_json;
    let ai;
    if (cached?.source_hash===sourceHash && cached?.prompt_version===PROMPT_VERSION && cached?.ai_model===modelName &&
        cached.refined_evaluation && Array.isArray(cached.refined_notes)) {
      validateAnalysis(cached);
      validateSnapshot({evaluation:cached.refined_evaluation});
      ai={...cached,input_tokens:0,output_tokens:0,processing_time_ms:0};
    } else {
      ai=await (deps.generateInsights||require('./openai.evaluation').generateInsights)(source);
    }
    const refinedSource=ai.refined_evaluation;
    if (!refinedSource) throw new Error('Missing refined notes report input');
    const withoutNotes=value=>{
      const copy=JSON.parse(JSON.stringify(value));
      delete copy.final_evaluator_note;
      for (const section of copy.sections) delete section.evaluator_section_note;
      return copy;
    };
    if (hash(withoutNotes(source))!==hash(withoutNotes(refinedSource)))
      throw new Error('Note refinement changed non-note evaluation data; report not published');
    validateAnalysis(ai);
    const shopId=record.nhms_shop_id ?? source.shop?.id;
    if (record.nhms_shop_id!=null && source.shop?.id!=null && String(record.nhms_shop_id)!==String(source.shop.id))
      throw new Error('Evaluation shop differs from snapshot shop');
    let videoURL=null;
    if (shopId) {
      const videos=(await client.get('/api/edited_videos:list',{params:{
        filter:JSON.stringify({nhms_shop_id:{$eq:String(shopId)}}),fields:['id','nhms_shop_id','url'],pageSize:2}})).data?.data;
      if (!Array.isArray(videos)) throw new Error('Invalid edited video response');
      if (videos.some(v=>String(v.nhms_shop_id)!==String(shopId))) throw new Error('Video belongs to another shop');
      if (videos.length>1) throw new Error('Multiple edited videos exist; confirm the final video selection rule before generating this report');
      if (videos.length && !(videoURL=safeURL(videos[0].url))) throw new Error('Invalid edited video URL');
    }
    const reportData={evaluation_id:record.id,sales_rep_name:source.sales_rep?.full_name,
      community_name:source.metadata?.community_name,metadata:source.metadata,video_url:videoURL,
      total_score:record.total_score,percentage:record.percentage,
      responses:{...snapshot,evaluation:refinedSource},evaluator_note:refinedSource.final_evaluator_note,
      sections:ai.sections};
    const reportModel=buildReportModel(reportData);
    const pdf=await (deps.generatePDF||require('./pdf.service').generatePDF)(reportData);
    if (!pdf?.filePath||!fs.existsSync(pdf.filePath)) throw new Error('PDF generation failed');
    const fd=fs.openSync(pdf.filePath,'r');
    try {const signature=Buffer.alloc(5);fs.readSync(fd,signature,0,5,0);if(signature.toString()!=='%PDF-')throw new Error('Output is not a real PDF');}
    finally {fs.closeSync(fd);}
    const assertUnchanged=async()=>{
      const fresh=await getEvaluation();
      checkRecord(fresh,evaluationKey);
      if (recordFingerprint(fresh)!==fingerprint) throw new Error('Evaluation changed during generation; regenerate from the latest submitted answers');
      if (hash((await getResults())[0]||null)!==existingHash) throw new Error('Result changed during generation; refresh before retrying');
    };
    await assertUnchanged();
    let attachment;
    if (deps.uploadPDF) attachment=await deps.uploadPDF(pdf,client);
    else {
      const FormData=require('form-data'),form=new FormData();
      form.append('file',fs.createReadStream(pdf.filePath));
      attachment=(await client.post('/api/attachments:create',form,{headers:form.getHeaders()})).data?.data;
    }
    if (!attachment?.id) throw new Error('Attachment upload returned no ID; result not modified');
    await assertUnchanged();
    const analysis={executive_summary:ai.executive_summary,sections:ai.sections,ai_model:ai.ai_model,
      source_hash:sourceHash,prompt_version:PROMPT_VERSION,refined_notes:ai.refined_notes,refined_evaluation:refinedSource};
    const payload={evaluation_id:record.id,total_score:reportModel.total,max_score:reportModel.possible,percentage:reportModel.percentage,
      section_scores:Object.fromEntries(reportModel.sections.map(s=>[s.key,{score:s.earned,possible:s.possible,percentage:s.percentage}])),
      ai_summary:ai.executive_summary,ai_strengths:ai.sections.flatMap(s=>s.strengths).join('\n'),
      ai_weaknesses:ai.sections.flatMap(s=>s.opportunities).join('\n'),
      ai_recommendations:ai.sections.flatMap(s=>s.opportunities).slice(0,10).join('\n'),
      ai_model:ai.ai_model,ai_prompt_version:PROMPT_VERSION,input_tokens:ai.input_tokens,output_tokens:ai.output_tokens,
      processing_time_ms:ai.processing_time_ms,status:'completed',processed_at:new Date().toISOString(),
      responses_snapshot:snapshot,industry_benchmark_comparison:generateChartData(source),
      ai_analysis_json:analysis,pdf_report:[{id:attachment.id}]};
    if (existing) await client.post('/api/evaluation_results:update',payload,{params:{filterByTk:existing.id}});
    else await client.post('/api/evaluation_results:create',payload);
    const saved=(await getResults())[0];
    const savedAI=typeof saved?.ai_analysis_json==='string'?JSON.parse(saved.ai_analysis_json):saved?.ai_analysis_json;
    const attached=Array.isArray(saved?.pdf_report)?saved.pdf_report:saved?.pdf_report?[saved.pdf_report]:[];
    if (!saved||number(saved.total_score)!==reportModel.total||number(saved.percentage)!==reportModel.percentage||
        number(saved.max_score)!==reportModel.possible||savedAI?.source_hash!==sourceHash||
        !attached.some(a=>String(a.id)===String(attachment.id)))
      throw new Error('Saved result verification failed; inspect the result before retrying');
    return {success:true,evaluation_id:record.id,result_id:saved.id,attachment_id:attachment.id,score_verified:true,
      total_score:reportModel.total,percentage:reportModel.percentage,page_count:pdf.pageCount,
      notes_requiring_attention:ai.refined_notes.filter(n=>['insufficient','review_needed'].includes(n.status)).map(n=>({key:n.key,status:n.status})),
      report_issues:pdf.issues||[]};
  };
}
const run=createProcessor();
function processEvaluation(evaluationId) {
  let key; try {key=id(evaluationId);} catch(error) {return Promise.reject(error);}
  if (active.has(key)) return active.get(key);
  const promise=run(key).finally(()=>active.delete(key));
  active.set(key,promise);
  return promise;
}
module.exports={processEvaluation,createProcessor,recordFingerprint,hash};

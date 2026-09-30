"use strict";
const SCHEMA = require('../templates/questionnaire.schema.json');
const TOPICS = require('../templates/analysis.sections');
// The reference places Close above Presentation on the right side.
const SECTION_DEFINITIONS = ['approach','qualifying','demonstration','closing','presentation','attitude']
  .map(key => { const s = SCHEMA.find(s => s.key === key); return [key,({approach:'Approach',qualifying:'Qualifying',demonstration:'Demonstration',closing:'Close',presentation:'Presentation',attitude:'General Attitude'})[key],s.possible_score]; });
const number = value => value === null || value === undefined || typeof value === 'boolean' ||
  !['number','string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const near = (a,b) => a !== null && b !== null && Math.abs(a-b) <= .011;
function parseSnapshot(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { throw new Error('Invalid responses_json JSON'); } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('responses_json must be an object');
  return value;
}
function safeURL(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}
function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(value || ''));
  if (!m) return null;
  const [y,mo,d]=m.slice(1).map(Number), date=new Date(Date.UTC(y,mo-1,d));
  if (date.getUTCFullYear()!==y || date.getUTCMonth()!==mo-1 || date.getUTCDate()!==d) return null;
  return date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
}
function columns(q) {
  const numeric = q.informational ? '' : String(q.earned);
  switch(q.answer) {
    case 'yes': return {yes: q.informational ? 'YES' : numeric, no:'',mark:'YES'};
    case 'no': return {yes:'',no:q.informational ? 'NO' : '0',mark:'NO'};
    case 'na': return {yes:numeric,no:'N/A',mark:'N/A'};
    case 'limited': return {yes:numeric,no:'*',mark:'*'};
    case 'some': return {yes:numeric,no:'**',mark:'**'};
    case 'nmd': return {yes:numeric,no:'NMD',mark:'NMD'};
    default: throw new Error(`Unsupported answer at ${q.id || 'question'}`);
  }
}
function validateSnapshot(value) {
  const snapshot = parseSnapshot(value), source = snapshot.evaluation;
  const fail = message => { throw new Error(`Report validation: ${message}`); };
  if (!source || !Array.isArray(source.sections)) fail('missing evaluation.sections');
  if (source.draft === true || !source.metadata?.submitted_at) fail('submit the evaluation before generating a report');
  if (source.sections.length !== SCHEMA.length) fail('expected exactly six sections');
  for (const spec of SCHEMA) {
    const found=source.sections.filter(s=>s.key===spec.key);
    if (found.length !== 1) fail(`missing/duplicate section ${spec.key}`);
    const s=found[0];
    if (!near(number(s.possible_score),spec.possible_score)) fail(`possible score differs for ${spec.key}`);
    if (!Array.isArray(s.questions) || s.questions.length!==spec.questions.length) fail(`question count differs for ${spec.key}`);
    let earned=0;
    for (const expected of spec.questions) {
      const matches=s.questions.filter(q=>q.id===expected.id);
      if (matches.length!==1) fail(`missing/duplicate question ${expected.id}`);
      const q=matches[0], informational=expected.informational===true;
      if (q.informational !== informational) fail(`informational flag differs at ${q.id}`);
      if (!text(q.question)) fail(`question text missing at ${q.id}`);
      if (informational) {
        if (q.possible!==null || q.earned!==null) fail(`informational item must have null scores at ${q.id}`);
      } else {
        const points=number(q.earned), max=number(q.possible);
        if (!near(max,expected.possible) || points===null || points<0 || points>max) fail(`invalid points at ${q.id}`);
        if (['yes','na'].includes(q.answer) && !near(points,max)) fail(`YES/N/A must receive full credit at ${q.id}`);
        if (q.answer==='no' && points!==0) fail(`NO must receive zero at ${q.id}`);
        earned+=points;
      }
      const c=columns(q);
      if (q.grading_type != null && q.grading_type!==q.answer) fail(`grading_type mismatch at ${q.id}`);
      if (q.display_mark != null && q.display_mark!==c.mark) fail(`display_mark mismatch at ${q.id}`);
      for (const [key,v] of [['yes_column',c.yes],['no_column',c.no]]) {
        if (q[key] != null && String(q[key])!==v) fail(`${key} mismatch at ${q.id}`);
      }
    }
    if (!near(number(s.section_score),earned)) fail(`section sum mismatch for ${s.key}`);
    if (s.efficiency_rating != null && !near(number(s.efficiency_rating),earned)) fail(`efficiency rating mismatch for ${s.key}`);
  }
  const total=source.sections.reduce((sum,s)=>sum+number(s.section_score),0);
  if (!near(number(source.scores?.total_score),total) || !near(number(source.scores?.possible_score),100) ||
      !near(number(source.scores?.percentage),total)) fail('total, possible score, or percentage mismatch');
  return snapshot;
}
function buildReportModel(data) {
  const snapshot=validateSnapshot(data.responses), source=snapshot.evaluation, issues=[];
  const metadata=data.metadata || source.metadata || {};
  const name=text(data.sales_rep_name)||text(source.sales_rep?.full_name);
  const community=text(data.community_name)||text(metadata.community_name);
  const visitDate=formatDate(metadata.shop_date || source.shop?.shop_date);
  if (!name || !community || !visitDate) throw new Error('Representative, community and valid shop date are required');
  for (const key of ['total_score','percentage']) if (data[key]!=null && !near(number(data[key]),number(source.scores[key])))
    throw new Error(`Evaluation ${key} differs from its snapshot`);
  const sections=SECTION_DEFINITIONS.map(([key,title])=>{
    const s=source.sections.find(s=>s.key===key);
    return {key,title,earned:number(s.section_score),possible:number(s.possible_score),
      percentage:Math.round(s.section_score/s.possible_score*100), note:text(s.evaluator_section_note),
      questions:s.questions.map(q=>({...q,earned:number(q.earned),possible:number(q.possible),...columns(q)}))};
  });
  const analysis=Array.isArray(data.sections)?data.sections:[];
  const narratives=TOPICS.map(t=>{
    const s=analysis.find(s=>s.title===t.title)||{};
    return {title:t.title,narrative:text(s.summary)||text(s.narrative)||'Visit-specific analysis is not available.',
      strengths:Array.isArray(s.strengths)?s.strengths.map(text).filter(Boolean):[],
      opportunities:Array.isArray(s.opportunities)?s.opportunities.map(text).filter(Boolean):[]};
  });
  if (!metadata.time_in) issues.push({code:'missing_time_in',field:'metadata.time_in',severity:'warning'});
  if (!metadata.time_out) issues.push({code:'missing_time_out',field:'metadata.time_out',severity:'warning'});
  return {evaluationId:data.evaluation_id,name,community,visitDate,timeIn:text(metadata.time_in)||'Not recorded',
    timeOut:text(metadata.time_out)||'Not recorded',videoURL:safeURL(data.video_url),total:number(source.scores.total_score),
    possible:100,percentage:number(source.scores.percentage),sections,narratives,issues,
    evaluatorNote:text(data.evaluator_note)||text(source.final_evaluator_note),
    scoreVerified:true,previewLabel:text(data.preview_label)};
}
module.exports={buildReportModel,validateSnapshot,columns,number,parseSnapshot,safeURL,formatDate,SECTION_DEFINITIONS};

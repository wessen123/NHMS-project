'use strict';
// Offline layout preview: no API calls, upload or database writes.
const fs=require('fs'),path=require('path');
const {generatePDF}=require('../services/pdf.service');
const {refineEvaluatorNotes}=require('../services/openai.evaluation');
const TOPICS=require('../templates/analysis.sections');
async function main(){
  const [input,output]=process.argv.slice(2);
  if (!input||!output) throw new Error('Usage: node scripts/preview.js snapshot.json output.pdf');
  const snapshot=JSON.parse(fs.readFileSync(input,'utf8'));
  const source=snapshot.evaluation;
  const originalNotes=source.sections.map(s=>s.evaluator_section_note);
  // The supplied fixture contains placeholder notes. Never send preview data to an AI.
  const refinement=await refineEvaluatorNotes(source,{client:{chat:{completions:{create:()=>{throw new Error('Preview has meaningful notes: supply mocked refinement explicitly; no AI call permitted');}}}}});
  const mapping=[['approach','qualifying'],['presentation','demonstration'],['closing'],['demonstration'],['qualifying','demonstration'],['closing']];
  const sections=TOPICS.map((topic,i)=>({title:topic.title,
    summary:mapping[i].map(key=>{const s=source.sections.find(s=>s.key===key);return `${s.title}: ${s.section_score} of ${s.possible_score} points.`;}).join(' ')+
      ' This offline preview uses the saved scores. The supplied evaluator notes contain placeholder text and do not support additional visit observations. Live AI coaching has not been generated.',
    strengths:[],opportunities:['Replace placeholder evaluator notes with specific observations before requesting a detailed coaching report.']}));
  const data={evaluation_id:'preview',responses:{...snapshot,evaluation:refinement.evaluation},sections,
    preview_label:'LAYOUT PREVIEW - supplied JSON; live AI, upload and database writes not run'};
  const result=await generatePDF(data,{outputPath:path.resolve(output),htmlPath:path.resolve(output.replace(/\.pdf$/,'.html'))});
  fs.writeFileSync(output.replace(/\.pdf$/,'.verification.json'),JSON.stringify({
    score:source.scores,section_scores:source.sections.map(s=>({key:s.key,score:s.section_score})),
    ...result,originalNotesPreserved:originalNotes.every((n,i)=>snapshot.evaluation.sections[i].evaluator_section_note===n),
    noteQuality:refinement.notes.map(n=>({key:n.key,status:n.status})),liveAI:false,liveNocoBase:false},null,2));
  console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

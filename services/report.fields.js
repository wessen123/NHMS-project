"use strict";

// Paths are relative to each question in responses_json.evaluation.sections[].questions[].
// Null means UNVERIFIED, not an alternative guessed NocoBase field name.
// Fill these only after inspecting the current questionnaire export and real record.
module.exports = Object.freeze({
  answer: null,
  marker: null,
  note: null,
  // Map exact recorded answer values to yes / no / na / nmd / partial.
  answerValues: Object.freeze({}),
});

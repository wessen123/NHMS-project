"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { processEvaluation } = require("../services/evaluation.service");
test("unverified mappings stop the endpoint before AI, upload, or result writes", async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.method + " " + req.url.split('?')[0]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: req.url.startsWith('/api/evaluation:get/') ? {
      id: 1, total_score: 0, percentage: 0,
      responses_json: { evaluation: { scores: { total_score: 0, percentage: 0 }, sections: [] } },
    } : [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.BASE_URL;
  process.env.BASE_URL = `http://127.0.0.1:${server.address().port}`;
  const previousWarn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(processEvaluation(1), /answer_mapping_not_verified/);
    assert.deepEqual(requests, ['GET /api/evaluation:get/1', 'GET /api/evaluation_results:list']);
  } finally {
    console.warn = previousWarn;
    if (previous === undefined) delete process.env.BASE_URL; else process.env.BASE_URL = previous;
    await new Promise(resolve => server.close(resolve));
  }
});

"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { buildReportModel } = require("./report.model");
const { generateChartData } = require("./chart.service");
const ROOT = path.resolve(__dirname, "..");
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const point = value => value === null ? "Missing" : Number(value.toFixed(2)).toString();
const footer = '<div class="footer">© Personnel Profiles, Inc. · www.NewHomeMysteryShops.com</div>';
const preview = model => model.previewLabel ? `<div class="preview">${escape(model.previewLabel)}</div>` : "";

function renderSection(section) {
  const rows = section.questions.length ? section.questions.map(q => {
    // NO is only asserted from a verified explicit answer. Never from absence or points lost.
    let yes = q.earned === null ? "?" : point(q.earned);
    let no = "";
    if (q.answer === "no" && q.earned === 0) { yes = ""; no = "0"; }
    if (!q.answer) yes += " ?";
    if (q.answer === "na" && q.earned === null) yes = "";
    return `<tr><td class="number">${escape(q.number)}</td><td>${escape(q.question)}</td>
      <td class="points">${q.possible === null ? "?" : point(q.possible)}</td>
      <td class="points">${yes}<span class="marker">${escape(q.marker)}</span></td><td class="points">${no}</td></tr>`;
  }).join("") : '<tr><td colspan="5" class="missing">Question data missing</td></tr>';
  return `<table class="score-table"><colgroup><col style="width:4%"><col style="width:70%"><col style="width:9%"><col style="width:11%"><col style="width:6%"></colgroup>
    <thead><tr><th colspan="5" class="section-head"><div><span>${escape(section.title.toUpperCase())} (${point(section.possible)})</span><small>Efficiency Rating: ${point(section.earned)}</small></div></th></tr>
    <tr class="column-head"><th></th><th></th><th>Possible</th><th>YES</th><th>NO</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function scorecard(model, logo) {
  return `<section class="page scorecard">${preview(model)}<header class="report-header"><img class="report-logo" src="${logo}" alt="NHMS"><div class="video-link">${model.videoURL ? `<a href="${escape(model.videoURL)}">VIDEO LINK</a>` : '<span class="missing">VIDEO LINK — unavailable</span>'}</div></header>
    <div class="scorecard-grid"><div class="scorecard-column"><table class="visit-table score-meta"><tr><td colspan="2" class="tag">Improved Performance Through Evaluation</td></tr>
    <tr><td>Date: ${escape(model.visitDate)}</td><td>Total Score: <b>${point(model.total)}</b> / ${point(model.possible)} possible</td></tr>
    <tr><td colspan="2">Representative (SR): <b>${escape(model.name)}</b></td></tr><tr><td colspan="2">Community: ${escape(model.community)}</td></tr></table>
    ${model.sections.slice(0, 3).map(renderSection).join("")}</div><div class="scorecard-column"><table class="visit-table visit-times"><tr><td>Time In: ${escape(model.timeIn)}</td><td>Time Out: ${escape(model.timeOut)}</td></tr></table>
    ${model.sections.slice(3).map(renderSection).join("")}</div></div>
    <div class="legend"><span>N/A — Not applicable · NMD — Not Much Discussed<br>? — Missing / unverified mapping; not a NO answer</span><span>* Full credit not allowed · ** Some credit allowed<br>Efficiency Rating shows section points; chart shows percentages.</span></div>
    ${model.issues.length ? '<div class="mapping-status">Data verification issues are listed after the narratives. Stored scoring is preserved.</div>' : ''}${footer}</section>`;
}
function narrativeTopic(topic) {
  const list = values => values.length ? values.map(value => `<li>${escape(value)}</li>`).join("") : '<li class="missing">Not recorded.</li>';
  return `<article class="topic"><h2 class="topic-title">${escape(topic.title)}</h2><p>${escape(topic.narrative)}</p><h3 class="subheading">Strengths:</h3><ul>${list(topic.strengths)}</ul><h3 class="subheading">Opportunities:</h3><ul>${list(topic.opportunities)}</ul></article>`;
}
function chartSVG(chartData) {
  const left = 108, top = 72, width = 620, height = 295, bottom = top + height;
  let drawing = `<svg class="comparison-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 830 560" role="img" aria-label="Representative compared with static industry benchmarks"><rect x="1" y="1" width="828" height="558" fill="white" stroke="#777"/>
    <rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#99ccff"/>`;
  for (let value = 0; value <= 100; value += 20) {
    const y = bottom - value / 100 * height;
    drawing += `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="#333" stroke-width="1"/><text x="${left - 12}" y="${y + 5}" text-anchor="end" font-size="16">${value}%</text>`;
  }
  chartData.forEach((row, index) => {
    const center = left + (index + .5) * width / 7;
    [row.industry, row.salesRep].forEach((value, series) => {
      const x = center - 28 + series * 33;
      if (value === null || value < 0 || value > 100) {
        drawing += `<text x="${x + 11}" y="${bottom - 8}" font-size="12" text-anchor="middle">N/D</text>`;
      } else {
        const h = value / 100 * height;
        drawing += `<rect x="${x}" y="${bottom - h}" width="23" height="${h}" fill="${series ? '#993366' : '#ffff99'}" stroke="#666"/><text x="${x + 11}" y="${bottom - h - 7}" text-anchor="middle" font-size="14">${Math.round(value)}%</text>`;
      }
    });
    drawing += `<text transform="translate(${center + 8},${bottom + 17}) rotate(-48)" text-anchor="end" font-size="14">${escape(row.category)}</text>`;
  });
  return drawing + `<text transform="translate(32,240) rotate(-90)" text-anchor="middle" font-size="18">Percentage Score</text>
    <text x="418" y="530" text-anchor="middle" font-size="17">Evaluation Categories</text>
    <rect x="560" y="473" width="242" height="28" fill="#ccffff" stroke="#777"/>
    <rect x="573" y="482" width="10" height="10" fill="#ffff99" stroke="#666"/><text x="589" y="492" font-size="13">Industry</text>
    <rect x="676" y="482" width="10" height="10" fill="#993366" stroke="#666"/><text x="692" y="492" font-size="13">Sales Rep</text></svg>`;
}
function buildHTML(data, options = {}) {
  const model = buildReportModel(data, options);
  const logo = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, "templates/logo.png")).toString("base64")}`;
  const chartData = generateChartData({ sections: model.sections.map(s => ({ key: s.key, section_score: s.earned, possible_score: s.possible })), percentage: model.percentage });
  const cover = `<section class="page cover">${preview(model)}<img class="cover-logo" src="${logo}" alt="New Home Mystery Shops"><div class="brand-tagline"><b>Personnel Profiles</b>Serving the New Home Industry since 1971</div>
    <div class="cover-center"><div class="confidential">CONFIDENTIAL</div><div class="cover-name">${escape(model.name)}</div><div class="cover-community">${escape(model.community)}</div><div class="cover-date">${escape(model.visitDate)}</div></div><a class="website" href="https://www.NewHomeMysteryShops.com">www.NewHomeMysteryShops.com</a></section>`;
  const narrative = `<section class="page narrative" id="narrative-source">${preview(model)}<div class="narrative-body"><header class="narrative-header">Sales Representative (SR): ${escape(model.name)}<div class="date">Evaluation Date: ${escape(model.visitDate)}</div></header><h1 class="narrative-main">Performance Breakdown: Strengths &amp; Opportunities</h1>${model.narratives.map(narrativeTopic).join("")}</div></section>`;
  const notes = [];
  if (model.evaluatorNote) notes.push(`<h2 class="topic-title">Final evaluator note</h2><p>${escape(model.evaluatorNote)}</p>`);
  for (const section of model.sections) for (const q of section.questions) if (q.note) notes.push(`<h2 class="topic-title">${escape(section.title)} · ${escape(q.number)}</h2><p>${escape(q.note)}</p>`);
  const notesPage = notes.length ? `<section class="page narrative notes-source"><div class="narrative-body"><header class="narrative-header">${escape(model.name)}, Continued</header><h1 class="narrative-main">Evaluator Notes</h1>${notes.join("")}</div></section>` : "";
  const auditItems = model.issues.map(i => `<li>${escape(i.code.replaceAll("_", " "))}: <code>${escape(i.field)}</code></li>`).join("");
  const audit = model.issues.length ? `<section class="page narrative notes-source"><div class="narrative-body"><header class="narrative-header">${escape(model.name)}, Continued</header><h1 class="narrative-main">Report Data Verification</h1><p>Missing data has not been treated as a negative answer. Resolve these source mappings before publishing this report.</p><ul>${auditItems}</ul></div></section>` : "";
  const chart = `<section class="page chart-page">${preview(model)}<h1 class="chart-name">${escape(model.name)}</h1><h2 class="chart-title">Comparison Graph to Industry Averages</h2>${chartSVG(chartData)}${footer}</section>`;
  const css = fs.readFileSync(path.join(ROOT, "templates/report.styles.css"), "utf8");
  const template = fs.readFileSync(path.join(ROOT, "templates/report.template.html"), "utf8");
  return { html: template.replace("{{CSS}}", () => css).replace("{{PAGES}}", () => cover + scorecard(model, logo) + narrative + notesPage + audit + chart), model, chartData };
}

async function paginate(page, name) {
  return page.evaluate(name => {
    // Measure actual browser layout. Keep topics intact when possible; split long topics
    // by paragraph/list item with representative continuation headers, never clipping.
    const sources = [...document.querySelectorAll('#narrative-source, .notes-source')];
    for (const source of sources) {
      const body = source.querySelector('.narrative-body');
      const original = [...body.children];
      body.replaceChildren();
      let currentBody = body;
      const fits = () => currentBody.scrollHeight <= currentBody.clientHeight + 1;
      const newPage = () => {
        const next = document.createElement('section'); next.className = 'page narrative';
        const nextBody = document.createElement('div'); nextBody.className = 'narrative-body';
        const header = document.createElement('header'); header.className = 'narrative-header'; header.textContent = `${name}, Continued`;
        nextBody.append(header); next.append(nextBody); currentBody.parentElement.after(next); currentBody = nextBody;
      };
      const add = node => {
        currentBody.append(node);
        if (fits()) return;
        const oversized = node.getBoundingClientRect().height > currentBody.clientHeight - 55;
        node.remove();
        if (!oversized) {
          if (currentBody.children.length > 1) newPage();
          currentBody.append(node);
          if (fits()) return;
          node.remove();
        }
        if (node.children.length) {
          for (const child of [...node.children]) add(child);
          return;
        }
        const words = node.textContent.split(/\s+/).filter(Boolean);
        while (words.length) {
          const part = node.cloneNode(false); currentBody.append(part);
          let low = 0, high = words.length;
          while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            part.textContent = words.slice(0, middle).join(' ');
            if (fits()) low = middle; else high = middle - 1;
          }
          if (!low) {
            part.remove();
            if (currentBody.children.length <= 1) throw new Error('Unbreakable narrative content exceeds page width/height');
            newPage(); continue;
          }
          part.textContent = words.splice(0, low).join(' ');
          if (words.length) newPage();
        }
      };
      for (const node of original) {
        currentBody.append(node);
        if (fits()) continue;
        const oversized = node.getBoundingClientRect().height > currentBody.clientHeight - 55;
        node.remove();
        if (node.matches('.topic')) {
          if (!oversized) {
            newPage(); currentBody.append(node);
            if (fits()) continue;
            node.remove();
          }
          const fragments = [...node.children];
          for (let i = 0; i < fragments.length; i++) {
            const child = fragments[i];
            // Keep headings with their first paragraph/list item.
            if (/^H[123]$/.test(child.tagName) && fragments[i + 1]) {
              const group = document.createElement('div'); group.append(child);
              const next = fragments[++i];
              if (next.tagName === 'UL') {
                const first = document.createElement('ul');
                if (next.firstElementChild) first.append(next.firstElementChild);
                group.append(first); add(group);
                for (const item of [...next.children]) { const list = document.createElement('ul'); list.append(item); add(list); }
              } else { group.append(next); add(group); }
            } else add(child);
          }
        } else if (node.tagName === 'UL') {
          for (const item of [...node.children]) { const list = document.createElement('ul'); list.append(item); add(list); }
        } else add(node);
      }
    }
    return document.querySelectorAll('.page').length;
  }, name);
}
async function generatePDF(data, options = {}) {
  const { html, model, chartData } = buildHTML(data, options);
  const directory = options.outputDir || path.join(ROOT, "uploads/reports");
  fs.mkdirSync(directory, { recursive: true });
  const slug = model.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const fileName = `${slug}_${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}.pdf`;
  const filePath = options.outputPath || path.join(directory, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({ headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setViewport({ width: 1056, height: 816, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const pageCount = await paginate(page, model.name);
    if (model.previewLabel) await page.evaluate(label => {
      for (const sheet of document.querySelectorAll('.page')) {
        if (!sheet.querySelector('.preview')) {
          const banner = document.createElement('div'); banner.className = 'preview';
          banner.textContent = label; sheet.prepend(banner);
        }
      }
    }, model.previewLabel);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.page')].map((node, index) => {
      const box = node.getBoundingClientRect();
      const children = [...node.querySelectorAll('*')].filter(child => {
        if (child.closest('svg')) return false;
        const rect = child.getBoundingClientRect();
        return rect.right > box.right + 1 || rect.bottom > box.bottom + 1;
      });
      return children.length ? index + 1 : null;
    }).filter(Boolean));
    if (overflow.length) throw new Error(`Report layout overflows pages ${overflow.join(', ')}; no PDF written`);
    await page.pdf({ path: filePath, format: "Letter", landscape: true, printBackground: true,
      preferCSSPageSize: true, displayHeaderFooter: false, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    if (options.htmlPath) fs.writeFileSync(options.htmlPath, await page.content());
    return { fileName: path.basename(filePath), filePath, pageCount, issues: model.issues, scoreVerified: model.scoreVerified, chartData };
  } finally { await browser.close(); }
}
module.exports = { generatePDF, buildHTML, renderSection, chartSVG };

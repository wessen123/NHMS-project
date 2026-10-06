"use strict";

const fs =
  require("fs");

const path =
  require("path");

const {
  buildReportModel,
} = require(
  "./report.model"
);

const {
  generateChartData,
} = require(
  "./chart.service"
);

const ROOT =
  path.resolve(
    __dirname,
    ".."
  );


/* =========================================================
   ESCAPE HTML
========================================================= */

const escape =
  (value) =>
    String(
      value ?? ""
    )
      .replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&":
              "&amp;",

            "<":
              "&lt;",

            ">":
              "&gt;",

            '"':
              "&quot;",

            "'":
              "&#39;",
          })[
            character
          ]
      );


/* =========================================================
   POINT DISPLAY
========================================================= */

const point =
  (value) =>
    value === null
      ? "Missing"
      : Number(
          value
            .toFixed(
              2
            )
        )
          .toString();


/* =========================================================
   WEBSITE
========================================================= */

const WEBSITE_URL =
  "https://newhomemysteryshops.com/";

const WEBSITE_TEXT =
  "newhomemysteryshops.com";


/* =========================================================
   FOOTER

   Personnel Profiles removed.
========================================================= */

const footer =
  `<div class="footer">
    © New Home Mystery Shops ·
    <a
      href="${WEBSITE_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >${WEBSITE_TEXT}</a>
  </div>`;


/* =========================================================
   PREVIEW
========================================================= */

const preview =
  (model) =>
    model.previewLabel
      ? `<div class="preview">${escape(
          model.previewLabel
        )}</div>`
      : "";


/* =========================================================
   SCORECARD SECTION
========================================================= */

function renderSection(
  section
) {

  const rows =
    section.questions
      .length
      ? section.questions
          .map(
            (question) => {

              const group =
                question.group
                  ? `<div class="question-group">${escape(
                      question.group
                    )}</div>`
                  : "";

              const subtext =
                question.subtext
                  ? `<div class="question-subtext">${escape(
                      question.subtext
                    )}</div>`
                  : "";

              return `
                <tr>

                  <td class="number">
                    ${escape(
                      question.number
                    )}
                  </td>

                  <td>
                    ${group}

                    ${escape(
                      question.question
                    )}

                    ${subtext}
                  </td>

                  <td class="points">
                    ${
                      question
                        .informational
                        ? "-"
                        : point(
                            question
                              .possible
                          )
                    }
                  </td>

                  <td class="points">
                    ${escape(
                      question.yes
                    )}
                  </td>

                  <td class="points">
                    ${escape(
                      question.no
                    )}
                  </td>

                </tr>
              `;
            }
          )
          .join("")
      : `
        <tr>
          <td
            colspan="5"
            class="missing"
          >
            Question data missing
          </td>
        </tr>
      `;

  return `
    <table class="score-table">

      <colgroup>
        <col style="width:4%">
        <col style="width:70%">
        <col style="width:9%">
        <col style="width:11%">
        <col style="width:6%">
      </colgroup>

      <thead>

        <tr>
          <th
            colspan="5"
            class="section-head"
          >
            <div>

              <span>
                ${escape(
                  section.title
                    .toUpperCase()
                )}
                (${point(
                  section.possible
                )})
              </span>

              <small>
                Efficiency Rating:
                ${point(
                  section.earned
                )}
              </small>

            </div>
          </th>
        </tr>

        <tr class="column-head">
          <th></th>
          <th></th>
          <th>Possible</th>
          <th>YES</th>
          <th>NO</th>
        </tr>

      </thead>

      <tbody>
        ${rows}
      </tbody>

    </table>
  `;
}


/* =========================================================
   VIDEO LINK

   PDF viewers ultimately decide whether an external link
   opens in a new browser tab/window.
========================================================= */

function renderVideoLink(
  model
) {

  if (
    !model.videoURL
  ) {

    return `
      <span class="missing">
        VIDEO LINK — unavailable
      </span>
    `;
  }

  return `
    <a
      href="${escape(
        model.videoURL
      )}"
      target="_blank"
      rel="noopener noreferrer"
    >
      VIDEO LINK
    </a>
  `;
}


/* =========================================================
   SCORECARD PAGE
========================================================= */

function scorecard(
  model,
  logo
) {

  return `
    <section class="page scorecard">

      ${preview(
        model
      )}

      <header class="report-header">

        <img
          class="report-logo"
          src="${logo}"
          alt="New Home Mystery Shops"
        >

        <div class="video-link">
          ${renderVideoLink(
            model
          )}
        </div>

      </header>


      <div class="scorecard-grid">

        <div class="scorecard-column">

          <table class="visit-table score-meta">

            <tr>
              <td
                colspan="2"
                class="tag"
              >
                Improved Performance Through Evaluation
              </td>
            </tr>

            <tr>

              <td>
                Date:
                ${escape(
                  model.visitDate
                )}
              </td>

              <td>
                Total Score:
                <b>
                  ${point(
                    model.total
                  )}
                </b>
                /
                ${point(
                  model.possible
                )}
                possible
              </td>

            </tr>

            <tr>
              <td colspan="2">
                Representative (SR):
                <b>
                  ${escape(
                    model.name
                  )}
                </b>
              </td>
            </tr>

            <tr>
              <td colspan="2">
                Community:
                ${escape(
                  model.community
                )}
              </td>
            </tr>

          </table>


          ${model.sections
            .slice(
              0,
              3
            )
            .map(
              renderSection
            )
            .join("")}

        </div>


        <div class="scorecard-column">

          <table class="visit-table visit-times">

            <tr>

              <td>
                Time In:
                ${escape(
                  model.timeIn
                )}
              </td>

              <td>
                Time Out:
                ${escape(
                  model.timeOut
                )}
              </td>

            </tr>

          </table>


          ${model.sections
            .slice(
              3
            )
            .map(
              renderSection
            )
            .join("")}

        </div>

      </div>


      <div class="legend">

        <span>
          N/A — Not applicable ·
          NMD — Not Much Discussed
          <br>
          N/A receives full possible points in YES.
        </span>

        <span>
          * Full credit not allowed ·
          ** Some credit allowed
          <br>
          Efficiency Rating shows section points;
          chart shows percentages.
        </span>

      </div>


      ${footer}

    </section>
  `;
}


/* =========================================================
   NARRATIVE LIST
========================================================= */

function narrativeList(
  values,
  type
) {

  if (
    Array.isArray(
      values
    ) &&
    values.length
  ) {

    return values
      .map(
        (value) =>
          `<li>${escape(
            value
          )}</li>`
      )
      .join("");
  }

  if (
    type ===
    "strengths"
  ) {

    return `
      <li class="missing">
        No specific strength was documented for this area.
      </li>
    `;
  }

  return `
    <li class="missing">
      No specific opportunity was identified for this area.
    </li>
  `;
}


/* =========================================================
   NARRATIVE TOPIC

   IMPORTANT:
   Raw evaluator notes are NOT rendered here.
========================================================= */

function narrativeTopic(
  topic
) {

  return `
    <article class="topic">

      <h2 class="topic-title">
        ${escape(
          topic.title
        )}
      </h2>

      <p>
        ${escape(
          topic.narrative
        )}
      </p>


      <h3 class="subheading">
        Strengths:
      </h3>

      <ul>
        ${narrativeList(
          topic.strengths,
          "strengths"
        )}
      </ul>


      <h3 class="subheading">
        Opportunities:
      </h3>

      <ul>
        ${narrativeList(
          topic.opportunities,
          "opportunities"
        )}
      </ul>

    </article>
  `;
}


/* =========================================================
   CHART
========================================================= */

function chartSVG(
  chartData
) {

  const left =
    108;

  const top =
    72;

  const width =
    620;

  const height =
    295;

  const bottom =
    top +
    height;

  let drawing = `
    <svg
      class="comparison-chart"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 830 560"
      role="img"
      aria-label="Representative compared with static industry benchmarks"
    >

      <rect
        x="1"
        y="1"
        width="828"
        height="558"
        fill="white"
        stroke="#777"
      />

      <rect
        x="${left}"
        y="${top}"
        width="${width}"
        height="${height}"
        fill="#99ccff"
      />
  `;

  for (
    let value = 0;
    value <= 100;
    value += 20
  ) {

    const y =
      bottom -
      value /
        100 *
        height;

    drawing += `
      <line
        x1="${left}"
        y1="${y}"
        x2="${left + width}"
        y2="${y}"
        stroke="#333"
        stroke-width="1"
      />

      <text
        x="${left - 12}"
        y="${y + 5}"
        text-anchor="end"
        font-size="16"
      >
        ${value}%
      </text>
    `;
  }

  chartData.forEach(
    (
      row,
      index
    ) => {

      const center =
        left +
        (
          index +
          0.5
        ) *
          width /
          7;

      [
        row.industry,
        row.salesRep,
      ].forEach(
        (
          value,
          series
        ) => {

          const x =
            center -
            28 +
            series *
              33;

          if (
            value === null ||
            value < 0 ||
            value > 100
          ) {

            drawing += `
              <text
                x="${x + 11}"
                y="${bottom - 8}"
                font-size="12"
                text-anchor="middle"
              >
                N/D
              </text>
            `;

          } else {

            const h =
              value /
              100 *
              height;

            drawing += `
              <rect
                x="${x}"
                y="${bottom - h}"
                width="23"
                height="${h}"
                fill="${
                  series
                    ? "#993366"
                    : "#ffff99"
                }"
                stroke="#666"
              />

              <text
                x="${x + 11}"
                y="${bottom - h - 7}"
                text-anchor="middle"
                font-size="14"
              >
                ${Math.round(
                  value
                )}%
              </text>
            `;
          }
        }
      );

      drawing += `
        <text
          transform="translate(${
            center +
            8
          },${
            bottom +
            17
          }) rotate(-48)"
          text-anchor="end"
          font-size="14"
        >
          ${escape(
            row.category
          )}
        </text>
      `;
    }
  );

  return (
    drawing +
    `
      <text
        transform="translate(32,240) rotate(-90)"
        text-anchor="middle"
        font-size="18"
      >
        Percentage Score
      </text>

      <text
        x="418"
        y="530"
        text-anchor="middle"
        font-size="17"
      >
        Evaluation Categories
      </text>

      <rect
        x="560"
        y="473"
        width="242"
        height="28"
        fill="#ccffff"
        stroke="#777"
      />

      <rect
        x="573"
        y="482"
        width="10"
        height="10"
        fill="#ffff99"
        stroke="#666"
      />

      <text
        x="589"
        y="492"
        font-size="13"
      >
        Industry
      </text>

      <rect
        x="676"
        y="482"
        width="10"
        height="10"
        fill="#993366"
        stroke="#666"
      />

      <text
        x="692"
        y="492"
        font-size="13"
      >
        Sales Rep
      </text>

    </svg>
    `
  );
}


/* =========================================================
   BUILD HTML
========================================================= */

function buildHTML(
  data,
  options = {}
) {

  const model =
    buildReportModel(
      data,
      options
    );

  const logo =
    `data:image/png;base64,${
      fs
        .readFileSync(
          path.join(
            ROOT,
            "templates/logo.png"
          )
        )
        .toString(
          "base64"
        )
    }`;

  const chartData =
    generateChartData({

      sections:
        model.sections
          .map(
            (section) => ({

              key:
                section.key,

              section_score:
                section.earned,

              possible_score:
                section.possible,

            })
          ),

      percentage:
        model.percentage,
    });


  /* =====================================================
     COVER

     Personnel Profiles removed.
  ===================================================== */

  const cover = `
    <section class="page cover">

      ${preview(
        model
      )}

      <img
        class="cover-logo"
        src="${logo}"
        alt="New Home Mystery Shops"
      >

      <div class="brand-tagline">
        Serving the New Home Industry since 1971
      </div>


      <div class="cover-center">

        <div class="confidential">
          CONFIDENTIAL
        </div>

        <div class="cover-name">
          ${escape(
            model.name
          )}
        </div>

        <div class="cover-community">
          ${escape(
            model.community
          )}
        </div>

        <div class="cover-date">
          ${escape(
            model.visitDate
          )}
        </div>

      </div>


      <a
        class="website"
        href="${WEBSITE_URL}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${WEBSITE_TEXT}
      </a>

    </section>
  `;


  /* =====================================================
     AI NARRATIVE

     No raw evaluator notes.
  ===================================================== */

  const narrative = `
    <section
      class="page narrative"
      id="narrative-source"
    >

      ${preview(
        model
      )}

      <div class="narrative-body">

        <header class="narrative-header">

          Sales Representative (SR):
          ${escape(
            model.name
          )}

          <div class="date">
            Evaluation Date:
            ${escape(
              model.visitDate
            )}
          </div>

        </header>


        <h1 class="narrative-main">
          Performance Breakdown:
          Strengths &amp; Opportunities
        </h1>


        ${model.narratives
          .map(
            narrativeTopic
          )
          .join("")}

      </div>

    </section>
  `;


  /*
   * IMPORTANT:
   *
   * There is deliberately NO:
   *
   * - Evaluator Notes page
   * - section.note rendering
   * - evaluatorNote rendering
   * - question note rendering
   */

  const chart = `
    <section class="page chart-page">

      ${preview(
        model
      )}

      <h1 class="chart-name">
        ${escape(
          model.name
        )}
      </h1>

      <h2 class="chart-title">
        Comparison Graph to Industry Averages
      </h2>

      ${chartSVG(
        chartData
      )}

      ${footer}

    </section>
  `;

  const css =
    fs.readFileSync(
      path.join(
        ROOT,
        "templates/report.styles.css"
      ),
      "utf8"
    );

  const template =
    fs.readFileSync(
      path.join(
        ROOT,
        "templates/report.template.html"
      ),
      "utf8"
    );

  return {

    html:
      template
        .replace(
          "{{CSS}}",
          () =>
            css
        )
        .replace(
          "{{PAGES}}",
          () =>
            cover +
            scorecard(
              model,
              logo
            ) +
            narrative +
            chart
        ),

    model,

    chartData,
  };
}


/* =========================================================
   PAGINATION
========================================================= */

async function paginate(
  page,
  name
) {

  return page.evaluate(
    (name) => {

      const sources = [
        ...document
          .querySelectorAll(
            "#narrative-source"
          ),
      ];

      for (
        const source of
        sources
      ) {

        const body =
          source
            .querySelector(
              ".narrative-body"
            );

        const original = [
          ...body.children,
        ];

        body
          .replaceChildren();

        let currentBody =
          body;

        const fits =
          () =>
            currentBody
              .scrollHeight <=
            currentBody
              .clientHeight +
              1;

        const newPage =
          () => {

            const next =
              document
                .createElement(
                  "section"
                );

            next.className =
              "page narrative";

            const nextBody =
              document
                .createElement(
                  "div"
                );

            nextBody.className =
              "narrative-body";

            const header =
              document
                .createElement(
                  "header"
                );

            header.className =
              "narrative-header";

            header.textContent =
              `${name}, Continued`;

            nextBody.append(
              header
            );

            next.append(
              nextBody
            );

            currentBody
              .parentElement
              .after(
                next
              );

            currentBody =
              nextBody;
          };

        const add =
          (node) => {

            currentBody
              .append(
                node
              );

            if (
              fits()
            ) {
              return;
            }

            const oversized =
              node
                .getBoundingClientRect()
                .height >
              currentBody
                .clientHeight -
                55;

            node.remove();

            if (
              !oversized
            ) {

              if (
                currentBody
                  .children
                  .length >
                1
              ) {
                newPage();
              }

              currentBody
                .append(
                  node
                );

              if (
                fits()
              ) {
                return;
              }

              node.remove();
            }

            if (
              node
                .children
                .length
            ) {

              for (
                const child of [
                  ...node.children,
                ]
              ) {

                add(
                  child
                );
              }

              return;
            }

            const words =
              node
                .textContent
                .split(
                  /\s+/
                )
                .filter(
                  Boolean
                );

            while (
              words.length
            ) {

              const part =
                node
                  .cloneNode(
                    false
                  );

              currentBody
                .append(
                  part
                );

              let low =
                0;

              let high =
                words.length;

              while (
                low <
                high
              ) {

                const middle =
                  Math.ceil(
                    (
                      low +
                      high
                    ) /
                    2
                  );

                part.textContent =
                  words
                    .slice(
                      0,
                      middle
                    )
                    .join(
                      " "
                    );

                if (
                  fits()
                ) {

                  low =
                    middle;

                } else {

                  high =
                    middle -
                    1;
                }
              }

              if (
                !low
              ) {

                part.remove();

                if (
                  currentBody
                    .children
                    .length <=
                  1
                ) {

                  throw new Error(
                    "Unbreakable narrative content exceeds page width/height"
                  );
                }

                newPage();

                continue;
              }

              part.textContent =
                words
                  .splice(
                    0,
                    low
                  )
                  .join(
                    " "
                  );

              if (
                words.length
              ) {

                newPage();
              }
            }
          };

        for (
          const node of
          original
        ) {

          currentBody
            .append(
              node
            );

          if (
            fits()
          ) {
            continue;
          }

          const oversized =
            node
              .getBoundingClientRect()
              .height >
            currentBody
              .clientHeight -
              55;

          node.remove();

          if (
            node.matches(
              ".topic"
            )
          ) {

            if (
              !oversized
            ) {

              newPage();

              currentBody
                .append(
                  node
                );

              if (
                fits()
              ) {
                continue;
              }

              node.remove();
            }

            const fragments = [
              ...node.children,
            ];

            for (
              let i = 0;
              i <
              fragments.length;
              i++
            ) {

              const child =
                fragments[i];

              if (
                /^H[123]$/.test(
                  child.tagName
                ) &&
                fragments[
                  i + 1
                ]
              ) {

                const group =
                  document
                    .createElement(
                      "div"
                    );

                group.append(
                  child
                );

                const next =
                  fragments[
                    ++i
                  ];

                if (
                  next.tagName ===
                  "UL"
                ) {

                  const first =
                    document
                      .createElement(
                        "ul"
                      );

                  if (
                    next
                      .firstElementChild
                  ) {

                    first.append(
                      next
                        .firstElementChild
                    );
                  }

                  group.append(
                    first
                  );

                  add(
                    group
                  );

                  for (
                    const item of [
                      ...next.children,
                    ]
                  ) {

                    const list =
                      document
                        .createElement(
                          "ul"
                        );

                    list.append(
                      item
                    );

                    add(
                      list
                    );
                  }

                } else {

                  group.append(
                    next
                  );

                  add(
                    group
                  );
                }

              } else {

                add(
                  child
                );
              }
            }

          } else if (
            node.tagName ===
            "UL"
          ) {

            for (
              const item of [
                ...node.children,
              ]
            ) {

              const list =
                document
                  .createElement(
                    "ul"
                  );

              list.append(
                item
              );

              add(
                list
              );
            }

          } else {

            add(
              node
            );
          }
        }
      }

      return document
        .querySelectorAll(
          ".page"
        )
        .length;
    },

    name
  );
}


/* =========================================================
   GENERATE PDF
========================================================= */

async function generatePDF(
  data,
  options = {}
) {

  const {
    html,
    model,
    chartData,
  } =
    buildHTML(
      data,
      options
    );

  const directory =
    options
      .outputDir ||
    path.join(
      ROOT,
      "uploads/reports"
    );

  fs.mkdirSync(
    directory,
    {
      recursive:
        true,
    }
  );


  /* =====================================================
     PDF FILE NAME

     Format:
     john_davis_2026-10-05.pdf

     Uses report/evaluation visit date first.
     Falls back to the server's LOCAL date.

     No UTC timestamp.
     No hours/minutes/seconds.
     No milliseconds.
     No random suffix.
  ===================================================== */

  const slug =
    String(
      model.name ||
      "report"
    )
      .trim()
      .replace(
        /[^a-z0-9]+/gi,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      )
      .toLowerCase() ||
    "report";


  const reportDate =
    (() => {

      const visitDate =
        String(
          model.visitDate ||
          ""
        ).trim();


      /*
       * Already in:
       * YYYY-MM-DD
       */

      const isoDateMatch =
        visitDate.match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );

      if (
        isoDateMatch
      ) {

        return (
          `${isoDateMatch[1]}-` +
          `${isoDateMatch[2]}-` +
          `${isoDateMatch[3]}`
        );
      }


      /*
       * ISO-like timestamp.
       *
       * Important:
       * Take the written date portion directly.
       * Do not convert it through UTC.
       */

      const isoTimestampMatch =
        visitDate.match(
          /^(\d{4})-(\d{2})-(\d{2})[T\s]/
        );

      if (
        isoTimestampMatch
      ) {

        return (
          `${isoTimestampMatch[1]}-` +
          `${isoTimestampMatch[2]}-` +
          `${isoTimestampMatch[3]}`
        );
      }


      /*
       * US numeric:
       * MM/DD/YYYY
       */

      const usDateMatch =
        visitDate.match(
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

      if (
        usDateMatch
      ) {

        const month =
          String(
            Number(
              usDateMatch[1]
            )
          ).padStart(
            2,
            "0"
          );

        const day =
          String(
            Number(
              usDateMatch[2]
            )
          ).padStart(
            2,
            "0"
          );

        return (
          `${usDateMatch[3]}-` +
          `${month}-` +
          `${day}`
        );
      }


      /*
       * Report formatted date:
       * October 5, 2026
       */

      const namedDateMatch =
        visitDate.match(
          /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/
        );

      if (
        namedDateMatch
      ) {

        const monthNames = {
          january: "01",
          february: "02",
          march: "03",
          april: "04",
          may: "05",
          june: "06",
          july: "07",
          august: "08",
          september: "09",
          october: "10",
          november: "11",
          december: "12",
        };

        const month =
          monthNames[
            namedDateMatch[1]
              .toLowerCase()
          ];

        const day =
          String(
            Number(
              namedDateMatch[2]
            )
          ).padStart(
            2,
            "0"
          );

        if (
          month
        ) {

          return (
            `${namedDateMatch[3]}-` +
            `${month}-` +
            `${day}`
          );
        }
      }


      /*
       * Final fallback:
       *
       * LOCAL SERVER CALENDAR DATE.
       *
       * Do NOT use:
       * new Date().toISOString()
       *
       * because toISOString() is UTC.
       */

      const now =
        new Date();

      const year =
        now.getFullYear();

      const month =
        String(
          now.getMonth() +
          1
        ).padStart(
          2,
          "0"
        );

      const day =
        String(
          now.getDate()
        ).padStart(
          2,
          "0"
        );

      return (
        `${year}-` +
        `${month}-` +
        `${day}`
      );
    })();


  const fileName =
    `${slug}_${reportDate}.pdf`;


  const filePath =
    options
      .outputPath ||
    path.join(
      directory,
      fileName
    );


  fs.mkdirSync(
    path.dirname(
      filePath
    ),
    {
      recursive:
        true,
    }
  );


  const puppeteer =
    require(
      "puppeteer"
    );


  const browser =
    await puppeteer
      .launch({

        headless:
          true,

        ...(
          process.env
            .PUPPETEER_EXECUTABLE_PATH
            ? {
                executablePath:
                  process.env
                    .PUPPETEER_EXECUTABLE_PATH,
              }
            : {}
        ),

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],

      });


  try {

    const page =
      await browser
        .newPage();


    /*
     * The generated report is self-contained.
     *
     * Links remain href attributes in the resulting PDF,
     * but Puppeteer does not need to load them while
     * generating the document.
     */

    await page
      .setRequestInterception(
        true
      );


    page.on(
      "request",
      (request) =>
        /^(data:|about:)/
          .test(
            request.url()
          )
          ? request
              .continue()
          : request
              .abort()
    );


    await page
      .emulateMediaType(
        "print"
      );


    await page
      .setViewport({

        width:
          1056,

        height:
          816,

        deviceScaleFactor:
          1,

      });


    await page
      .setContent(
        html,
        {

          waitUntil:
            "load",

          timeout:
            30000,

        }
      );


    await page
      .evaluate(
        async () => {

          await document
            .fonts
            .ready;

          await Promise
            .all(
              [
                ...document.images,
              ].map(
                (image) =>
                  image.decode()
              )
            );
        }
      );


    /* =====================================================
       SCORECARD FIT
    ===================================================== */

    await page
      .evaluate(
        () => {

          const sheet =
            document
              .querySelector(
                ".scorecard"
              );

          if (
            !sheet
          ) {
            return;
          }

          const footer =
            sheet
              .querySelector(
                ".footer"
              );

          const legend =
            sheet
              .querySelector(
                ".legend"
              );

          for (
            let size =
              7.3;
            size >=
              6.0;
            size -=
              0.1
          ) {

            for (
              const table of
              sheet
                .querySelectorAll(
                  ".score-table"
                )
            ) {

              table.style
                .fontSize =
                `${size}pt`;
            }

            if (
              legend
                .getBoundingClientRect()
                .bottom <
              footer
                .getBoundingClientRect()
                .top -
                8
            ) {
              return;
            }
          }

          throw new Error(
            "Scorecard is too long for a readable single page"
          );
        }
      );


    /* =====================================================
       NARRATIVE PAGINATION
    ===================================================== */

    const pageCount =
      await paginate(
        page,
        model.name
      );


    /* =====================================================
       PREVIEW LABEL
    ===================================================== */

    if (
      model.previewLabel
    ) {

      await page
        .evaluate(
          (label) => {

            for (
              const sheet of
              document
                .querySelectorAll(
                  ".page"
                )
            ) {

              if (
                !sheet
                  .querySelector(
                    ".preview"
                  )
              ) {

                const banner =
                  document
                    .createElement(
                      "div"
                    );

                banner.className =
                  "preview";

                banner.textContent =
                  label;

                sheet.prepend(
                  banner
                );
              }
            }
          },

          model.previewLabel
        );
    }


    /* =====================================================
       OVERFLOW CHECK
    ===================================================== */

    const overflow =
      await page
        .evaluate(
          () =>
            [
              ...document
                .querySelectorAll(
                  ".page"
                ),
            ]
              .map(
                (
                  node,
                  index
                ) => {

                  const box =
                    node
                      .getBoundingClientRect();

                  const children = [
                    ...node
                      .querySelectorAll(
                        "*"
                      ),
                  ]
                    .filter(
                      (child) => {

                        if (
                          child.closest(
                            "svg"
                          )
                        ) {
                          return false;
                        }

                        const rect =
                          child
                            .getBoundingClientRect();

                        return (
                          rect.right >
                            box.right +
                              1 ||
                          rect.bottom >
                            box.bottom +
                              1
                        );
                      }
                    );

                  return children
                    .length
                    ? index +
                        1
                    : null;
                }
              )
              .filter(
                Boolean
              )
        );


    if (
      overflow.length
    ) {

      throw new Error(
        `Report layout overflows pages ${overflow.join(
          ", "
        )}; no PDF written`
      );
    }


    /* =====================================================
       WRITE PDF
    ===================================================== */

    await page
      .pdf({

        path:
          filePath,

        format:
          "Letter",

        landscape:
          true,

        printBackground:
          true,

        preferCSSPageSize:
          true,

        displayHeaderFooter:
          false,

        margin: {

          top:
            0,

          right:
            0,

          bottom:
            0,

          left:
            0,

        },

      });


    if (
      options
        .htmlPath
    ) {

      fs.writeFileSync(
        options
          .htmlPath,

        await page
          .content()
      );
    }


    return {

      fileName:
        path.basename(
          filePath
        ),

      filePath,

      pageCount,

      issues:
        model.issues,

      scoreVerified:
        model
          .scoreVerified,

      chartData,

      videoURL:
        model.videoURL ||
        null,

    };

  } finally {

    await browser
      .close();
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  generatePDF,

  buildHTML,

  renderSection,

  chartSVG,

};
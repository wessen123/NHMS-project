module.exports = [
  // =========================
  // APPROACH (8)
  // =========================
  {
    key: "approach",
    name: "APPROACH (8)",
    questions: [
      { id: "app_1", text: "Did SR smile?", type: "yes_no", weight: 1 },
      { id: "app_2", text: "Did SR rise to speak?", type: "yes_no", weight: 1 },
      { id: "app_3", text: "Did SR make friendly greeting?", type: "yes_no", weight: 1 },
      { id: "app_4", text: "Did SR introduce himself/herself?", type: "yes_no", weight: 1 },
      { id: "app_5", text: "Did SR acknowledge and ask to wait if busy?", type: "yes_no", weight: 1 },
      { id: "app_6", text: "Did SR get your name?", type: "yes_no", weight: 1 },
      { id: "app_7", text: "Did SR inquire what attracted you?", type: "yes_no", weight: 2 }
    ]
  },

  // =========================
  // QUALIFYING (15)
  // =========================
  {
    key: "qualifying",
    name: "QUALIFYING (15)",
    questions: [
      {
        type: "group",
        text: "Did SR attempt to determine:",
        sub: [
          { id: "qual_a", text: "Motivations for moving", weight: 2.5 },
          { id: "qual_b", text: "Lifestyle needs", weight: 2.5 },
          { id: "qual_c", text: "Employment situation", weight: 2.5 },
          { id: "qual_d", text: "Ability to purchase", weight: 2.5 }
        ]
      },
      { id: "qual_1", text: "Strong qualifying sequence", type: "yes_no", weight: 5 }
    ]
  },

  // =========================
  // DEMONSTRATION (20)
  // =========================
  {
    key: "demonstration",
    name: "DEMONSTRATION (20)",
    questions: [
      {
        type: "group",
        text: "Did SR discuss benefits:",
        sub: [
          { id: "dem_a", text: "Community interests", weight: 5 },
          { id: "dem_b", text: "Pride of ownership", weight: 6 }
        ]
      },
      {
        type: "group",
        text: "Did SR sell product benefits:",
        sub: [
          { id: "dem_c", text: "Features", weight: 3 },
          { id: "dem_d", text: "Financing", weight: 3 },
          { id: "dem_e", text: "Price/value", weight: 3 }
        ]
      }
    ]
  },

  // =========================
  // PRESENTATION (20)
  // =========================
  {
    key: "presentation",
    name: "PRESENTATION (20)",
    questions: [
      { id: "pre_1", text: "Planned presentation", type: "yes_no", weight: 4 },
      { id: "pre_2", text: "Took command", type: "yes_no", weight: 4 },
      { id: "pre_3", text: "Conducted tour", type: "yes_no", weight: 5 },
      { id: "pre_4", text: "Used sales aids effectively", type: "yes_no", weight: 3 },
      { id: "pre_5", text: "Knowledge of community", type: "yes_no", weight: 2 },
      { id: "pre_6", text: "Knowledge of product", type: "yes_no", weight: 2 }
    ]
  },

  // =========================
  // CLOSE (22)
  // =========================
  {
    key: "closing",
    name: "CLOSE (22)",
    questions: [
      { id: "close_1", text: "Asked closing question", type: "yes_no", weight: 6 },
      { id: "close_2", text: "Overcame objections", type: "yes_no", weight: 4 },
      { id: "close_3", text: "Asked second time to buy", type: "yes_no", weight: 4 },
      { id: "close_4", text: "Asked for appointment", type: "yes_no", weight: 4 },
      { id: "close_5", text: "Captured contact info", type: "yes_no", weight: 2 },
      { id: "close_6", text: "Follow-up within 48 hours", type: "yes_no", weight: 2 }
    ]
  },

  // =========================
  // GENERAL ATTITUDE (15)
  // =========================
  {
    key: "attitude",
    name: "GENERAL ATTITUDE (15)",
    questions: [
      { id: "att_1", text: "Was SR enthusiastic?", type: "yes_no", weight: 3 },
      { id: "att_2", text: "Used your name", type: "yes_no", weight: 2 },
      { id: "att_3", text: "Made you feel wanted", type: "yes_no", weight: 1 },
      { id: "att_4", text: "Spoke clearly", type: "yes_no", weight: 1 },
      { id: "att_5", text: "Spoke at your level", type: "yes_no", weight: 1 },
      { id: "att_6", text: "Pleasant", type: "yes_no", weight: 1 },
      { id: "att_7", text: "Courteous", type: "yes_no", weight: 1 },
      { id: "att_8", text: "Sincere", type: "yes_no", weight: 1 },
      { id: "att_9", text: "Dressed appropriately", type: "yes_no", weight: 1 },
      { id: "att_10", text: "Creative demonstration", type: "yes_no", weight: 3 }
    ]
  }
];
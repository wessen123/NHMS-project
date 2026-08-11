require("dotenv").config();

const {
  generateRepPerformancePDF
} = require(
  "./services/rep.performance.pdf.generator"
);

(async () => {

  try {

    const result =

      await generateRepPerformancePDF(
        371059223232512
      );

    console.log(
      result.filePath
    );

  } catch (err) {

    console.error(
      err
    );
  }

})();
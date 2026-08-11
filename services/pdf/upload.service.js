const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function uploadToNocoBase(filePath, fileName) {
  console.log("📤 UPLOADING PDF TO NOCOBASE");

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF not found: ${filePath}`);
  }

  const form = new FormData();

  form.append("file", fs.createReadStream(filePath), fileName);

  const res = await axios.post(
    `${process.env.BASE_URL}/api/upload`,
    form,
    {
      headers: {
        Authorization: `Bearer ${process.env.NOCOBASE_TOKEN}`,
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  console.log("✅ UPLOAD SUCCESS");

  return res.data?.data;
}

module.exports = {
  uploadToNocoBase,
};
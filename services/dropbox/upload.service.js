const fs = require("fs");
const Dropbox = require("dropbox").Dropbox;
const fetch = require("node-fetch");

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_TOKEN,
  fetch,
});

async function uploadVideoToDropbox(localPath, dropboxPath) {
  console.log("📤 DROPBOX UPLOAD START");

  if (!fs.existsSync(localPath)) {
    throw new Error(`Video file not found: ${localPath}`);
  }

  const file = fs.readFileSync(localPath);

  const upload = await dbx.filesUpload({
    path: dropboxPath,
    contents: file,
    mode: "overwrite",
  });

  const shared = await dbx.sharingCreateSharedLinkWithSettings({
    path: upload.result.path_lower,
  });

  const url = shared.result.url.replace("?dl=0", "?raw=1");

  console.log("✅ DROPBOX URL:", url);

  return url;
}

module.exports = {
  uploadVideoToDropbox,
};
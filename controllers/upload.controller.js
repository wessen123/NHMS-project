const orderService = require("../services/order.service");
const DropboxService = require("../services/dropbox.service");

const crypto = require("crypto");

function isMissingDropboxFile(error) {
  const status = error.status ?? error.response?.status;
  const data = error.dropboxError ?? error.response?.data;
  return status === 409 && /^path\/not_found(?:\/|$)/.test(data?.error_summary || "");
}

exports.deleteVideo = async (req, res) => {
  const expectedSecret = process.env.VIDEO_DELETE_WEBHOOK_SECRET;
  const suppliedSecret = req.get("X-NHMS-Webhook-Secret");
  if (!expectedSecret || typeof suppliedSecret !== "string" ||
      !crypto.timingSafeEqual(
        crypto.createHash("sha256").update(expectedSecret).digest(),
        crypto.createHash("sha256").update(suppliedSecret).digest()
      )) {
    return res.status(401).json({ success: false, message: "Unauthorized webhook" });
  }

  const body = req.body || {};
  for (const field of ["video_id", "nhms_shop_id"]) {
    if (typeof body[field] !== "string" || !/^[1-9]\d*$/.test(body[field])) {
      return res.status(400).json({ success: false, message: `${field} must be a positive numeric ID string` });
    }
  }
  if (!["raw_video", "edited_video"].includes(body.record_type)) {
    return res.status(400).json({ success: false, message: "record_type must be raw_video or edited_video" });
  }

  const filePath = body.file_path;
  if (typeof filePath !== "string" || !filePath.trim()) {
    return res.status(400).json({ success: false, message: "file_path is required and must be a non-empty string" });
  }
  const parts = filePath.split("/");
  const edited = body.record_type === "edited_video";
  if (filePath !== filePath.trim() || /[\\%\x00-\x1f\x7f]/.test(filePath) ||
      parts[0] !== "" || parts[1]?.toLowerCase() !== "apps" ||
      parts[2]?.toLowerCase() !== "nhms" || parts.length !== (edited ? 8 : 7) ||
      parts.slice(1).some(part => !part.trim() || part === "." || part === "..") ||
      (edited && parts[6].toLowerCase() !== "edited videos") ||
      (!edited && parts[6].toLowerCase() === "edited videos")) {
    return res.status(400).json({ success: false, message: "file_path must identify a file in the NHMS shop hierarchy for record_type" });
  }
  if (body.dropbox_file_id !== undefined &&
      (typeof body.dropbox_file_id !== "string" || !/^id:.+/.test(body.dropbox_file_id))) {
    return res.status(400).json({ success: false, message: "dropbox_file_id must be a Dropbox file ID string" });
  }

  const complete = alreadyMissing => res.json({
    success: true,
    cleanup_completed: true,
    already_missing: alreadyMissing,
    video_id: body.video_id,
    nhms_shop_id: body.nhms_shop_id
  });

  try {
    let metadata;
    try {
      metadata = await DropboxService.getFileMetadata(filePath);
    } catch (error) {
      if (isMissingDropboxFile(error)) return complete(true);
      throw error;
    }
    if (metadata?.[".tag"] !== "file") {
      return res.status(400).json({ success: false, message: "file_path must reference a Dropbox file, never a folder" });
    }
    if (typeof metadata.id !== "string" || !metadata.id.startsWith("id:")) {
      throw new Error("Invalid Dropbox file metadata");
    }
    if (body.dropbox_file_id && body.dropbox_file_id !== metadata.id) {
      return res.status(400).json({ success: false, message: "dropbox_file_id does not match file_path" });
    }
    // Resolve by path, then delete the verified file ID to avoid path replacement races.
    const result = await DropboxService.deleteFile(metadata.id);
    return complete(result?.already_deleted === true);
  } catch (error) {
    if (isMissingDropboxFile(error)) return complete(true);
    return res.status(500).json({ success: false, message: "Dropbox cleanup failed" });
  }
};

exports.processOrder = async (req, res) => {

  try {

    const orderId = req.body.orderId; // ✅ MATCH FRONTEND

    console.log("\n==============================");
    console.log("[CONTROLLER] processOrder called");
    console.log("Order ID:", orderId);
    console.log("==============================\n");

    console.log("BODY RECEIVED:", req.body);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    const result = await orderService.processOrder(orderId);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {

    console.error("[CONTROLLER ERROR]", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

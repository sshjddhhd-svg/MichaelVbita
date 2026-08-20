"use strict";

const axios = require("axios");

async function getImageInput(event) {
  const attachments = [
    ...(event?.attachments || []),
    ...(event?.messageReply?.attachments || []),
  ];
  const attachment = attachments.find((item) =>
    String(item?.type || "").toLowerCase() === "photo" || item?.url
  );
  const url = attachment?.url;
  if (!url) return null;

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 15 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

module.exports = { getImageInput };
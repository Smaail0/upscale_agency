const REQUIRED_FIELDS = [
  "nameOrBrand",
  "whatsapp",
  "availability",
  "hasReadyVideos"
];

function clean(value) {
  return typeof value === "string" ? value.trim().slice(0, 2000) : "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};

    if (clean(body.website)) {
      return res.status(200).json({ ok: true });
    }

    const lead = {
      nameOrBrand: clean(body.nameOrBrand),
      whatsapp: clean(body.whatsapp),
      availability: clean(body.availability),
      hasReadyVideos: clean(body.hasReadyVideos),
      package: clean(body.package),
      page: clean(body.page),
      submittedAt: clean(body.submittedAt) || new Date().toISOString(),
      userAgent: req.headers["user-agent"] || "",
      ip:
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        ""
    };

    const missing = REQUIRED_FIELDS.filter((field) => !lead[field]);
    if (missing.length) {
      return res.status(400).json({
        error: "Missing required fields",
        missing
      });
    }

    if (process.env.LEAD_WEBHOOK_URL) {
      const webhookResponse = await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead)
      });

      if (!webhookResponse.ok) {
        throw new Error(`Lead webhook failed: ${webhookResponse.status}`);
      }
    } else {
      console.log("New Upscale lead:", lead);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Lead submission error:", error);
    return res.status(500).json({ error: "Unable to submit lead" });
  }
};

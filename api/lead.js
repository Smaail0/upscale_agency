const REQUIRED_FIELDS = [
  "nameOrBrand",
  "whatsapp",
  "availability",
  "hasReadyVideos"
];

function clean(value) {
  return typeof value === "string" ? value.trim().slice(0, 2000) : "";
}

function jsonError(res, status, code, message, details = {}) {
  return res.status(status).json({
    ok: false,
    code,
    error: message,
    ...details
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
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
      return jsonError(res, 400, "MISSING_FIELDS", "Missing required fields", {
        missing
      });
    }

    if (!process.env.LEAD_WEBHOOK_URL) {
      console.error("Lead submission error: missing LEAD_WEBHOOK_URL");
      return jsonError(
        res,
        500,
        "MISSING_WEBHOOK_URL",
        "Lead webhook is not configured"
      );
    }

    let webhookResponse;
    try {
      webhookResponse = await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead)
      });
    } catch (error) {
      console.error("Lead webhook network error:", error);
      return jsonError(
        res,
        502,
        "WEBHOOK_NETWORK_ERROR",
        "Could not reach the lead webhook"
      );
    }

    if (!webhookResponse.ok) {
      const responseText = await webhookResponse.text().catch(() => "");
      console.error("Lead webhook failed:", {
        status: webhookResponse.status,
        response: responseText.slice(0, 300)
      });

      return jsonError(
        res,
        502,
        "WEBHOOK_FAILED",
        "Lead webhook rejected the request",
        { webhookStatus: webhookResponse.status }
      );
    }

    const webhookText = await webhookResponse.text().catch(() => "");
    let webhookPayload = null;

    try {
      webhookPayload = webhookText ? JSON.parse(webhookText) : null;
    } catch (error) {
      console.error("Lead webhook returned non-JSON response:", {
        response: webhookText.slice(0, 300)
      });

      return jsonError(
        res,
        502,
        "WEBHOOK_INVALID_RESPONSE",
        "Lead webhook returned an invalid response"
      );
    }

    if (!webhookPayload || webhookPayload.ok !== true) {
      console.error("Lead webhook returned an error payload:", webhookPayload);

      return jsonError(
        res,
        502,
        "WEBHOOK_ERROR_RESPONSE",
        "Lead webhook did not confirm the submission",
        {
          webhookError:
            webhookPayload && typeof webhookPayload.error === "string"
              ? webhookPayload.error
              : "Unknown webhook error"
        }
      );
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Lead submission error:", error);
    return jsonError(res, 500, "LEAD_SUBMISSION_ERROR", "Unable to submit lead");
  }
};

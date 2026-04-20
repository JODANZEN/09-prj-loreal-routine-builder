const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SYSTEM_PROMPT = `You are a L'Oréal beauty advisor. The user has selected specific L'Oréal products. Your role is to:
- Create clear, step-by-step skincare or beauty routines using ONLY the selected products.
- Include application order, timing (morning/evening), and usage tips.
- Answer follow-up questions about the routine, selected products, and general topics like skincare, haircare, makeup, and fragrance.
- When recommending additional products, stay focused on the user's selected items first.
Keep responses concise, warm, and professional.
IMPORTANT: Use plain text only. No markdown, no asterisks, no pound signs, no symbols for formatting.`;

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return corsJson({ error: "Not found" }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsJson({ error: "Invalid JSON body" }, 400);
    }

    const { messages = [], selectedProducts = [] } = body;

    if (!messages.length) {
      return corsJson({ error: "messages is required" }, 400);
    }

    const productContext = selectedProducts.length
      ? `\n\nSelected products:\n${selectedProducts
          .map((p) => `- ${p.brand} ${p.name} (${p.category}): ${p.description}`)
          .join("\n")}`
      : "";

    // Anthropic API requires messages to start with "user" role
    let apiMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: String(m.content) }));

    while (apiMessages.length && apiMessages[0].role === "assistant") {
      apiMessages.shift();
    }

    if (!apiMessages.length) {
      return corsJson({ error: "No valid messages provided" }, 400);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-search-preview",
          max_tokens: 1024,
          messages: [
            { role: "system", content: SYSTEM_PROMPT + productContext },
            ...apiMessages,
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return corsJson({ error: data.error?.message || "API error" }, 502);
      }

      const message = data.choices?.[0]?.message;
      let text = message?.content || "";

      // Append any web citations returned by the search model
      const citations = (message?.annotations || [])
        .filter((a) => a.type === "url_citation")
        .map((a) => `${a.url_citation.title}: ${a.url_citation.url}`);

      if (citations.length) {
        text += "\n\nSources:\n" + citations.join("\n");
      }

      return corsJson({ text });
    } catch {
      return corsJson({ error: "Failed to reach AI service" }, 502);
    }
  },
};

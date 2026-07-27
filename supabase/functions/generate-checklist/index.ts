import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { message, history, stream } = await req.json();

    const systemPrompt = `You are Quick-AI, a checklist generator in QuickCheck (free student tool).

CHECKLIST RULES (when asked to create one):
- # Title, ## Phase N — Topic for sections, ### Sub-topic for grouping within a phase
- Every single concept, algorithm, problem, or skill = its OWN "- [ ] item" line
- NEVER write broad items like "Array operations". Instead list EACH one:
  GOOD: "- [ ] Array Traversal", "- [ ] Insertion", "- [ ] Deletion", "- [ ] Linear Search", "- [ ] Binary Search", "- [ ] Find Largest Element"
  BAD: "- [ ] Array operations (insert, delete, search)"
- For DSA specifically, each phase should cover ONE topic deeply (Arrays, Strings, Sorting, etc.) with 15-40 individual items each
- Group items under ### sub-topics like "Basics", "Medium", "Advanced", "Problems"
- Aim for 150-300+ items total. Be exhaustive — every learnable piece gets its own line.
- End with ## Milestones section. NO filler text before/after — output ONLY markdown.

GENERAL: answer questions helpfully and briefly.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
      { role: "user", content: message },
    ];

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            await streamWithFallback(messages, (token) => {
              controller.enqueue(encoder.encode(token));
            });
          } catch (e) {
            controller.enqueue(encoder.encode("\n[Error: " + (e.message || "Stream failed") + "]"));
          }
          controller.close();
        },
      });
      return new Response(readable, {
        headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const result = await callWithFallback(messages);
    return new Response(JSON.stringify({ reply: result }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

async function callOpenAICompat(endpoint: string, apiKey: string, model: string, messages: object[]) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 8192 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = (typeof err.error === "string" && err.error) || err.error?.message || "Request failed";
    const error = new Error(msg);
    (error as any).status = status;
    throw error;
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callStreamOpenAICompat(endpoint: string, apiKey: string, model: string, messages: object[], onToken: (t: string) => void) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 8192, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = (typeof err.error === "string" && err.error) || err.error?.message || "Request failed";
    const error = new Error(msg);
    (error as any).status = status;
    throw error;
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch {}
    }
  }
}

async function callWithFallback(messages: object[]) {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const cerebrasKey = Deno.env.get("CEREBRAS_API_KEY");

  let lastError: any;

  if (openrouterKey) {
    try {
      return await callOpenAICompat("https://openrouter.ai/api/v1/chat/completions", openrouterKey, "google/gemma-4-31B-it:novita", messages);
    } catch (e) {
      lastError = e;
    }
  }
  if (groqKey) {
    try {
      return await callOpenAICompat("https://api.groq.com/openai/v1/chat/completions", groqKey, "llama-3.3-70b-versatile", messages);
    } catch (e) {
      lastError = e;
    }
  }
  if (cerebrasKey) {
    try {
      return await callOpenAICompat("https://api.cerebras.ai/v1/chat/completions", cerebrasKey, "llama-3.3-70b", messages);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("No API keys configured on server");
}

async function streamWithFallback(messages: object[], onToken: (t: string) => void) {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const cerebrasKey = Deno.env.get("CEREBRAS_API_KEY");

  let lastError: any;

  if (openrouterKey) {
    try {
      await callStreamOpenAICompat("https://openrouter.ai/api/v1/chat/completions", openrouterKey, "google/gemma-4-31B-it:novita", messages, onToken);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  if (groqKey) {
    try {
      await callStreamOpenAICompat("https://api.groq.com/openai/v1/chat/completions", groqKey, "llama-3.3-70b-versatile", messages, onToken);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  if (cerebrasKey) {
    try {
      await callStreamOpenAICompat("https://api.cerebras.ai/v1/chat/completions", cerebrasKey, "llama-3.3-70b", messages, onToken);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("No API keys configured on server");
}

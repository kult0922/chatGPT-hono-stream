import { Hono } from "hono";

const app = new Hono();

const API_KEY = "PLEASE_PUT_YOUR_API_KEY";

app.get("/", async (c) => {
  const apiEndpoint = "https://api.openai.com/v1/chat/completions";
  const headers = new Headers({
    accept: "text/event-stream",
    authorization: `Bearer ${API_KEY}`,
    "content-type": "application/json",
  });

  const body = JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "tell me a short story" }],
    stream: true,
  });

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers,
    body,
  });

  if (response.body === null) {
    throw new Error("No response body in 100 wrods");
  }

  let buffer = "";
  const stream = response.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const encoder = new TextEncoder();
        const lines = new TextDecoder().decode(chunk).split("\n\n");
        for (const line of lines) {
          if (line === "data: [DONE]") {
            controller.enqueue(encoder.encode(`[DONE]\n\n`));
            return;
          }

          const substr = line.replace(/^data: /, "");
          if (substr.startsWith("{")) {
            buffer = substr;
          } else {
            buffer += substr;
          }

          if (
            substr.length === 0 ||
            !buffer.startsWith("{") ||
            !buffer.endsWith("}")
          ) {
            continue;
          }

          try {
            const parsedLine = JSON.parse(buffer);
            const input = parsedLine.choices[0].delta.content;
            if (input) {
              controller.enqueue(encoder.encode(`${input}`));
            }
          } catch (e) {
            console.error("Parse Error: " + e);
          } finally {
            buffer = "";
          }
        }
      },
    })
  );
  return new Response(stream, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/event-stream;charset=utf-8",
    },
  });
});

export default app;

export default class EventSourcePolyfill {
  constructor(url, options) {
    this.controller = new AbortController();
    fetch(url, {
      ...options,
      signal: this.controller.signal,
    }).then(async (res) => {
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          if (part.startsWith("data:")) {
            this.onmessage?.({ data: part.slice(5).trim() });
          }
        }
      }
    });
  }
  close() {
    this.controller.abort();
  }
}

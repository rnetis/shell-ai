import { useShell } from "@/shell/store";

const CSP =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; script-src 'unsafe-inline';\">";

function bridge(appId: string) {
  return `(function(){
    var appId = ${JSON.stringify(appId)};
    var pending = new Map();
    function call(op, payload){
      return new Promise(function(resolve, reject){
        var id = Math.random().toString(36).slice(2);
        var timer = setTimeout(function(){ pending.delete(id); reject(new Error("timeout")); }, 150);
        pending.set(id, { resolve: resolve, timer: timer });
        parent.postMessage({ source: "shell-mini", type: "rpc", id: id, op: op, payload: payload, appId: appId }, "*");
      });
    }
    window.addEventListener("message", function(event){
      var data = event.data;
      if (!data || data.type !== "rpc-result" || data.appId !== appId) return;
      var item = pending.get(data.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(data.id);
      item.resolve(data.result);
    });
    window.shell = {
      storage: {
        get: function(k){ return call("get", { k: String(k) }); },
        set: function(k, v){ return call("set", { k: String(k), v: String(v) }); }
      },
      toast: function(message){
        parent.postMessage({ source: "shell-mini", type: "toast", appId: appId, message: String(message).slice(0, 140) }, "*");
      }
    };
  })();`;
}

export function prepareHtml(html: string, appId: string) {
  const inject = `${CSP}<script>${bridge(appId).replace(/<\/script/gi, "<\\/script")}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (match) => match + inject);
  return `<!DOCTYPE html><html><head>${inject}</head><body>${html}</body></html>`;
}

let listening = false;

export function ensureMiniBridge() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("message", (event) => {
    const data = event.data as {
      source?: string;
      type?: string;
      appId?: string;
      id?: string;
      op?: string;
      payload?: { k?: string; v?: string };
      message?: string;
    };
    if (!data || data.source !== "shell-mini" || !data.appId) return;
    if (data.type === "toast") {
      useShell.getState().pushToast(String(data.message ?? "Done"));
      return;
    }
    if (data.type !== "rpc" || !event.source) return;
    const appId = data.appId;
    const bag = { ...(useShell.getState().miniData[appId] ?? {}) };
    const key = String(data.payload?.k ?? "").slice(0, 64);
    let result: string | null = null;
    if (data.op === "get") result = bag[key] ?? null;
    if (data.op === "set" && key) {
      bag[key] = String(data.payload?.v ?? "").slice(0, 100_000);
      useShell.getState().setMiniBag(appId, bag);
    }
    (event.source as Window).postMessage({ type: "rpc-result", id: data.id, appId, result }, "*");
  });
}

export function MiniFrame({
  appId,
  html,
  title,
}: {
  appId: string;
  html: string;
  title: string;
}) {
  ensureMiniBridge();
  const doc = prepareHtml(html, appId);
  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={doc}
      className="h-full w-full border-0 bg-surface-2"
    />
  );
}

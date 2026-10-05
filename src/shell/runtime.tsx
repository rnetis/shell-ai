import { frameOwner, registerFrame } from "@/shell/frame-registry";
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

    // The frame is sandboxed without "allow-forms", and the browser refuses a
    // real submission *before* it dispatches the submit event — so an app's
    // onsubmit never runs, its input is dropped, and the console gets a
    // "Blocked form submission" error. Stand in for the browser instead:
    // swallow the native attempt, then hand the form a normal cancelable
    // submit event that the app's handler can preventDefault as usual.
    function dispatchSubmit(form, submitter){
      var event;
      try {
        event = new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: submitter || null });
      } catch (e) {
        event = new Event("submit", { bubbles: true, cancelable: true });
      }
      form.dispatchEvent(event);
    }
    document.addEventListener("click", function(event){
      if (event.defaultPrevented) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var control = target.closest("button, input[type=submit]");
      if (!control || !control.form) return;
      if (control.tagName === "BUTTON" && control.type !== "submit") return;
      event.preventDefault();
      dispatchSubmit(control.form, control);
    });
    document.addEventListener("keydown", function(event){
      if (event.key !== "Enter" || event.defaultPrevented) return;
      var target = event.target;
      // Enter in a textarea is a newline, and Enter on a button already fires
      // a click (handled above).
      if (!target || !target.form || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
      event.preventDefault();
      var submitter = target.form.querySelector("button[type=submit], button:not([type])");
      dispatchSubmit(target.form, submitter);
    });
  })();`;
}

function prepareHtml(html: string, appId: string) {
  const inject = `${CSP}<script>${bridge(appId).replace(/<\/script/gi, "<\\/script")}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (match) => match + inject);
  return `<!DOCTYPE html><html><head>${inject}</head><body>${html}</body></html>`;
}

let listening = false;

function ensureMiniBridge() {
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
    // srcdoc frames all share the origin "null", so the app id in the message
    // proves nothing on its own — only the registered frame may speak for it.
    if (frameOwner(event.source) !== data.appId) return;
    const source = event.source as Window;
    if (data.type === "toast") {
      useShell.getState().pushToast(String(data.message ?? "Done"));
      return;
    }
    if (data.type !== "rpc") return;
    const appId = data.appId;
    const bag = { ...(useShell.getState().miniData[appId] ?? {}) };
    const key = String(data.payload?.k ?? "").slice(0, 64);
    let result: string | null = null;
    if (data.op === "get") result = bag[key] ?? null;
    if (data.op === "set" && key) {
      bag[key] = String(data.payload?.v ?? "").slice(0, 100_000);
      useShell.getState().setMiniBag(appId, bag);
    }
    source.postMessage({ type: "rpc-result", id: data.id, appId, result }, "*");
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
      ref={(node) => registerFrame(node?.contentWindow, appId)}
      className="h-full w-full border-0 bg-surface-2"
    />
  );
}

// Runs in the page's main world. Patches XMLHttpRequest so Google Maps'
// own /search responses are forwarded to the content script via postMessage.
// `proto` is typed `any` because we are replacing overloaded native methods.
(function (proto: any) {
    const origOpen = proto.open;
    const origSend = proto.send;
    const xhrEvents = [
        "loadstart", "load", "loadend", "progress",
        "error", "abort", "timeout", "readystatechange",
    ];

    proto.open = function (this: XMLHttpRequest, method: string, url: string) {
        this._method = method;
        this._url = url;
        return origOpen.apply(this, arguments);
    };

    proto.send = function (this: XMLHttpRequest) {
        const args = arguments;
        xhrEvents.forEach((evt) => {
            this.addEventListener(evt, function (this: XMLHttpRequest) {
                if (typeof this._url === "string" &&
                    this._url.startsWith("/search") &&
                    this.readyState === 4) {
                    try {
                        window.postMessage({ type: "search", data: this.response }, "*");
                    } catch (err) {
                        console.error("Error posting XHR response:", err);
                    }
                }
            });
        });
        return origSend.apply(this, args);
    };
})(XMLHttpRequest.prototype);

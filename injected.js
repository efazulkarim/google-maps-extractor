(function (proto) {
    const origOpen = proto.open;
    const origSend = proto.send;
    const xhrEvents = [
        "loadstart", "load", "loadend", "progress",
        "error", "abort", "timeout", "readystatechange"
    ];

    proto.open = function (method, url) {
        this._method = method;
        this._url = url;
        return origOpen.apply(this, arguments);
    };

    proto.send = function (body) {
        xhrEvents.forEach((evt) => {
            this.addEventListener(evt, function () {
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
        return origSend.apply(this, arguments);
    };
})(XMLHttpRequest.prototype);

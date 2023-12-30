function createCopyButton(highlightDiv) {
    const button = document.createElement("button");
    button.className = "copy-code-button";
    button.type = "button";
    button.innerText = "Copy";
    button.addEventListener("click", () => copyCodeToClipboard(button, highlightDiv));
    highlightDiv.parentNode.before(button);
}

async function copyCodeToClipboard(button, highlightDiv) {
    let lastIndex = highlightDiv.innerText.length;
    if(highlightDiv.innerText[lastIndex - 1] === "\n") {
      lastIndex = highlightDiv.innerText.length - 1;
    }
    const codeToCopy = highlightDiv.innerText.slice(0, lastIndex);
    try {
        result = await navigator.permissions.query({ name: "clipboard-write" });
        if (result.state == "granted" || result.state == "prompt") {
            await navigator.clipboard.writeText(codeToCopy);
            codeWasCopied(button);
        } else {
            copyFail(button);
        }
    } catch (_) {
        copyFail(button);
    }
}

function codeWasCopied(button) {
    button.blur();
    button.innerText = "Copied!";
    setTimeout(function () {
        button.innerText = "Copy";
    }, 2000);
}

function copyFail(button) {
    button.blur();
    button.innerText = "Failed...";
    setTimeout(function () {
        button.innerText = "Copy";
    }, 5000);
}

document.querySelectorAll(".highlight-shell > .highlight").forEach((highlightDiv) => createCopyButton(highlightDiv));

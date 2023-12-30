function AddsNewtabAttribute(a) {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
}

document.querySelectorAll(".new_tab").forEach((a) => AddsNewtabAttribute(a));

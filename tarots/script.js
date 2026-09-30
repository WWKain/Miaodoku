"use strict";

const ARCANA = window.ARCANA_DATA || {};

function recolorInlineSvg(svg) {
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return svg;

    svg.style.setProperty("color", "var(--foreground)");
    svg.style.setProperty("fill", "var(--foreground)");

    // Neutralizza i fill/stroke dichiarati negli <style> interni dell'SVG.
    svg.querySelectorAll("style").forEach(style => {
        style.textContent = style.textContent
            .replace(/fill\s*:\s*(?!none\b)[^;}]+/gi, "fill:var(--foreground) !important")
            .replace(/stroke\s*:\s*(?!none\b)[^;}]+/gi, "stroke:var(--foreground) !important");
    });

    // Colora anche i path che non hanno alcun attributo fill: il default SVG è nero.
    const paintable = svg.querySelectorAll(
        "path, rect, circle, ellipse, polygon, polyline, line, use, text"
    );

    paintable.forEach(node => {
        const fill = (node.getAttribute("fill") || "").trim().toLowerCase();
        const stroke = (node.getAttribute("stroke") || "").trim().toLowerCase();
        const style = (node.getAttribute("style") || "");
        const inlineFillNone = /(?:^|;)\s*fill\s*:\s*none\b/i.test(style);
        const inlineStrokeNone = /(?:^|;)\s*stroke\s*:\s*none\b/i.test(style);

        if (fill !== "none" && !inlineFillNone) {
            node.style.setProperty("fill", "var(--foreground)", "important");
        }

        if (stroke && stroke !== "none" && !inlineStrokeNone) {
            node.style.setProperty("stroke", "var(--foreground)", "important");
        }
    });

    // Gestisce anche elementi/grouppi con fill o stroke ereditati.
    svg.querySelectorAll("[fill]").forEach(node => {
        if ((node.getAttribute("fill") || "").trim().toLowerCase() !== "none") {
            node.style.setProperty("fill", "var(--foreground)", "important");
        }
    });
    svg.querySelectorAll("[stroke]").forEach(node => {
        if ((node.getAttribute("stroke") || "").trim().toLowerCase() !== "none") {
            node.style.setProperty("stroke", "var(--foreground)", "important");
        }
    });

    const forceStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    forceStyle.textContent = `
        path, rect, circle, ellipse, polygon, polyline, line, use, text {
            fill: var(--foreground) !important;
        }
        [fill="none"] { fill: none !important; }
        [stroke="none"] { stroke: none !important; }
    `;
    svg.appendChild(forceStyle);

    return svg;
}

async function inlineSvgHost(host) {
    if (!host || host.dataset.svgInlined === "true") return host;

    const src = host.dataset.svg;
    if (!src) return host;

    try {
        const response = await fetch(src, { cache: "no-store" });
        if (!response.ok) throw new Error(`SVG HTTP ${response.status}`);

        const svgText = await response.text();
        const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
        const svg = doc.documentElement;

        if (!svg || svg.nodeName.toLowerCase() !== "svg") {
            throw new Error("SVG non valido");
        }

        // Copia le caratteristiche del contenitore sul vero SVG.
        if (host.className) svg.setAttribute("class", host.className);
        for (const name of ["id", "role", "aria-hidden", "aria-label"]) {
            const value = host.getAttribute(name);
            if (value !== null) svg.setAttribute(name, value);
        }

        // Mantieni intatte le dimensioni geometriche dell'SVG originale:
        // width, height e viewBox non vanno modificati durante l'inlining.
        svg.style.display = "block";
        svg.dataset.svgInlined = "true";

        // Trasferisce il nodo dal documento XML al documento della pagina.
        const imported = document.importNode(svg, true);

        // Le stelle sono un vero SVG inline, ma vengono trasformate in una
        // texture SVG ripetibile così da mantenere il comportamento del
        // vecchio background-repeat/background-size senza usare url() CSS.
        if (host.classList.contains("stars-background")) {
            const viewBox = (imported.getAttribute("viewBox") || "0 0 537 300.19").trim().split(/\s+/).map(Number);
            const tileWidth = viewBox[2] || 537;
            const tileHeight = viewBox[3] || 300.19;

            const backgroundSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            backgroundSvg.setAttribute("class", host.className);
            backgroundSvg.setAttribute("aria-hidden", "true");
            backgroundSvg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
            backgroundSvg.setAttribute("preserveAspectRatio", "none");
            backgroundSvg.style.display = "block";
            backgroundSvg.dataset.svgInlined = "true";

            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
            pattern.setAttribute("id", "stars-pattern");
            pattern.setAttribute("patternUnits", "userSpaceOnUse");
            pattern.setAttribute("width", String(tileWidth));
            pattern.setAttribute("height", String(tileHeight));

            imported.querySelectorAll(":scope > defs > *").forEach(node => {
                defs.appendChild(document.importNode(node, true));
            });

            imported.querySelectorAll(":scope > *:not(defs)").forEach(node => {
                pattern.appendChild(document.importNode(node, true));
            });

            defs.appendChild(pattern);
            backgroundSvg.appendChild(defs);

            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", "0");
            rect.setAttribute("y", "0");
            rect.setAttribute("width", String(window.innerWidth));
            rect.setAttribute("height", String(window.innerHeight));
            rect.setAttribute("fill", "url(#stars-pattern)");
            backgroundSvg.appendChild(rect);

            recolorInlineSvg(backgroundSvg);
            // Il rettangolo esterno deve mantenere il pattern, mentre gli elementi
            // contenuti nel pattern vengono colorati con --foreground.
            rect.style.setProperty("fill", "url(#stars-pattern)", "important");
            host.replaceWith(backgroundSvg);

            const resizeStars = () => {
                const width = window.innerWidth;
                const height = window.innerHeight;
                backgroundSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
                rect.setAttribute("width", String(width));
                rect.setAttribute("height", String(height));
            };
            window.addEventListener("resize", resizeStars, { passive: true });
            return backgroundSvg;
        }

        recolorInlineSvg(imported);
        host.replaceWith(imported);
        return imported;
    } catch (error) {
        console.error("Impossibile incorporare SVG:", src, error);
        return host;
    }
}

async function inlineStaticSvgs() {
    const hosts = document.querySelectorAll(".svg-host[data-svg]");
    await Promise.all([...hosts].map(inlineSvgHost));
}

const dateInput = document.getElementById("birth-date");
const dateDigits = document.querySelectorAll(".date-digit");
const dateError = document.getElementById("date-error");
let dateErrorTimer;

function showDateError(message) {
    dateError.textContent = message;
    dateError.classList.add("is-visible");
    clearTimeout(dateErrorTimer);
    dateErrorTimer = setTimeout(() => {
        dateError.classList.remove("is-visible");
    }, 2500);
}
const methodButtons = document.querySelectorAll(".method-button");
const modal = document.getElementById("arcana-modal");
const modalClose = document.getElementById("modal-close");
const modalOverlay = document.querySelector(".modal-overlay");
const arcanaTitle = document.getElementById("arcana-title");
const arcanaName = document.getElementById("arcana-name");
const arcanaText = document.getElementById("arcana-text");

function updateDateDigits(value) {
    dateDigits.forEach((digit, index) => {
        digit.textContent = value[index] || "";
    });
}

function updateCustomSelection() {
    const start = dateInput.selectionStart ?? 0;
    const end = dateInput.selectionEnd ?? start;
    dateDigits.forEach((d,i)=>d.classList.toggle("is-selected", i >= start && i < end));
}

function updateCustomCaret() {
    let caret = document.querySelector(".date-caret");
    if (!caret) {
        caret = document.createElement("span");
        caret.className = "date-caret";
        dateInput.parentElement.appendChild(caret);
    }
    const pos = dateInput.selectionStart ?? 0;
    const wrapper = dateInput.closest(".date-input-wrapper");
    const w = wrapper.clientWidth / 8;
    caret.style.left = `${pos * w + (w / 2)}px`;
    caret.style.top = "25%";
    caret.style.height = "50%";
    caret.style.display = dateInput === document.activeElement ? "block" : "none";
}


function formatDateInput(value) {
    return value.replace(/\D/g, "").slice(0, 8);
}

function fitDateText() {
    if (!dateInput) return;
    const wrapper = dateInput.closest(".date-input-wrapper");
    if (!wrapper) return;
    const width = wrapper.clientWidth;
    if (!width) return;
    const styles = getComputedStyle(dateInput);
    const canvas = fitDateText.canvas || (fitDateText.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    ctx.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    const digitWidth = ctx.measureText("0").width;
    if (!digitWidth) return;
    const target = width * 0.86;
    const current = digitWidth * 8;
    const size = parseFloat(styles.fontSize) * target / current;
    dateInput.style.fontSize = `${size}px`;
}

function parseDate(value) {
    const match = value.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return { day, month, year, date };
}

function getValidDate() {
    const parsed = parseDate(dateInput.value);
    if (!parsed) {
        showDateError("Inserisci una data valida.");
        return null;
    }
    dateError.textContent = "";
    return parsed;
}

function calculateByDigits(date) {
    const numbers = `${date.day}${date.month}${date.year}`;
    let total = 0;
    for (const digit of numbers) total += Number(digit);
    while (total > 21) {
        total = String(total).split("").reduce((sum, digit) => sum + Number(digit), 0);
    }
    return total;
}

function calculateByFullSum(date) {
    let total = date.day + date.month + date.year;
    while (total > 21) {
        total = String(total).split("").reduce((sum, digit) => sum + Number(digit), 0);
    }
    return total;
}

function calculateNumerological(date) {
    const reduceNumber = number => {
        let result = number;
        while (result > 9) {
            result = String(result).split("").reduce((sum, digit) => sum + Number(digit), 0);
        }
        return result;
    };
    return reduceNumber(reduceNumber(date.day) + reduceNumber(date.month) + reduceNumber(date.year));
}

function calculateArcana(date, method) {
    switch (method) {
        case "digit": return calculateByDigits(date);
        case "full": return calculateByFullSum(date);
        case "reduced": return calculateNumerological(date);
        default: throw new Error(`Metodo sconosciuto: ${method}`);
    }
}

async function showArcana(number) {
    const arcana = ARCANA[number];
    if (!arcana) return;

    arcanaTitle.textContent = `Arcano Maggiore ${arcana.roman}`;
    arcanaName.textContent = arcana.name;

    const host = document.createElement("div");
    host.id = "arcana-image";
    host.className = "arcana-image svg-host";
    host.dataset.svg = `res/tarots/${arcana.roman}.svg`;
    host.setAttribute("aria-hidden", "true");

    const container = document.querySelector(".arcana-image-container");
    const current = document.getElementById("arcana-image");
    if (current) current.replaceWith(host);

    await inlineSvgHost(host);

    arcanaText.textContent = arcana.description;
    modal.classList.toggle("is-long-description", arcana.description.length > 420);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modalClose.focus();
}

function closeArcana() {
    modal.classList.remove("is-open", "is-long-description");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

dateInput.addEventListener("input", event => {
    const input = event.target;
    const rawValue = input.value;
    const rawStart = input.selectionStart ?? rawValue.length;
    const digitPosition = rawValue.slice(0, rawStart).replace(/\D/g, "").length;
    const formatted = formatDateInput(rawValue);

    if (formatted !== rawValue) {
        input.value = formatted;
        const nextPosition = Math.min(digitPosition, formatted.length);
        input.setSelectionRange(nextPosition, nextPosition);
    }

    updateDateDigits(input.value);
    dateError.textContent = input.value.length === 8 ? (getValidDate() ? "" : "Inserisci una data valida.") : "";
    const date = parseDate(event.target.value);
    methodButtons.forEach(button => { button.disabled = !date; });
});

dateInput.addEventListener("keydown", event => {
    if (event.key === "Enter") methodButtons[0]?.focus();
});

methodButtons.forEach(button => {
    button.addEventListener("click", async () => {
        const date = getValidDate();
        if (!date) {
            dateInput.focus();
            return;
        }
        try {
            await showArcana(calculateArcana(date, button.dataset.method));
        } catch (error) {
            console.error(error);
            showDateError("Si è verificato un errore nel calcolo.");
        }
    });
    button.disabled = true;
});

modalClose.addEventListener("click", closeArcana);


updateDateDigits(dateInput.value);

["input","keyup","click","select","focus","blur"].forEach(e=>dateInput.addEventListener(e,()=>{updateCustomSelection();updateCustomCaret();}));
document.addEventListener("selectionchange",()=>{ if(document.activeElement===dateInput){updateCustomSelection();updateCustomCaret();}});

fitDateText();
window.addEventListener("resize", fitDateText);
if (window.ResizeObserver) {
    const dateWrapper = dateInput.closest(".date-input-wrapper");
    if (dateWrapper) new ResizeObserver(fitDateText).observe(dateWrapper);
}

inlineStaticSvgs();

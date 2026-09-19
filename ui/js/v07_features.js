"use strict";

// ===========================================================
// CVM 0.7 - HOME + MANUAL PDF PREVIEW + LATEX STUDIO
// ===========================================================

const CVM_V07_LATEX_DRAFT_KEY = "cvm-latex-studio-draft-v1";

const CVM_V07_TEXT = {
    en: {
        home_eyebrow: "CREATE YOUR WAY",
        home_title_main: "Build your CV",
        home_title_accent: "your way.",
        home_intro: "Choose the guided CV builder for fast, structured editing or open LaTeX Studio for complete code-level control.",
        easy_badge: "EASY STEPS",
        easy_title: "Create CV",
        easy_desc: "Guided fields, live HTML preview, ATS tools and one-click export.",
        latex_badge: "ADVANCED",
        latex_title: "Customize with LaTeX",
        latex_desc: "Edit raw LaTeX, recompile on demand and control every detail.",
        open_project: "Open project",
        demo_cv: "Try demo CV",
        home_flow_eyebrow: "CVM WORKFLOW",
        home_flow_title: "Fast when you want it. Flexible when you need it.",
        ready: "Ready",
        flow_one_title: "Create",
        flow_one_desc: "Use guided fields or write your own LaTeX.",
        flow_two_title: "Preview",
        flow_two_desc: "HTML stays instant. Exact PDF recompiles only when you ask.",
        flow_three_title: "Validate & export",
        flow_three_desc: "Check ATS readiness and generate clean PDF or DOCX files.",
        pdf_preview: "PDF preview",
        html_preview: "HTML preview",
        recompile: "Recompile",
        preview_stale: "CV changed. Recompile to update the exact PDF preview.",
        preview_not_compiled: "Exact PDF preview has not been compiled yet.",
        compiling: "Compiling exact PDF...",
        latex_studio: "LaTeX Studio",
        latex_subtitle: "Advanced manual CV editor",
        starter: "Starter template",
        copy_code: "Copy code",
        save_tex: "Save .tex",
        export_pdf: "Export PDF",
        close: "Close",
        source: "LATEX SOURCE",
        preview: "PDF PREVIEW",
        draft_saved: "Draft saved locally",
        not_compiled: "Not compiled",
        up_to_date: "Up to date",
        changed: "Changes detected",
        empty_title: "Ready when you are",
        empty_text: "Load the CVM starter template or write your own LaTeX, then click Recompile.",
        stale_banner: "Code changed. Recompile to see the latest PDF.",
        compile_failed: "LaTeX compilation failed",
        template_loaded: "Starter template loaded.",
        code_copied: "LaTeX code copied.",
        source_saved: "LaTeX source saved.",
        pdf_exported: "PDF exported successfully.",
        engine_missing: "No LaTeX engine detected",
        engine_ready: "LaTeX engine ready",
    },
    fr: {
        home_eyebrow: "CRÉEZ À VOTRE FAÇON",
        home_title_main: "Créez votre CV",
        home_title_accent: "à votre façon.",
        home_intro: "Utilisez l'éditeur guidé pour aller vite ou ouvrez LaTeX Studio pour un contrôle complet du code.",
        easy_badge: "ÉTAPES SIMPLES",
        easy_title: "Créer un CV",
        easy_desc: "Champs guidés, aperçu HTML instantané, outils ATS et export rapide.",
        latex_badge: "AVANCÉ",
        latex_title: "Personnaliser avec LaTeX",
        latex_desc: "Modifiez le LaTeX brut, recompilez à la demande et contrôlez chaque détail.",
        open_project: "Ouvrir un projet",
        demo_cv: "Essayer le CV démo",
        home_flow_eyebrow: "FLUX CVM",
        home_flow_title: "Rapide quand vous le voulez. Flexible quand vous en avez besoin.",
        ready: "Prêt",
        flow_one_title: "Créer",
        flow_one_desc: "Utilisez les champs guidés ou écrivez votre propre LaTeX.",
        flow_two_title: "Prévisualiser",
        flow_two_desc: "L'HTML reste instantané. Le PDF exact ne se recompile qu'à votre demande.",
        flow_three_title: "Valider et exporter",
        flow_three_desc: "Vérifiez l'ATS puis générez un PDF ou DOCX propre.",
        pdf_preview: "Aperçu PDF",
        html_preview: "Aperçu HTML",
        recompile: "Recompiler",
        preview_stale: "Le CV a changé. Recompilez pour mettre à jour l'aperçu PDF exact.",
        preview_not_compiled: "L'aperçu PDF exact n'a pas encore été compilé.",
        compiling: "Compilation du PDF exact...",
        latex_studio: "LaTeX Studio",
        latex_subtitle: "Éditeur manuel avancé de CV",
        starter: "Modèle de départ",
        copy_code: "Copier le code",
        save_tex: "Enregistrer .tex",
        export_pdf: "Exporter PDF",
        close: "Fermer",
        source: "SOURCE LATEX",
        preview: "APERÇU PDF",
        draft_saved: "Brouillon sauvegardé localement",
        not_compiled: "Non compilé",
        up_to_date: "À jour",
        changed: "Modifications détectées",
        empty_title: "Prêt quand vous l'êtes",
        empty_text: "Chargez le modèle CVM ou écrivez votre propre LaTeX, puis cliquez sur Recompiler.",
        stale_banner: "Le code a changé. Recompilez pour voir le dernier PDF.",
        compile_failed: "La compilation LaTeX a échoué",
        template_loaded: "Modèle de départ chargé.",
        code_copied: "Code LaTeX copié.",
        source_saved: "Source LaTeX enregistrée.",
        pdf_exported: "PDF exporté avec succès.",
        engine_missing: "Aucun moteur LaTeX détecté",
        engine_ready: "Moteur LaTeX prêt",
    },
};

const cvmV07 = {
    initialized: false,
    structuredPreviewInstalled: false,
    structuredPdfMode: false,
    structuredCompiledOnce: false,
    structuredStale: true,
    latexBuilt: false,
    latexCompiledOnce: false,
    latexStale: false,
    latexSaveTimer: null,
    latexLastCompiledSource: "",
};

function cvmV07Lang() {
    if (
        typeof cvmCurrentLanguage !== "undefined"
        && cvmCurrentLanguage === "fr"
    ) {
        return "fr";
    }

    return document.documentElement.lang === "fr"
        ? "fr"
        : "en";
}

function cvmV07Text(key) {
    const lang = cvmV07Lang();
    return CVM_V07_TEXT[lang]?.[key]
        || CVM_V07_TEXT.en[key]
        || key;
}

function cvmV07Api() {
    return window.pywebview?.api || null;
}

function cvmV07Toast(message, type = "info") {
    if (typeof showToast === "function") {
        showToast(message, type);
        return;
    }

    console.log(`[CVM ${type}] ${message}`);
}

function cvmV07Escape(value) {
    if (typeof escapeHtml === "function") {
        return escapeHtml(value);
    }

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function cvmV07ApplyHomeLanguage() {
    document
        .querySelectorAll("[data-v07-i18n]")
        .forEach((node) => {
            const key = node.dataset.v07I18n;
            if (key) {
                node.textContent = cvmV07Text(key);
            }
        });

    cvmV07RefreshStructuredPreviewLabels();
    cvmV07RefreshLatexLabels();
}

// ===========================================================
// STRUCTURED CV - MANUAL EXACT PDF PREVIEW
// ===========================================================

function cvmV07StructuredElements() {
    return {
        column: document.querySelector(".preview-column"),
        header: document.querySelector(".preview-column .preview-header"),
        html: document.querySelector(".preview-column .preview-scroll"),
        real: document.querySelector("#cvmRealPreview"),
        modeButton: document.querySelector("#cvmV07PreviewModeBtn"),
        compileButton: document.querySelector("#cvmV07RecompileBtn"),
        banner: document.querySelector("#cvmV07StructuredStale"),
    };
}

function cvmV07EnsureStructuredBanner() {
    const { column, real } = cvmV07StructuredElements();

    if (!column || !real) {
        return null;
    }

    let banner = document.querySelector("#cvmV07StructuredStale");

    if (!banner) {
        banner = document.createElement("div");
        banner.id = "cvmV07StructuredStale";
        banner.className = "cvm-v07-pdf-stale";
        banner.innerHTML = `
            <span id="cvmV07StructuredStaleText"></span>
            <button id="cvmV07StructuredBannerCompile" type="button"></button>
        `;
        column.insertBefore(banner, real);

        banner
            .querySelector("#cvmV07StructuredBannerCompile")
            ?.addEventListener("click", cvmV07CompileStructuredPreview);
    }

    return banner;
}

function cvmV07RefreshStructuredPreviewLabels() {
    const { modeButton, compileButton, banner } = cvmV07StructuredElements();

    if (modeButton) {
        modeButton.textContent = cvmV07.structuredPdfMode
            ? cvmV07Text("html_preview")
            : cvmV07Text("pdf_preview");
    }

    if (compileButton) {
        compileButton.textContent = cvmV07Text("recompile");
    }

    if (banner) {
        const text = banner.querySelector("#cvmV07StructuredStaleText");
        const action = banner.querySelector("#cvmV07StructuredBannerCompile");

        if (text) {
            text.textContent = cvmV07.structuredCompiledOnce
                ? cvmV07Text("preview_stale")
                : cvmV07Text("preview_not_compiled");
        }

        if (action) {
            action.textContent = cvmV07Text("recompile");
        }
    }
}

function cvmV07MarkStructuredPreviewStale() {
    cvmV07.structuredStale = true;

    const banner = cvmV07EnsureStructuredBanner();
    if (banner) {
        banner.classList.toggle(
            "visible",
            cvmV07.structuredPdfMode
        );
    }

    cvmV07RefreshStructuredPreviewLabels();
}

function cvmV07ShowStructuredEmpty() {
    const { real } = cvmV07StructuredElements();
    if (!real || cvmV07.structuredCompiledOnce) {
        return;
    }

    real.innerHTML = `
        <div class="cvm-v07-pdf-empty">
            <div>
                <strong>${cvmV07Escape(cvmV07Text("preview_not_compiled"))}</strong>
                <span>${cvmV07Escape(cvmV07Text("preview_stale"))}</span>
            </div>
        </div>
    `;
}

function cvmV07SetStructuredPreviewMode(pdfMode) {
    const { html, real, banner } = cvmV07StructuredElements();

    if (!html || !real) {
        return;
    }

    cvmV07.structuredPdfMode = Boolean(pdfMode);

    try {
        if (typeof cvmV05 !== "undefined") {
            cvmV05.realPreviewEnabled = cvmV07.structuredPdfMode;
        }
    }
    catch (_) {
    }

    html.style.display = cvmV07.structuredPdfMode
        ? "none"
        : "block";

    real.style.display = cvmV07.structuredPdfMode
        ? "block"
        : "none";

    real.classList.toggle(
        "active",
        cvmV07.structuredPdfMode
    );

    if (cvmV07.structuredPdfMode) {
        cvmV07ShowStructuredEmpty();
    }

    if (banner) {
        banner.classList.toggle(
            "visible",
            cvmV07.structuredPdfMode && cvmV07.structuredStale
        );
    }

    cvmV07RefreshStructuredPreviewLabels();
}

async function cvmV07CompileStructuredPreview() {
    if (typeof cvmV05RenderRealPreview !== "function") {
        return;
    }

    const { real, compileButton } = cvmV07StructuredElements();
    if (!real) {
        return;
    }

    cvmV07SetStructuredPreviewMode(true);

    if (compileButton) {
        compileButton.disabled = true;
        compileButton.textContent = cvmV07Text("compiling");
    }

    const banner = cvmV07EnsureStructuredBanner();
    banner?.classList.remove("visible");

    try {
        await cvmV05RenderRealPreview();

        const success = Boolean(
            real.querySelector(".cvm-real-preview-page")
        );

        if (success) {
            cvmV07.structuredCompiledOnce = true;
            cvmV07.structuredStale = false;
        }
        else {
            cvmV07.structuredStale = true;
        }
    }
    catch (error) {
        console.error(error);
        cvmV07.structuredStale = true;
    }
    finally {
        if (compileButton) {
            compileButton.disabled = false;
        }

        cvmV07RefreshStructuredPreviewLabels();

        if (banner) {
            banner.classList.toggle(
                "visible",
                cvmV07.structuredStale
            );
        }
    }
}

function cvmV07InstallManualPdfPreview() {
    if (cvmV07.structuredPreviewInstalled) {
        return true;
    }

    const column = document.querySelector(".preview-column");
    const header = column?.querySelector(".preview-header");
    const html = column?.querySelector(".preview-scroll");
    const real = document.querySelector("#cvmRealPreview");
    const oldToggle = document.querySelector("#cvmPreviewModeBtn");

    if (!column || !header || !html || !real || !oldToggle) {
        return false;
    }

    try {
        if (typeof cvmV05 !== "undefined") {
            clearTimeout(cvmV05.previewTimer);
            cvmV05.previewTimer = null;
            cvmV05.realPreviewEnabled = false;
        }
    }
    catch (_) {
    }

    if (typeof cvmV05ScheduleRealPreview === "function") {
        cvmV05ScheduleRealPreview = function () {
            cvmV07MarkStructuredPreviewStale();
        };
    }

    const freshToggle = oldToggle.cloneNode(true);
    freshToggle.id = "cvmV07PreviewModeBtn";
    freshToggle.className = "cvm-v07-preview-button";
    oldToggle.replaceWith(freshToggle);

    const actions = document.createElement("div");
    actions.className = "cvm-v07-preview-actions";

    const recompile = document.createElement("button");
    recompile.id = "cvmV07RecompileBtn";
    recompile.type = "button";
    recompile.className = "cvm-v07-preview-button primary";

    actions.append(
        freshToggle,
        recompile
    );

    header.appendChild(actions);

    freshToggle.addEventListener(
        "click",
        () => cvmV07SetStructuredPreviewMode(
            !cvmV07.structuredPdfMode
        )
    );

    recompile.addEventListener(
        "click",
        cvmV07CompileStructuredPreview
    );

    cvmV07EnsureStructuredBanner();
    cvmV07.structuredPreviewInstalled = true;
    cvmV07.structuredStale = true;
    cvmV07SetStructuredPreviewMode(false);
    cvmV07RefreshStructuredPreviewLabels();

    return true;
}

function cvmV07RetryManualPreviewInstall() {
    let attempts = 0;

    const timer = window.setInterval(
        () => {
            attempts += 1;

            if (
                cvmV07InstallManualPdfPreview()
                || attempts >= 40
            ) {
                window.clearInterval(timer);
            }
        },
        100
    );
}

// ===========================================================
// LATEX STUDIO
// ===========================================================

function cvmV07BuildLatexOverlay() {
    if (cvmV07.latexBuilt) {
        return;
    }

    const overlay = document.createElement("section");
    overlay.id = "cvmLatexOverlay";
    overlay.className = "cvm-latex-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
        <div class="cvm-latex-shell">
            <header class="cvm-latex-toolbar">
                <div class="cvm-latex-brand">
                    <span class="cvm-latex-brand-icon">TeX</span>
                    <span class="cvm-latex-brand-copy">
                        <strong id="cvmLatexStudioTitle"></strong>
                        <small id="cvmLatexStudioSubtitle"></small>
                    </span>
                </div>

                <button id="cvmLatexStarterBtn" class="cvm-latex-button" type="button"></button>
                <button id="cvmLatexCopyBtn" class="cvm-latex-button" type="button"></button>
                <button id="cvmLatexSaveBtn" class="cvm-latex-button" type="button"></button>

                <div class="cvm-latex-toolbar-spacer"></div>

                <button id="cvmLatexCompileBtn" class="cvm-latex-button primary" type="button"></button>
                <button id="cvmLatexExportBtn" class="cvm-latex-button success" type="button"></button>
                <button id="cvmLatexCloseBtn" class="cvm-latex-button danger-quiet" type="button"></button>
            </header>

            <div class="cvm-latex-workspace">
                <section class="cvm-latex-editor-pane">
                    <div class="cvm-latex-pane-header">
                        <strong id="cvmLatexSourceLabel"></strong>
                        <span id="cvmLatexEditorStatus" class="cvm-latex-editor-status"></span>
                    </div>

                    <div class="cvm-latex-editor-wrap">
                        <div id="cvmLatexLineNumbers" class="cvm-latex-line-numbers" aria-hidden="true">1</div>
                        <textarea id="cvmLatexEditor" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="LaTeX source"></textarea>
                    </div>

                    <div class="cvm-latex-editor-footer">
                        <span id="cvmLatexEngineStatus"></span>
                        <span>Ctrl+Enter = Recompile · Ctrl+S = Save .tex</span>
                    </div>
                </section>

                <section class="cvm-latex-preview-pane">
                    <div class="cvm-latex-preview-header">
                        <strong id="cvmLatexPreviewLabel"></strong>
                        <span id="cvmLatexPreviewState" class="cvm-latex-preview-state"></span>
                    </div>

                    <div id="cvmLatexPreviewScroll" class="cvm-latex-preview-scroll">
                        <div id="cvmLatexStaleBanner" class="cvm-latex-stale-banner">
                            <span id="cvmLatexStaleText"></span>
                            <button id="cvmLatexBannerCompile" class="cvm-latex-button primary" type="button"></button>
                        </div>
                        <div id="cvmLatexPreviewContent" class="cvm-latex-preview-pages"></div>
                    </div>

                    <div id="cvmLatexCompileOverlay" class="cvm-latex-compile-overlay">
                        <div class="cvm-latex-compile-card">
                            <strong id="cvmLatexCompileText"></strong>
                            <small>LaTeX → PDF → preview</small>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    cvmV07.latexBuilt = true;

    const editor = document.querySelector("#cvmLatexEditor");
    const lines = document.querySelector("#cvmLatexLineNumbers");

    editor?.addEventListener("input", () => {
        cvmV07UpdateLatexLineNumbers();
        cvmV07MarkLatexStale();
        cvmV07ScheduleLatexDraftSave();
    });

    editor?.addEventListener("scroll", () => {
        if (lines) {
            lines.scrollTop = editor.scrollTop;
        }
    });

    editor?.addEventListener("keydown", cvmV07LatexEditorKeydown);

    document
        .querySelector("#cvmLatexStarterBtn")
        ?.addEventListener("click", cvmV07LoadStarterTemplate);

    document
        .querySelector("#cvmLatexCopyBtn")
        ?.addEventListener("click", cvmV07CopyLatexCode);

    document
        .querySelector("#cvmLatexSaveBtn")
        ?.addEventListener("click", cvmV07SaveLatexSource);

    document
        .querySelector("#cvmLatexCompileBtn")
        ?.addEventListener("click", cvmV07CompileLatex);

    document
        .querySelector("#cvmLatexBannerCompile")
        ?.addEventListener("click", cvmV07CompileLatex);

    document
        .querySelector("#cvmLatexExportBtn")
        ?.addEventListener("click", cvmV07ExportLatexPdf);

    document
        .querySelector("#cvmLatexCloseBtn")
        ?.addEventListener("click", cvmV07CloseLatexStudio);

    cvmV07RestoreLatexDraft();
    cvmV07RenderLatexEmpty();
    cvmV07RefreshLatexLabels();
}

function cvmV07RefreshLatexLabels() {
    if (!cvmV07.latexBuilt) {
        return;
    }

    const pairs = {
        cvmLatexStudioTitle: "latex_studio",
        cvmLatexStudioSubtitle: "latex_subtitle",
        cvmLatexStarterBtn: "starter",
        cvmLatexCopyBtn: "copy_code",
        cvmLatexSaveBtn: "save_tex",
        cvmLatexCompileBtn: "recompile",
        cvmLatexExportBtn: "export_pdf",
        cvmLatexCloseBtn: "close",
        cvmLatexSourceLabel: "source",
        cvmLatexPreviewLabel: "preview",
        cvmLatexStaleText: "stale_banner",
        cvmLatexBannerCompile: "recompile",
        cvmLatexCompileText: "compiling",
    };

    for (const [id, key] of Object.entries(pairs)) {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = cvmV07Text(key);
        }
    }

    cvmV07RefreshLatexStateLabel();
}

function cvmV07UpdateLatexLineNumbers() {
    const editor = document.querySelector("#cvmLatexEditor");
    const lines = document.querySelector("#cvmLatexLineNumbers");

    if (!editor || !lines) {
        return;
    }

    const count = Math.max(
        1,
        editor.value.split("\n").length
    );

    lines.textContent = Array.from(
        { length: count },
        (_, index) => String(index + 1)
    ).join("\n");

    lines.scrollTop = editor.scrollTop;
}

function cvmV07ScheduleLatexDraftSave() {
    window.clearTimeout(cvmV07.latexSaveTimer);

    cvmV07.latexSaveTimer = window.setTimeout(
        () => {
            const source = document.querySelector("#cvmLatexEditor")?.value || "";
            try {
                localStorage.setItem(
                    CVM_V07_LATEX_DRAFT_KEY,
                    source
                );
            }
            catch (_) {
            }

            const status = document.querySelector("#cvmLatexEditorStatus");
            if (status) {
                status.textContent = cvmV07Text("draft_saved");
            }
        },
        350
    );
}

function cvmV07RestoreLatexDraft() {
    const editor = document.querySelector("#cvmLatexEditor");
    if (!editor) {
        return;
    }

    try {
        const saved = localStorage.getItem(
            CVM_V07_LATEX_DRAFT_KEY
        );

        if (saved) {
            editor.value = saved;
        }
    }
    catch (_) {
    }

    cvmV07UpdateLatexLineNumbers();
}

function cvmV07MarkLatexStale() {
    const source = document.querySelector("#cvmLatexEditor")?.value || "";

    if (!cvmV07.latexCompiledOnce) {
        cvmV07.latexStale = false;
    }
    else {
        cvmV07.latexStale = (
            source !== cvmV07.latexLastCompiledSource
        );
    }

    const banner = document.querySelector("#cvmLatexStaleBanner");
    banner?.classList.toggle(
        "visible",
        cvmV07.latexStale
    );

    cvmV07RefreshLatexStateLabel();
}

function cvmV07RefreshLatexStateLabel() {
    const badge = document.querySelector("#cvmLatexPreviewState");
    if (!badge) {
        return;
    }

    badge.classList.remove("clean", "stale");

    if (!cvmV07.latexCompiledOnce) {
        badge.textContent = cvmV07Text("not_compiled");
        return;
    }

    if (cvmV07.latexStale) {
        badge.classList.add("stale");
        badge.textContent = cvmV07Text("changed");
        return;
    }

    badge.classList.add("clean");
    badge.textContent = cvmV07Text("up_to_date");
}

function cvmV07RenderLatexEmpty() {
    const host = document.querySelector("#cvmLatexPreviewContent");
    if (!host || cvmV07.latexCompiledOnce) {
        return;
    }

    host.innerHTML = `
        <div class="cvm-latex-empty">
            <div class="cvm-latex-empty-card">
                <strong>${cvmV07Escape(cvmV07Text("empty_title"))}</strong>
                <span>${cvmV07Escape(cvmV07Text("empty_text"))}</span>
            </div>
        </div>
    `;
}

function cvmV07RenderLatexPages(pages) {
    const host = document.querySelector("#cvmLatexPreviewContent");
    if (!host) {
        return;
    }

    host.innerHTML = `
        ${(pages || [])
            .map(
                (page) => `
                    <img
                        class="cvm-latex-preview-page"
                        src="${cvmV07Escape(page.data_uri)}"
                        alt="PDF page ${Number(page.page) || 1}"
                    >
                `
            )
            .join("")}
    `;
}

function cvmV07RenderLatexError(result) {
    const host = document.querySelector("#cvmLatexPreviewContent");
    if (!host) {
        return;
    }

    const technical = String(
        result?.technical_output || ""
    ).slice(-6000);

    host.innerHTML = `
        <div class="cvm-latex-error">
            <strong>${cvmV07Escape(cvmV07Text("compile_failed"))}</strong>
            <span>${cvmV07Escape(result?.message || "LaTeX compilation failed.")}</span>
            ${technical
                ? `<pre>${cvmV07Escape(technical)}</pre>`
                : ""}
        </div>
    `;
}

async function cvmV07RefreshLatexEngine() {
    const label = document.querySelector("#cvmLatexEngineStatus");
    const api = cvmV07Api();

    if (!label || !api?.get_latex_workspace_state) {
        return;
    }

    try {
        const state = await api.get_latex_workspace_state();
        label.textContent = state?.available
            ? `${cvmV07Text("engine_ready")}: ${state.engine || "LaTeX"}`
            : cvmV07Text("engine_missing");
    }
    catch (_) {
        label.textContent = cvmV07Text("engine_missing");
    }
}

async function cvmV07OpenLatexStudio() {
    cvmV07BuildLatexOverlay();

    const overlay = document.querySelector("#cvmLatexOverlay");
    if (!overlay) {
        return;
    }

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    cvmV07RefreshLatexLabels();
    cvmV07UpdateLatexLineNumbers();
    cvmV07RenderLatexEmpty();
    await cvmV07RefreshLatexEngine();

    window.setTimeout(
        () => document.querySelector("#cvmLatexEditor")?.focus(),
        0
    );
}

function cvmV07CloseLatexStudio() {
    const overlay = document.querySelector("#cvmLatexOverlay");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
}

async function cvmV07LoadStarterTemplate() {
    const api = cvmV07Api();
    const editor = document.querySelector("#cvmLatexEditor");

    if (!api?.get_latex_starter_template || !editor) {
        return;
    }

    if (
        editor.value.trim()
        && !window.confirm(
            cvmV07Lang() === "fr"
                ? "Remplacer le code actuel par le modèle CVM ?"
                : "Replace the current code with the CVM starter template?"
        )
    ) {
        return;
    }

    const result = await api.get_latex_starter_template();

    if (!result?.ok) {
        cvmV07Toast(
            result?.message || "Unable to load starter template.",
            "error"
        );
        return;
    }

    editor.value = result.source || "";
    cvmV07UpdateLatexLineNumbers();
    cvmV07MarkLatexStale();
    cvmV07ScheduleLatexDraftSave();
    cvmV07Toast(cvmV07Text("template_loaded"), "success");
}

async function cvmV07CopyLatexCode() {
    const source = document.querySelector("#cvmLatexEditor")?.value || "";

    if (!source.trim()) {
        return;
    }

    try {
        await navigator.clipboard.writeText(source);
        cvmV07Toast(cvmV07Text("code_copied"), "success");
    }
    catch (_) {
        cvmV07Toast("Clipboard access is unavailable.", "warning");
    }
}

function cvmV07SetLatexBusy(busy) {
    const overlay = document.querySelector("#cvmLatexCompileOverlay");
    const compile = document.querySelector("#cvmLatexCompileBtn");
    const exportButton = document.querySelector("#cvmLatexExportBtn");

    overlay?.classList.toggle("visible", Boolean(busy));

    if (compile) {
        compile.disabled = Boolean(busy);
    }

    if (exportButton) {
        exportButton.disabled = Boolean(busy);
    }
}

async function cvmV07CompileLatex() {
    const api = cvmV07Api();
    const editor = document.querySelector("#cvmLatexEditor");
    const source = editor?.value || "";

    if (!api?.compile_latex_preview || !source.trim()) {
        return;
    }

    cvmV07SetLatexBusy(true);

    try {
        const result = await api.compile_latex_preview(source);

        if (!result?.ok) {
            cvmV07RenderLatexError(result);
            return;
        }

        cvmV07RenderLatexPages(result.pages || []);
        cvmV07.latexCompiledOnce = true;
        cvmV07.latexLastCompiledSource = source;
        cvmV07.latexStale = false;

        document
            .querySelector("#cvmLatexStaleBanner")
            ?.classList.remove("visible");

        cvmV07RefreshLatexStateLabel();
    }
    catch (error) {
        console.error(error);
        cvmV07RenderLatexError({
            message: String(error),
        });
    }
    finally {
        cvmV07SetLatexBusy(false);
    }
}

async function cvmV07ChooseFilename({
    extension,
    defaultName,
    title,
    callback,
}) {
    if (typeof cvmOpenBrowser !== "function") {
        cvmV07Toast("Folder browser is unavailable.", "error");
        return;
    }

    await cvmOpenBrowser(
        "folder",
        "",
        async (folder) => {
            let name = defaultName;

            if (typeof cvmV05TextInputModal === "function") {
                name = await cvmV05TextInputModal({
                    id: `cvmV07Filename${extension.replace(".", "")}`,
                    eyebrow: "LATEX STUDIO",
                    title,
                    label: cvmV07Lang() === "fr" ? "Nom du fichier" : "File name",
                    value: defaultName,
                    confirmLabel: cvmV07Lang() === "fr" ? "Enregistrer" : "Save",
                });
            }
            else {
                name = window.prompt(title, defaultName);
            }

            if (!name) {
                return;
            }

            await callback(folder, name);
        }
    );
}

async function cvmV07SaveLatexSource() {
    const api = cvmV07Api();
    const source = document.querySelector("#cvmLatexEditor")?.value || "";

    if (!api?.save_latex_source || !source.trim()) {
        return;
    }

    await cvmV07ChooseFilename({
        extension: ".tex",
        defaultName: "custom_cv.tex",
        title: cvmV07Lang() === "fr"
            ? "Enregistrer la source LaTeX"
            : "Save LaTeX source",
        callback: async (folder, name) => {
            const result = await api.save_latex_source(
                source,
                folder,
                name
            );

            if (!result?.ok) {
                cvmV07Toast(
                    result?.message || "Unable to save LaTeX source.",
                    "error"
                );
                return;
            }

            cvmV07Toast(cvmV07Text("source_saved"), "success");
        },
    });
}

async function cvmV07ExportLatexPdf() {
    const api = cvmV07Api();
    const source = document.querySelector("#cvmLatexEditor")?.value || "";

    if (!api?.export_latex_pdf || !source.trim()) {
        return;
    }

    await cvmV07ChooseFilename({
        extension: ".pdf",
        defaultName: "custom_cv.pdf",
        title: cvmV07Lang() === "fr"
            ? "Exporter le PDF LaTeX"
            : "Export LaTeX PDF",
        callback: async (folder, name) => {
            cvmV07SetLatexBusy(true);

            try {
                const result = await api.export_latex_pdf(
                    source,
                    folder,
                    name
                );

                if (!result?.ok) {
                    cvmV07RenderLatexError(result);
                    cvmV07Toast(
                        result?.message || "PDF export failed.",
                        "error"
                    );
                    return;
                }

                cvmV07RenderLatexPages(result.pages || []);
                cvmV07.latexCompiledOnce = true;
                cvmV07.latexLastCompiledSource = source;
                cvmV07.latexStale = false;
                document
                    .querySelector("#cvmLatexStaleBanner")
                    ?.classList.remove("visible");
                cvmV07RefreshLatexStateLabel();
                cvmV07Toast(cvmV07Text("pdf_exported"), "success");
            }
            finally {
                cvmV07SetLatexBusy(false);
            }
        },
    });
}

function cvmV07LatexEditorKeydown(event) {
    const editor = event.currentTarget;

    if (event.key === "Tab") {
        event.preventDefault();

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.setRangeText(
            "    ",
            start,
            end,
            "end"
        );

        editor.dispatchEvent(
            new Event("input", { bubbles: true })
        );
        return;
    }

    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key === "Enter") {
        event.preventDefault();
        cvmV07CompileLatex();
        return;
    }

    if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        cvmV07SaveLatexSource();
    }
}

function cvmV07InstallLatexHomeButton() {
    document
        .querySelector("#cvmLatexHomeBtn")
        ?.addEventListener(
            "click",
            cvmV07OpenLatexStudio
        );
}

// ===========================================================
// START
// ===========================================================

function cvmV07Init() {
    if (cvmV07.initialized) {
        return;
    }

    cvmV07.initialized = true;
    cvmV07BuildLatexOverlay();
    cvmV07InstallLatexHomeButton();
    cvmV07ApplyHomeLanguage();
    cvmV07RetryManualPreviewInstall();

    document.addEventListener(
        "click",
        (event) => {
            if (
                event.target.closest?.("[data-cvm-language]")
                || event.target.closest?.("[data-cvm-lang]")
                || event.target.closest?.(".cvm-language-switch button")
            ) {
                window.setTimeout(
                    cvmV07ApplyHomeLanguage,
                    40
                );
            }
        }
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Escape"
                && document
                    .querySelector("#cvmLatexOverlay")
                    ?.classList.contains("open")
            ) {
                cvmV07CloseLatexStudio();
            }
        }
    );
}

document.addEventListener(
    "DOMContentLoaded",
    () => window.setTimeout(cvmV07Init, 280)
);

window.addEventListener(
    "pywebviewready",
    () => window.setTimeout(cvmV07Init, 320)
);
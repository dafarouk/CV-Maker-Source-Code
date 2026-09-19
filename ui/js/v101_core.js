"use strict";

// ===========================================================
// CVM v1.0.1 - CONSOLIDATED PRODUCT CHANGES
// ===========================================================

const cvmV101 = {
    atsFile: null,
    finalShowPagePatched: false,
    resumeEditorAvailable: false,
};

function cvmV101Api() {
    return window.pywebview?.api || null;
}

function cvmV101Toast(message, type = "info") {
    if (typeof showToast === "function") {
        showToast(message, type);
        return;
    }

    if (typeof cvmV06ShowToast === "function") {
        cvmV06ShowToast(message, type);
        return;
    }

    console.log(`[CVM ${type}] ${message}`);
}

function cvmV101Escape(value) {
    if (typeof escapeHtml === "function") {
        return escapeHtml(value);
    }

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// ===========================================================
// PERMANENT DARK MODE
// ===========================================================

function cvmV101EnforceDarkTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("cvm-theme", "dark");

    try {
        if (typeof state !== "undefined" && state) {
            state.theme = "dark";
        }
    }
    catch (_) {
    }
}

if (typeof getSavedTheme === "function") {
    getSavedTheme = function () {
        return "dark";
    };
}

if (typeof applyTheme === "function") {
    applyTheme = function () {
        cvmV101EnforceDarkTheme();
    };
}

if (typeof toggleTheme === "function") {
    toggleTheme = function () {
        cvmV101EnforceDarkTheme();
    };
}

cvmV101EnforceDarkTheme();

// ===========================================================
// PAGE / SIDEBAR STATE
// ===========================================================

function cvmV101ManagerButton(pageName) {
    if (pageName === "recent-manager") {
        return document.querySelector("#openRecentBtn");
    }

    if (pageName === "exports-manager") {
        return document.querySelector("#openExportsBtn");
    }

    if (pageName === "logs-manager") {
        return document.querySelector("#openLogsBtn");
    }

    return null;
}

function cvmV101ClearManagerState() {
    document
        .querySelectorAll(
            "#page-recent-manager, #page-exports-manager, #page-logs-manager"
        )
        .forEach((page) => page.classList.remove("active"));

    document
        .querySelectorAll(
            "#openRecentBtn, #openExportsBtn, #openLogsBtn"
        )
        .forEach((button) => button.classList.remove("active"));
}

function cvmV101ShowManagerPage(pageName) {
    document
        .querySelectorAll(".main-content > .page")
        .forEach((page) => page.classList.remove("active"));

    document
        .querySelector(`#page-${pageName}`)
        ?.classList.add("active");

    document
        .querySelectorAll(".nav-item")
        .forEach((button) => button.classList.remove("active"));

    cvmV101ManagerButton(pageName)
        ?.classList.add("active");

    try {
        if (typeof state !== "undefined" && state) {
            state.currentPage = pageName;
        }
    }
    catch (_) {
    }
}

if (typeof cvmV06ShowMainPage === "function") {
    const cvmV101BaseShowMainPage = cvmV06ShowMainPage;

    cvmV06ShowMainPage = function (pageName) {
        if (
            pageName === "recent-manager"
            || pageName === "exports-manager"
            || pageName === "logs-manager"
        ) {
            cvmV101ShowManagerPage(pageName);
            return;
        }

        cvmV101ClearManagerState();
        return cvmV101BaseShowMainPage(pageName);
    };
}

function cvmV101InstallFinalShowPagePatch() {
    if (
        cvmV101.finalShowPagePatched
        || typeof showPage !== "function"
    ) {
        return;
    }

    const baseShowPage = showPage;

    showPage = function (pageName) {
        cvmV101ClearManagerState();

        const result = baseShowPage(pageName);

        setTimeout(() => {
            if (
                pageName !== "content"
                && pageName !== "design"
            ) {
                document
                    .querySelectorAll(".nav-item")
                    .forEach((button) => {
                        const active =
                            button.dataset?.page === pageName;

                        if (button.dataset?.page) {
                            button.classList.toggle(
                                "active",
                                active
                            );
                        }
                    });
            }
        }, 0);

        return result;
    };

    window.showPage = showPage;
    cvmV101.finalShowPagePatched = true;
}

async function cvmV101RefreshRecents() {
    if (typeof cvmV05RefreshRecents === "function") {
        await cvmV05RefreshRecents();
        return;
    }

    const host =
        document.querySelector("#cvmRecentProjectCards");

    const api =
        cvmV101Api();

    if (
        !host
        || !api?.get_recent_projects
    ) {
        return;
    }

    const response =
        await api.get_recent_projects();

    const items =
        response?.items || [];

    host.innerHTML =
        items.length
            ? items
                .map((item) => `
                    <article class="cvm-recent-card">

                        <strong>
                            ${cvmV101Escape(
                                item.title
                                || item.name
                                || "CV Project"
                            )}
                        </strong>

                        <span>
                            ${cvmV101Escape(
                                item.person
                                || ""
                            )}
                        </span>

                        <small>
                            ${cvmV101Escape(
                                item.modified_at
                                || ""
                            )}
                        </small>

                        <button
                            class="cvm-v05-button"
                            type="button"
                            data-v05-recent-open="${cvmV101Escape(
                                item.path
                                || ""
                            )}"
                        >
                            Open
                        </button>

                    </article>
                `)
                .join("")

            : "<p>No recent project yet.</p>";
}

function cvmV101WireRecentProjects() {
    const button =
        document.querySelector("#openRecentBtn");

    if (
        button
        && !button.dataset.v101Bound
    ) {
        button.dataset.v101Bound =
            "true";

        button.addEventListener(
            "click",
            async () => {
                cvmV101ShowManagerPage(
                    "recent-manager"
                );

                await cvmV101RefreshRecents();
            }
        );
    }

    const refresh =
        document.querySelector(
            "#cvmV101RefreshRecents"
        );

    if (
        refresh
        && !refresh.dataset.v101Bound
    ) {
        refresh.dataset.v101Bound =
            "true";

        refresh.addEventListener(
            "click",
            cvmV101RefreshRecents
        );
    }
}

// ===========================================================
// SUPPORT BUTTON: MODAL FIRST, NEVER DIRECT PAYPAL
// ===========================================================

if (typeof cvmV05WireDonation === "function") {
    cvmV05WireDonation =
        async function () {

            const link =
                document.querySelector(
                    "#cvmSupportDonateLink"
                );

            if (link) {
                link.href =
                    "https://paypal.me/BigBossManTN";

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";

                link.textContent =
                    "PayPal";

                link.removeAttribute(
                    "aria-disabled"
                );

                link.classList.remove(
                    "cvm-support-coming-soon"
                );
            }

            if (
                typeof cvmV072EnhanceSupport
                === "function"
            ) {
                cvmV072EnhanceSupport();
            }
        };
}

function cvmV101FixSupportButton() {
    const oldButton =
        document.querySelector(
            "#cvmDonationBtn"
        );

    if (
        !oldButton
        || oldButton.dataset
            .v101SupportReady
            === "true"
    ) {
        return;
    }

    const button =
        oldButton.cloneNode(
            true
        );

    button.dataset.v101SupportReady =
        "true";

    oldButton.replaceWith(
        button
    );

    button.addEventListener(
        "click",
        (event) => {

            event.preventDefault();
            event.stopPropagation();

            if (
                typeof cvmRefreshDonationModalText
                === "function"
            ) {
                cvmRefreshDonationModalText();
            }

            if (
                typeof cvmV072EnhanceSupport
                === "function"
            ) {
                cvmV072EnhanceSupport();
            }

            const cancel =
                document.querySelector(
                    "#cvmSupportClose"
                );

            if (cancel) {
                cancel.textContent =
                    "Cancel";
            }

            if (
                typeof cvmShowModal
                === "function"
            ) {
                cvmShowModal(
                    "cvmSupportModal"
                );
            }
        }
    );
}

// ===========================================================
// ATS: USER SELECTS PDF / DOCX FIRST
// ===========================================================

function cvmV101UpdateAtsUi() {
    const selected =
        document.querySelector(
            "#cvmAtsSelectedFile"
        );

    const run =
        document.querySelector(
            "#runAtsBtn"
        );

    const card =
        document.querySelector(
            ".cvm-v101-ats-upload-card"
        );

    if (selected) {
        selected.textContent =
            cvmV101.atsFile?.name
            || "No file selected";

        selected.title =
            cvmV101.atsFile?.path
            || "";
    }

    if (run) {
        run.disabled =
            !cvmV101.atsFile?.path;
    }

    card?.classList.toggle(
        "has-file",
        Boolean(
            cvmV101.atsFile?.path
        )
    );
}

async function cvmV101ChooseAtsFile() {
    const api =
        cvmV101Api();

    if (
        !api?.select_ats_file
    ) {
        cvmV101Toast(
            "ATS file selection is not available yet.",
            "error"
        );

        return;
    }

    const response =
        await api.select_ats_file();

    if (
        response?.cancelled
    ) {
        return;
    }

    if (
        !response?.ok
    ) {
        cvmV101Toast(
            response?.message
            || "Unable to select this CV file.",
            "error"
        );

        return;
    }

    cvmV101.atsFile = {
        path:
            response.path,

        name:
            response.name,

        extension:
            response.extension,

        sizeBytes:
            response.size_bytes,
    };

    cvmV101UpdateAtsUi();

    const container =
        document.querySelector(
            "#atsResults"
        );

    if (container) {
        container.className =
            "analysis-empty";

        container.textContent =
            "File ready. Run the ATS Check when you are ready.";
    }
}

if (
    typeof cvmProductResetAts
    === "function"
) {
    cvmProductResetAts =
        function () {

            const container =
                document.querySelector(
                    "#atsResults"
                );

            const button =
                document.querySelector(
                    "#runAtsBtn"
                );

            if (
                container
                && !cvmV101.atsFile?.path
            ) {
                container.className =
                    "analysis-empty";

                container.textContent =
                    "Choose a PDF or DOCX file to enable the ATS Check.";
            }

            if (button) {
                button.textContent =
                    "Run ATS Check";

                button.disabled =
                    !cvmV101.atsFile?.path;
            }

            try {
                if (
                    typeof cvmProduct
                    !== "undefined"
                    && cvmProduct
                ) {
                    cvmProduct.atsRunning =
                        false;
                }
            }
            catch (_) {
            }

            cvmV101UpdateAtsUi();
        };
}

if (
    typeof cvmProductRunAts
    === "function"
) {
    cvmProductRunAts =
        async function () {

            if (
                !cvmV101.atsFile?.path
            ) {
                cvmV101UpdateAtsUi();
                return;
            }

            const api =
                cvmV101Api();

            const container =
                document.querySelector(
                    "#atsResults"
                );

            const button =
                document.querySelector(
                    "#runAtsBtn"
                );

            if (
                !api?.analyze_ats_file
                || !container
                || !button
            ) {
                cvmV101Toast(
                    "ATS file analysis is not available yet.",
                    "error"
                );

                return;
            }

            button.disabled =
                true;

            button.textContent =
                "Analysing...";

            container.className =
                "cvm-product-ats-reset";

            container.textContent =
                "Analysing the selected CV locally...";

            try {
                const response =
                    await api
                        .analyze_ats_file(
                            cvmV101.atsFile.path
                        );

                if (
                    !response?.ok
                ) {
                    throw new Error(
                        response?.message
                        || "ATS analysis failed."
                    );
                }

                if (
                    typeof cvmProductRenderAtsResult
                    === "function"
                ) {
                    cvmProductRenderAtsResult(
                        response.result
                    );
                }
                else {
                    container.textContent =
                        JSON.stringify(
                            response.result,
                            null,
                            2
                        );
                }
            }
            catch (error) {
                console.error(
                    error
                );

                container.className =
                    "analysis-empty";

                container.textContent =
                    String(
                        error?.message
                        || "ATS analysis failed."
                    );
            }
            finally {
                button.textContent =
                    "Run ATS Check";

                button.disabled =
                    !cvmV101.atsFile?.path;
            }
        };
}

function cvmV101WireAtsFilePicker() {
    const button =
        document.querySelector(
            "#cvmAtsChooseFileBtn"
        );

    if (
        button
        && !button.dataset.v101Bound
    ) {
        button.dataset.v101Bound =
            "true";

        button.addEventListener(
            "click",
            cvmV101ChooseAtsFile
        );
    }

    cvmV101UpdateAtsUi();
}

// ===========================================================
// EDITOR TOOLBAR + SAVE AS PDF/DOCX
// ===========================================================

function cvmV101EnsureSaveAsModal() {
    const layer =
        document.querySelector(
            "#cvmModalLayer"
        );

    if (!layer) {
        return null;
    }

    let modal =
        document.querySelector(
            "#cvmV101SaveAsModal"
        );

    if (modal) {
        return modal;
    }

    modal =
        document.createElement(
            "section"
        );

    modal.id =
        "cvmV101SaveAsModal";

    modal.className =
        "cvm-modal hidden";

    modal.innerHTML = `
        <div class="cvm-modal-header">

            <div>

                <div class="eyebrow">
                    EXPORT
                </div>

                <h2>
                    Save As
                </h2>

            </div>

            <button
                type="button"
                class="cvm-modal-close"
                data-v101-save-close
            >
                ×
            </button>

        </div>

        <div class="cvm-modal-content">

            <p>
                Choose the file format. Windows will then ask where you want to save it.
            </p>

            <div class="cvm-v101-save-choice-grid">

                <button
                    type="button"
                    class="cvm-v101-save-choice"
                    data-v101-save-format="pdf"
                >
                    <strong>
                        PDF
                    </strong>

                    <small>
                        Generate the final LaTeX PDF.
                    </small>
                </button>

                <button
                    type="button"
                    class="cvm-v101-save-choice"
                    data-v101-save-format="docx"
                >
                    <strong>
                        DOCX
                    </strong>

                    <small>
                        Generate an editable Word document.
                    </small>
                </button>

            </div>

        </div>

        <div class="cvm-modal-footer centered">

            <button
                type="button"
                class="secondary-button"
                data-v101-save-close
            >
                Cancel
            </button>

        </div>
    `;

    layer.appendChild(
        modal
    );

    modal
        .querySelectorAll(
            "[data-v101-save-close]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        if (
                            typeof cvmCloseModals
                            === "function"
                        ) {
                            cvmCloseModals();
                        }
                    }
                );
            }
        );

    modal
        .querySelectorAll(
            "[data-v101-save-format]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        await cvmV101SaveExport(
                            button.dataset
                                .v101SaveFormat
                        );
                    }
                );
            }
        );

    return modal;
}

function cvmV101OpenSaveAsModal() {
    const modal =
        cvmV101EnsureSaveAsModal();

    if (!modal) {
        cvmV101Toast(
            "Save As is not ready yet.",
            "error"
        );

        return;
    }

    if (
        typeof cvmShowModal
        === "function"
    ) {
        cvmShowModal(
            "cvmV101SaveAsModal"
        );
    }
}

async function cvmV101SaveExport(
    format
) {
    const api =
        cvmV101Api();

    if (
        !api?.save_export_as
        || !state?.project
    ) {
        cvmV101Toast(
            "Save As is not available yet.",
            "error"
        );

        return;
    }

    if (
        typeof collectStaticFields
        === "function"
    ) {
        collectStaticFields();
    }

    if (
        typeof cvmCloseModals
        === "function"
    ) {
        cvmCloseModals();
    }

    const response =
        await api.save_export_as(
            state.project,
            format
        );

    if (
        response?.cancelled
    ) {
        return;
    }

    if (
        !response?.ok
    ) {
        cvmV101Toast(
            response?.message
            || `${String(format).toUpperCase()} export failed.`,
            "error"
        );

        return;
    }

    cvmV101Toast(
        `${String(format).toUpperCase()} saved successfully.`,
        "success"
    );
}

function cvmV101CustomizeEditorToolbar() {
    const header =
        document.querySelector(
            "#cvmEditorOverlay .cvm-editor-header"
        );

    const brand =
        header?.querySelector(
            ".cvm-editor-brand"
        );

    const toolbar =
        header?.querySelector(
            ".cvm-editor-toolbar"
        );

    if (
        !header
        || !brand
        || !toolbar
        || header.dataset
            .v101ToolbarReady
            === "true"
    ) {
        return;
    }

    header.dataset.v101ToolbarReady =
        "true";

    const left =
        document.createElement(
            "div"
        );

    left.className =
        "cvm-v101-editor-left";

    const leftTools =
        document.createElement(
            "div"
        );

    leftTools.className =
        "cvm-v101-editor-left-tools";

    left.appendChild(
        brand
    );

    left.appendChild(
        leftTools
    );

    header.insertBefore(
        left,
        toolbar
    );

    const undo =
        document.querySelector(
            "#cvmV06UndoBtn"
        );

    const redo =
        document.querySelector(
            "#cvmV06RedoBtn"
        );

    const oldSaveAs =
        document.querySelector(
            "#cvmV06SaveAsBtn"
        );

    if (undo) {
        leftTools.appendChild(
            undo
        );
    }

    if (redo) {
        leftTools.appendChild(
            redo
        );
    }

    if (oldSaveAs) {
        const saveAs =
            oldSaveAs.cloneNode(
                true
            );

        oldSaveAs.replaceWith(
            saveAs
        );

        saveAs.addEventListener(
            "click",
            cvmV101OpenSaveAsModal
        );

        leftTools.appendChild(
            saveAs
        );
    }

    [
        "#cvmV06SaveBtn",
        "#cvmV06DuplicateBtn",
        "#cvmV06CoachBtn",
        "#cvmV06PdfBtn",
        "#cvmV06DocxBtn",
    ].forEach(
        (selector) =>
            document
                .querySelector(
                    selector
                )
                ?.remove()
    );

    const cancel =
        document.querySelector(
            "#cvmV06CancelBtn"
        );

    const apply =
        document.querySelector(
            "#cvmV06ApplyBtn"
        );

    toolbar.replaceChildren();

    if (cancel) {
        toolbar.appendChild(
            cancel
        );
    }

    if (apply) {
        toolbar.appendChild(
            apply
        );
    }

    toolbar.classList.add(
        "cvm-v101-editor-actions"
    );
}

if (
    typeof cvmV06BuildEditorOverlay
    === "function"
) {
    const cvmV101BaseBuildEditorOverlay =
        cvmV06BuildEditorOverlay;

    cvmV06BuildEditorOverlay =
        function () {

            const result =
                cvmV101BaseBuildEditorOverlay();

            cvmV101CustomizeEditorToolbar();

            return result;
        };
}

// Existing productivity shortcuts already implement Ctrl+Z / Ctrl+Y.
// Keep them, but make sure the editor buttons remain wired to the same history.

// ===========================================================
// GO BACK TO CV EDITING BUTTON
// ===========================================================

function cvmV101EnsureResumeButton() {
    let button =
        document.querySelector(
            "#cvmResumeEditorBtn"
        );

    if (!button) {
        button =
            document.createElement(
                "button"
            );

        button.id =
            "cvmResumeEditorBtn";

        button.type =
            "button";

        button.className =
            "top-action-button cvm-v101-resume-editor";

        button.textContent =
            "Go back to CV editing";

        button.hidden =
            true;

        const projectGroup =
            document.querySelector(
                ".cvm-toolbar-group--project"
            )
            || document.querySelector(
                ".topbar-actions"
            );

        projectGroup?.prepend(
            button
        );
    }

    if (
        button
        && !button.dataset.v101Bound
    ) {
        button.dataset.v101Bound =
            "true";

        button.addEventListener(
            "click",
            () => {

                if (
                    typeof cvmV06OpenEditor
                    === "function"
                ) {
                    cvmV06OpenEditor({
                        askLanguage: false,
                        tab: "content",
                    });
                }
            }
        );
    }

    if (button) {
        button.hidden =
            !cvmV101
                .resumeEditorAvailable;
    }

    return button;
}

if (
    typeof cvmV06ApplyEditor
    === "function"
) {
    const cvmV101BaseApplyEditor =
        cvmV06ApplyEditor;

    cvmV06ApplyEditor =
        async function () {

            await cvmV101BaseApplyEditor();

            if (
                typeof cvmV06
                !== "undefined"
                && cvmV06
                && !cvmV06.editorOpen
            ) {
                cvmV101
                    .resumeEditorAvailable =
                    true;

                cvmV101EnsureResumeButton();
            }
        };
}

// ===========================================================
// LOGS: COPY EACH ERROR IN ONE CLICK
// ===========================================================

function cvmV101EnhanceLogCopyButtons() {
    document
        .querySelectorAll(
            "#cvmV06LogEvents .cvm-log-event"
        )
        .forEach(
            (row) => {

                if (
                    row.querySelector(
                        ".cvm-v101-copy-error"
                    )
                ) {
                    return;
                }

                const level =
                    row
                        .querySelector(
                            ".cvm-log-level"
                        )
                        ?.textContent
                        ?.trim()
                        .toUpperCase();

                if (
                    level !== "ERROR"
                ) {
                    return;
                }

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "cvm-v101-copy-error";

                button.textContent =
                    "Copy";

                button.title =
                    "Copy this error";

                button.addEventListener(
                    "click",
                    async () => {

                        const text =
                            row.innerText
                                .replace(
                                    /\bCopy\b\s*$/i,
                                    ""
                                )
                                .trim();

                        try {
                            await navigator
                                .clipboard
                                .writeText(
                                    text
                                );

                            cvmV101Toast(
                                "Error copied.",
                                "success"
                            );
                        }
                        catch (_) {
                            cvmV101Toast(
                                "Unable to copy this error.",
                                "error"
                            );
                        }
                    }
                );

                row.appendChild(
                    button
                );
            }
        );
}

if (
    typeof cvmV06RefreshLogs
    === "function"
) {
    const cvmV101BaseRefreshLogs =
        cvmV06RefreshLogs;

    cvmV06RefreshLogs =
        async function () {

            const result =
                await cvmV101BaseRefreshLogs();

            cvmV101EnhanceLogCopyButtons();

            return result;
        };
}

// ===========================================================
// INIT
// ===========================================================

function cvmV101Init() {
    cvmV101EnforceDarkTheme();

    cvmV101WireAtsFilePicker();

    cvmV101WireRecentProjects();

    cvmV101CustomizeEditorToolbar();

    setTimeout(
        () => {

            cvmV101InstallFinalShowPagePatch();

            cvmV101FixSupportButton();

            cvmV101EnsureResumeButton();

            cvmV101EnhanceLogCopyButtons();

        },
        700
    );
}

document.addEventListener(
    "DOMContentLoaded",
    cvmV101Init
);

window.addEventListener(
    "pywebviewready",
    () => {
        setTimeout(
            cvmV101Init,
            850
        );
    }
);
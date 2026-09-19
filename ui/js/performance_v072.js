"use strict";

// ===========================================================
// CVM 0.7.2 PERFORMANCE / UX PATCH
// ===========================================================

const cvmV072 = {
    previewTimer: null,
    historyTimer: null,
    analysisTimer: null,
    i18nTimer: null,
    i18nRoots: new Set(),
    initialized: false,
};

const CVM_V072_PAYPAL =
    "https://paypal.me/BigBossManTN";

const CVM_V072_KOFI =
    "https://ko-fi.com/bigbossmantn";

function cvmV072DisableLegacyJournal() {
    try {
        state.journalVisible = false;
    }
    catch (_) {
    }

    document.querySelector("#journalToggle")?.remove();
    document.querySelector("#activityPanel")?.remove();
    document.querySelector("#settingsJournalBtn")?.closest(".settings-card")?.remove();

    window.cvmReceiveLog = function () {};
}

function cvmV072DisableStructuredPdfPreview() {
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
        cvmV05ScheduleRealPreview = function () {};
    }

    if (typeof cvmV05RenderRealPreview === "function") {
        cvmV05RenderRealPreview = async function () {
            return {
                ok: false,
                disabled: true,
            };
        };
    }

    if (typeof cvmV07InstallManualPdfPreview === "function") {
        cvmV07InstallManualPdfPreview = function () {
            return true;
        };
    }

    if (typeof cvmV07RetryManualPreviewInstall === "function") {
        cvmV07RetryManualPreviewInstall = function () {};
    }

    document.querySelector("#cvmRealPreview")?.remove();
    document.querySelector("#cvmV07StructuredStale")?.remove();
    document.querySelector("#cvmV07PreviewModeBtn")?.remove();
    document.querySelector("#cvmV07RecompileBtn")?.remove();
    document.querySelector("#cvmPreviewModeBtn")?.remove();

    const htmlPreview =
        document.querySelector(".preview-column .preview-scroll");

    if (htmlPreview) {
        htmlPreview.style.display = "block";
    }

    const badge =
        document.querySelector(".preview-column .preview-badge");

    if (badge) {
        badge.textContent = "HTML preview";
    }
}

function cvmV072SchedulePreview() {
    window.clearTimeout(
        cvmV072.previewTimer
    );

    cvmV072.previewTimer =
        window.setTimeout(
            () => {
                cvmV072.previewTimer = null;

                if (
                    typeof renderPreview === "function"
                    && state?.project
                ) {
                    renderPreview();
                }
            },
            120
        );
}

function cvmV072CommitHistory() {
    if (
        typeof cvmV05 === "undefined"
        || cvmV05.restoring
        || !state?.project
    ) {
        return;
    }

    let snapshot = "";

    try {
        if (
            typeof collectStaticFields === "function"
        ) {
            collectStaticFields();
        }

        snapshot =
            JSON.stringify(
                state.project
            );
    }
    catch (_) {
        return;
    }

    if (
        !snapshot
        || snapshot === cvmV05.lastSnapshot
    ) {
        return;
    }

    if (
        cvmV05.lastSnapshot
    ) {
        cvmV05.undo.push(
            cvmV05.lastSnapshot
        );

        if (
            cvmV05.undo.length
            > cvmV05.maxHistory
        ) {
            cvmV05.undo.shift();
        }
    }

    cvmV05.lastSnapshot =
        snapshot;

    cvmV05.redo =
        [];

    if (
        typeof cvmV05RefreshHistoryButtons === "function"
    ) {
        cvmV05RefreshHistoryButtons();
    }
}

function cvmV072ScheduleHistory() {
    if (
        typeof cvmV05 === "undefined"
        || cvmV05.restoring
    ) {
        return;
    }

    window.clearTimeout(
        cvmV072.historyTimer
    );

    cvmV072.historyTimer =
        window.setTimeout(
            () => {
                cvmV072.historyTimer = null;
                cvmV072CommitHistory();
            },
            550
        );
}

function cvmV072ScheduleAnalysis() {
    if (
        typeof cvmV05ScheduleAnalyses !== "function"
    ) {
        return;
    }

    window.clearTimeout(
        cvmV072.analysisTimer
    );

    cvmV072.analysisTimer =
        window.setTimeout(
            () => {
                cvmV072.analysisTimer = null;
                cvmV05ScheduleAnalyses();
            },
            950
        );
}

function cvmV072InstallProjectChanged() {
    if (
        typeof projectChanged !== "function"
        || projectChanged.__cvmV072Optimized
    ) {
        return;
    }

    const optimized =
        function () {
            if (
                typeof cvmV05 !== "undefined"
                && !cvmV05.restoring
                && !cvmV05.dirty
                && typeof cvmV05SetDirty === "function"
            ) {
                cvmV05SetDirty(true);
            }

            cvmV072SchedulePreview();
            cvmV072ScheduleHistory();
            cvmV072ScheduleAnalysis();

            window.clearTimeout(
                state.autosaveTimer
            );

            state.autosaveTimer =
                window.setTimeout(
                    autosaveProject,
                    900
                );
        };

    optimized.__cvmV072Optimized = true;

    projectChanged = optimized;
    window.projectChanged = optimized;
}

function cvmV072IgnoredTranslationNode(node) {
    const element =
        node?.nodeType === Node.ELEMENT_NODE
            ? node
            : node?.parentElement;

    if (!element) {
        return true;
    }

    return Boolean(
        element.closest?.(
            "#cvPreview, "
            + "#cvmRealPreview, "
            + "#cvmLatexEditor, "
            + ".cvm-latex-preview, "
            + "script, style"
        )
    );
}

function cvmV072FlushTranslations() {
    cvmV072.i18nTimer = null;

    const roots =
        Array.from(
            cvmV072.i18nRoots
        ).filter(
            (node) =>
                node?.isConnected
                && !cvmV072IgnoredTranslationNode(node)
        );

    cvmV072.i18nRoots.clear();

    const minimalRoots =
        roots.filter(
            (node, index) =>
                !roots.some(
                    (other, otherIndex) =>
                        otherIndex !== index
                        && other !== node
                        && other.contains?.(node)
                )
        );

    for (const root of minimalRoots) {
        try {
            if (
                typeof cvmTranslateNode === "function"
            ) {
                cvmTranslateNode(root);
            }

            cvmV072EnhanceWritingFields(root);
        }
        catch (_) {
        }
    }
}

function cvmV072QueueTranslation(node) {
    if (
        !node
        || cvmV072IgnoredTranslationNode(node)
    ) {
        return;
    }

    const root =
        node.nodeType === Node.ELEMENT_NODE
            ? node
            : node.parentElement;

    if (!root) {
        return;
    }

    cvmV072.i18nRoots.add(root);

    if (cvmV072.i18nTimer) {
        return;
    }

    cvmV072.i18nTimer =
        window.setTimeout(
            cvmV072FlushTranslations,
            40
        );
}

function cvmV072InstallLocalizationObserver() {
    try {
        if (
            typeof cvmI18nObserver !== "undefined"
        ) {
            cvmI18nObserver.disconnect();
        }
    }
    catch (_) {
    }

    const observer =
        new MutationObserver(
            (mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        cvmV072QueueTranslation(node);
                    }
                }
            }
        );

    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true,
        }
    );

    window.cvmV072I18nObserver =
        observer;
}

function cvmV072WritingLanguage() {
    try {
        return (
            typeof cvmCurrentLanguage !== "undefined"
            && cvmCurrentLanguage === "fr"
        )
            ? "fr"
            : "en";
    }
    catch (_) {
        return "en";
    }
}

function cvmV072EnhanceWritingFields(root = document) {
    const fields = [];

    if (
        root.matches?.(
            "input, textarea"
        )
    ) {
        fields.push(root);
    }

    root.querySelectorAll?.(
        "input, textarea"
    ).forEach(
        (field) => fields.push(field)
    );

    const language =
        cvmV072WritingLanguage();

    const excludedTypes =
        new Set([
            "email",
            "url",
            "number",
            "date",
            "month",
            "color",
            "password",
        ]);

    const excludedKeys =
        new Set([
            "tools",
            "linkedin",
            "github",
            "website",
            "email",
            "phone",
        ]);

    for (const field of fields) {
        const type =
            String(
                field.type || ""
            ).toLowerCase();

        const key =
            String(
                field.dataset?.key || ""
            ).toLowerCase();

        if (
            excludedTypes.has(type)
            || excludedKeys.has(key)
            || field.hasAttribute("data-v05-tool-input")
        ) {
            continue;
        }

        field.setAttribute(
            "spellcheck",
            "true"
        );

        field.setAttribute(
            "lang",
            language
        );

        field.setAttribute(
            "autocapitalize",
            "sentences"
        );
    }
}

function cvmV072InstallToolFocusFix() {
    document.addEventListener(
        "keydown",
        (event) => {
            const input =
                event.target?.closest?.(
                    "[data-v05-tool-input]"
                );

            if (
                !input
                || event.key !== "Enter"
            ) {
                return;
            }

            const wrapper =
                input.closest(
                    ".cvm-chip-editor"
                );

            if (!wrapper) {
                return;
            }

            const collection =
                wrapper.dataset.collection;

            const index =
                wrapper.dataset.index;

            window.setTimeout(
                () => {
                    const candidates =
                        document.querySelectorAll(
                            ".cvm-chip-editor"
                        );

                    for (const candidate of candidates) {
                        if (
                            candidate.dataset.collection === collection
                            && candidate.dataset.index === index
                        ) {
                            const next =
                                candidate.querySelector(
                                    "[data-v05-tool-input]"
                                );

                            next?.focus();
                            return;
                        }
                    }
                },
                0
            );
        },
        true
    );
}

function cvmV072RefreshLegacyLogos(root = document) {
    const images = [];

    if (root.matches?.("img")) {
        images.push(root);
    }

    root.querySelectorAll?.("img").forEach(
        (image) => images.push(image)
    );

    const dark =
        document.documentElement.dataset.theme === "dark";

    for (const image of images) {
        const source =
            image.getAttribute("src") || "";

        if (
            source.includes(
                "cvm_logo.png"
            )
        ) {
            image.src =
                dark
                    ? "../assets/branding/cvm.png"
                    : "../assets/branding/cvm_dark.png";
        }
    }
}

function cvmV072EnhanceSupport() {
    const modal =
        document.querySelector(
            "#cvmSupportModal"
        );

    if (!modal) {
        return;
    }

    const footer =
        modal.querySelector(
            ".cvm-modal-footer"
        );

    if (!footer) {
        return;
    }

    let paypal =
        modal.querySelector(
            "#cvmSupportDonateLink"
        );

    if (
        paypal
        && paypal.dataset.v072Ready !== "true"
    ) {
        const fresh =
            paypal.cloneNode(
                true
            );

        paypal.replaceWith(
            fresh
        );

        paypal =
            fresh;

        paypal.dataset.v072Ready =
            "true";
    }

    if (paypal) {
        paypal.textContent =
            "PayPal";

        paypal.classList.remove(
            "cvm-support-coming-soon"
        );

        paypal.removeAttribute(
            "aria-disabled"
        );

        paypal.href =
            CVM_V072_PAYPAL;

        paypal.target =
            "_blank";

        paypal.rel =
            "noopener noreferrer";
    }

    if (
        !modal.querySelector(
            "#cvmV072KofiLink"
        )
    ) {
        const kofi =
            document.createElement(
                "a"
            );

        kofi.id =
            "cvmV072KofiLink";

        kofi.className =
            "primary-button";

        kofi.textContent =
            "Ko-fi";

        kofi.href =
            CVM_V072_KOFI;

        kofi.target =
            "_blank";

        kofi.rel =
            "noopener noreferrer";

        footer.appendChild(
            kofi
        );
    }
}

function cvmV072Init() {
    if (cvmV072.initialized) {
        return;
    }

    cvmV072.initialized = true;

    cvmV072DisableLegacyJournal();
    cvmV072DisableStructuredPdfPreview();
    cvmV072InstallProjectChanged();
    cvmV072InstallLocalizationObserver();
    cvmV072InstallToolFocusFix();

    cvmV072EnhanceWritingFields(
        document
    );

    cvmV072RefreshLegacyLogos(
        document
    );

    cvmV072EnhanceSupport();

    document.addEventListener(
        "click",
        () => {
            window.setTimeout(
                () => {
                    cvmV072DisableStructuredPdfPreview();
                    cvmV072EnhanceWritingFields(document);
                    cvmV072RefreshLegacyLogos(document);
                    cvmV072EnhanceSupport();
                },
                0
            );
        },
        true
    );
}

document.addEventListener(
    "DOMContentLoaded",
    cvmV072Init
);

window.addEventListener(
    "pywebviewready",
    cvmV072Init
);
"use strict";

// ===========================================================
// CV MAKER 0.6.2 — EDITOR WORKSPACE
// ===========================================================

const CVM_V06_SECTIONS = [
    "profile", "experiences", "education", "projects",
    "volunteering", "skills", "languages", "certifications",
];

const CVM_V06_SPACING_DEFAULTS = {
    page_top_mm: 7,
    page_bottom_mm: 7,
    page_left_mm: 9,
    page_right_mm: 9,
    section_gap_mm: 1,
    title_before_mm: 0,
    title_after_mm: 0.6,
    separator_gap_mm: 0.2,
    entry_gap_mm: 1,
    bullet_gap_mm: 0.2,
    body_line_height: 1.11,
};

for (const key of CVM_V06_SECTIONS) {
    CVM_V06_SPACING_DEFAULTS[`${key}_before_mm`] = 0;
    CVM_V06_SPACING_DEFAULTS[`${key}_after_mm`] = 0;
    CVM_V06_SPACING_DEFAULTS[`${key}_line_height`] = 1.11;
}

const CVM_V06_MONTHS = {
    en: [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ],
    fr: [
        "",
        "Janvier",
        "Février",
        "Mars",
        "Avril",
        "Mai",
        "Juin",
        "Juillet",
        "Août",
        "Septembre",
        "Octobre",
        "Novembre",
        "Décembre",
    ],
};

const cvmV06 = {
    initialized: false,
    editorOpen: false,
    editorSnapshot: "",
    editorTab: "content",
    monthTarget: null,
    yearTarget: null,
    pickerYear: new Date().getFullYear(),
    yearPageStart: new Date().getFullYear() - 5,
    baseShowPage: null,
    baseRenderDynamicSections: null,
    baseRenderPreview: null,
};


// ===========================================================
// HELPERS
// ===========================================================

function cvmV06Api() {
    return window.pywebview?.api || null;
}


function cvmV06Lang() {
    return (
        typeof cvmCurrentLanguage !== "undefined"
        && cvmCurrentLanguage === "fr"
    )
        ? "fr"
        : "en";
}


function cvmV06Text(en, fr) {
    return cvmV06Lang() === "fr"
        ? fr
        : en;
}


function cvmV06Escape(value) {
    if (typeof escapeHtml === "function") {
        return escapeHtml(value);
    }

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}


function cvmV06Clone(value) {
    return JSON.parse(
        JSON.stringify(value)
    );
}


function cvmV06ProjectActive() {
    return Boolean(
        typeof state !== "undefined"
        && state?.project
        && (
            typeof cvmProjectActive === "undefined"
            || cvmProjectActive
        )
    );
}


function cvmV06CvLanguage() {
    const language =
        state?.project?.design?.cv_language
        || state?.project?.design?.language
        || "en";

    return String(language)
        .toLowerCase()
        .startsWith("fr")
            ? "fr"
            : "en";
}


function cvmV06EnsureDesign() {
    if (!state?.project) {
        return;
    }

    state.project.design ||= {};
    state.project.design.spacing ||= {};

    for (
        const [key, value]
        of Object.entries(CVM_V06_SPACING_DEFAULTS)
    ) {
        if (
            state.project.design.spacing[key] === undefined
            || state.project.design.spacing[key] === null
            || Number.isNaN(
                Number(
                    state.project.design.spacing[key]
                )
            )
        ) {
            state.project.design.spacing[key] = value;
        }
    }
}


function cvmV06ShowToast(
    message,
    type = "info"
) {
    if (
        typeof showToast
        === "function"
    ) {
        showToast(
            message,
            type
        );
    }
}


function cvmV06SetProjectActive(active) {
    if (
        typeof cvmSetProjectActive
        === "function"
    ) {
        cvmSetProjectActive(
            Boolean(active)
        );
    }

    document.body.classList.toggle(
        "cvm-has-project",
        Boolean(active)
    );
}


function cvmV06FormatBytes(bytes) {
    const value =
        Number(
            bytes || 0
        );

    if (
        value < 1024
    ) {
        return `${value} B`;
    }

    if (
        value < 1024 * 1024
    ) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}


// ===========================================================
// EDITOR SHELL
// ===========================================================

function cvmV06BuildEditorOverlay() {
    if (
        document.querySelector(
            "#cvmEditorOverlay"
        )
    ) {
        return;
    }

    const overlay =
        document.createElement(
            "div"
        );

    overlay.id =
        "cvmEditorOverlay";

    overlay.className =
        "cvm-editor-overlay";

    overlay.innerHTML = `
        <section
            class="cvm-editor-window"
            role="dialog"
            aria-modal="true"
            aria-label="CV Editor"
        >

            <header class="cvm-editor-header">

                <div class="cvm-editor-brand">

                    <img
                        src="../assets/branding/cvm_logo.png"
                        alt="CVM"
                    >

                    <div>

                        <strong>
                            ${cvmV06Text(
                                "CV Editor",
                                "Éditeur de CV"
                            )}
                        </strong>

                        <small>
                            ${cvmV06Text(
                                "Create and modify your CV",
                                "Créez et modifiez votre CV"
                            )}
                        </small>

                    </div>

                </div>


                <div class="cvm-editor-toolbar">

                    <button
                        class="cvm-editor-tool"
                        id="cvmV06UndoBtn"
                        type="button"
                        title="Ctrl+Z"
                    >
                        ↶ ${cvmV06Text(
                            "Undo",
                            "Annuler"
                        )}
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06RedoBtn"
                        type="button"
                        title="Ctrl+Y"
                    >
                        ↷ ${cvmV06Text(
                            "Redo",
                            "Rétablir"
                        )}
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06SaveBtn"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Save",
                            "Enregistrer"
                        )}
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06SaveAsBtn"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Save As",
                            "Enregistrer sous"
                        )}
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06DuplicateBtn"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Duplicate",
                            "Dupliquer"
                        )}
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06CoachBtn"
                        type="button"
                    >
                        Coach
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06PdfBtn"
                        type="button"
                    >
                        PDF
                    </button>


                    <button
                        class="cvm-editor-tool"
                        id="cvmV06DocxBtn"
                        type="button"
                    >
                        DOCX
                    </button>


                    <button
                        class="cvm-editor-tool danger-subtle"
                        id="cvmV06CancelBtn"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Cancel",
                            "Annuler"
                        )}
                    </button>


                    <button
                        class="cvm-editor-tool primary"
                        id="cvmV06ApplyBtn"
                        type="button"
                    >
                        ✓ ${cvmV06Text(
                            "Apply",
                            "Appliquer"
                        )}
                    </button>

                </div>

            </header>


            <nav
                class="cvm-editor-tabs"
                aria-label="CV editor sections"
            >

                <button
                    class="cvm-editor-tab active"
                    data-v06-editor-tab="content"
                    type="button"
                >
                    ${cvmV06Text(
                        "CV Content",
                        "Contenu du CV"
                    )}
                </button>


                <button
                    class="cvm-editor-tab"
                    data-v06-editor-tab="design"
                    type="button"
                >
                    ${cvmV06Text(
                        "Design & spacing",
                        "Design & espacements"
                    )}
                </button>

            </nav>


            <div class="cvm-editor-body">

                <div
                    id="cvmV06LanguageGate"
                    class="cvm-editor-language-gate"
                >

                    <div class="cvm-language-card">

                        <div class="eyebrow">
                            ${cvmV06Text(
                                "CV LANGUAGE",
                                "LANGUE DU CV"
                            )}
                        </div>


                        <h2>
                            ${cvmV06Text(
                                "What language is this CV?",
                                "Dans quelle langue est ce CV ?"
                            )}
                        </h2>


                        <p>
                            ${cvmV06Text(
                                "This controls section titles, month names and generated CV wording. It does not change the CV Maker interface language.",
                                "Cela contrôle les titres des sections, les mois et le texte généré du CV. La langue de l'interface CV Maker reste indépendante."
                            )}
                        </p>


                        <div class="cvm-language-choice-grid">

                            <button
                                class="cvm-language-choice"
                                data-v06-cv-language="en"
                                type="button"
                            >

                                <span
                                    class="cvm-language-flag cvm-language-flag--uk"
                                    aria-hidden="true"
                                ></span>

                                <strong>
                                    English
                                </strong>

                            </button>


                            <button
                                class="cvm-language-choice"
                                data-v06-cv-language="fr"
                                type="button"
                            >

                                <span
                                    class="cvm-language-flag cvm-language-flag--fr"
                                    aria-hidden="true"
                                ></span>

                                <strong>
                                    Français
                                </strong>

                            </button>

                        </div>

                    </div>

                </div>


                <div class="cvm-editor-workspace">

                    <div class="cvm-editor-left-scroll">

                        <div
                            id="cvmEditorPages"
                            class="cvm-editor-pages"
                        ></div>

                    </div>


                    <div
                        id="cvmEditorPreviewSlot"
                        class="cvm-editor-preview-slot"
                    ></div>

                </div>

            </div>

        </section>
    `;


    document.body.appendChild(
        overlay
    );


    const pagesHost =
        overlay.querySelector(
            "#cvmEditorPages"
        );


    const previewSlot =
        overlay.querySelector(
            "#cvmEditorPreviewSlot"
        );


    const contentPage =
        document.querySelector(
            "#page-content"
        );


    const designPage =
        document.querySelector(
            "#page-design"
        );


    contentPage
        ?.querySelector(
            ":scope > .page-heading"
        )
        ?.remove();


    designPage
        ?.querySelector(
            ":scope > .page-heading"
        )
        ?.remove();


    const sharedPreview =
        contentPage?.querySelector(
            ".preview-column"
        );


    if (
        sharedPreview
        && previewSlot
    ) {
        sharedPreview.classList.add(
            "cvm-editor-shared-preview"
        );

        previewSlot.appendChild(
            sharedPreview
        );
    }


    if (
        contentPage
    ) {
        pagesHost.appendChild(
            contentPage
        );
    }


    if (
        designPage
    ) {
        pagesHost.appendChild(
            designPage
        );
    }


    cvmV06BindEditorToolbar();

    cvmV06BindEditorTabs();

    cvmV06BindLanguageGate();
}


function cvmV06BindEditorToolbar() {
    document
        .querySelector(
            "#cvmV06UndoBtn"
        )
        ?.addEventListener(
            "click",
            () =>
                typeof cvmV05Undo === "function"
                && cvmV05Undo()
        );


    document
        .querySelector(
            "#cvmV06RedoBtn"
        )
        ?.addEventListener(
            "click",
            () =>
                typeof cvmV05Redo === "function"
                && cvmV05Redo()
        );


    document
        .querySelector(
            "#cvmV06SaveBtn"
        )
        ?.addEventListener(
            "click",
            async () =>
                typeof saveProject === "function"
                && await saveProject()
        );


    document
        .querySelector(
            "#cvmV06SaveAsBtn"
        )
        ?.addEventListener(
            "click",
            async () =>
                typeof cvmV05SaveAs === "function"
                && await cvmV05SaveAs()
        );


    document
        .querySelector(
            "#cvmV06DuplicateBtn"
        )
        ?.addEventListener(
            "click",
            async () =>
                typeof cvmV05Duplicate === "function"
                && await cvmV05Duplicate()
        );


    document
        .querySelector(
            "#cvmV06CoachBtn"
        )
        ?.addEventListener(
            "click",
            async () =>
                typeof cvmV05ShowOptimizer === "function"
                && await cvmV05ShowOptimizer()
        );


    document
        .querySelector(
            "#cvmV06PdfBtn"
        )
        ?.addEventListener(
            "click",
            async () =>
                typeof exportPdf === "function"
                && await exportPdf()
        );


    document
        .querySelector(
            "#cvmV06DocxBtn"
        )
        ?.addEventListener(
            "click",
            async () =>
                typeof exportDocx === "function"
                && await exportDocx()
        );


    document
        .querySelector(
            "#cvmV06ApplyBtn"
        )
        ?.addEventListener(
            "click",
            cvmV06ApplyEditor
        );


    document
        .querySelector(
            "#cvmV06CancelBtn"
        )
        ?.addEventListener(
            "click",
            cvmV06CancelEditor
        );
}


function cvmV06BindEditorTabs() {
    document
        .querySelectorAll(
            "[data-v06-editor-tab]"
        )
        .forEach(
            (
                button
            ) => {

                button.addEventListener(
                    "click",
                    () =>
                        cvmV06SetEditorTab(
                            button.dataset
                                .v06EditorTab
                        )
                );
            }
        );
}


function cvmV06SetEditorTab(tab) {
    cvmV06.editorTab =
        tab === "design"
            ? "design"
            : "content";


    document
        .querySelectorAll(
            "[data-v06-editor-tab]"
        )
        .forEach(
            (
                button
            ) => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .v06EditorTab
                    === cvmV06.editorTab
                );
            }
        );


    document
        .querySelector(
            "#page-content"
        )
        ?.classList.toggle(
            "cvm-editor-page-active",
            cvmV06.editorTab === "content"
        );


    document
        .querySelector(
            "#page-design"
        )
        ?.classList.toggle(
            "cvm-editor-page-active",
            cvmV06.editorTab === "design"
        );


    if (
        cvmV06.editorTab
        === "design"
    ) {
        cvmV06EnsureSpacingEditor();
    }


    cvmV06RemoveCountryPreset();

    cvmV06MountCompleteness();


    if (
        typeof renderPreview
        === "function"
    ) {
        renderPreview();
    }


    if (
        typeof cvmV05ScheduleRealPreview
        === "function"
    ) {
        cvmV05ScheduleRealPreview(
            true
        );
    }
}


function cvmV06RemoveCountryPreset() {
    const preset =
        document.querySelector(
            "#cvmCountryPreset"
        );


    if (
        preset
    ) {
        const panel =
            preset.closest(
                ".cvm-v05-panel"
            )
            || preset.closest(
                ".settings-card"
            )
            || preset.closest(
                "section"
            );

        panel?.remove();
    }


    const region =
        document.querySelector(
            "#regionSelect"
        );


    region
        ?.closest(
            ".settings-card"
        )
        ?.classList.add(
            "cvm-v06-legacy-region-hidden"
        );
}


function cvmV06MountCompleteness() {
    const tabs =
        document.querySelector(
            ".cvm-editor-tabs"
        );


    if (
        !tabs
    ) {
        return;
    }


    let mount =
        document.querySelector(
            "#cvmV06CompletenessMount"
        );


    if (
        !mount
    ) {
        mount =
            document.createElement(
                "div"
            );

        mount.id =
            "cvmV06CompletenessMount";

        mount.className =
            "cvm-editor-completeness-mount";

        tabs.appendChild(
            mount
        );
    }


    const completeness =
        document.querySelector(
            "#cvmCompleteness"
        );


    if (
        completeness
        && completeness.parentElement !== mount
    ) {
        completeness.classList.add(
            "cvm-editor-completeness"
        );

        mount.appendChild(
            completeness
        );
    }
}


function cvmV06BindLanguageGate() {
    document
        .querySelectorAll(
            "[data-v06-cv-language]"
        )
        .forEach(
            (
                button
            ) => {

                button.addEventListener(
                    "click",
                    () =>
                        cvmV06ChooseCvLanguage(
                            button.dataset
                                .v06CvLanguage
                        )
                );
            }
        );
}


function cvmV06OpenEditor({
    askLanguage = false,
    tab = "content",
} = {}) {
    if (
        !state?.project
    ) {
        return;
    }


    cvmV06EnsureDesign();


    cvmV06.editorSnapshot =
        JSON.stringify(
            state.project
        );


    cvmV06.editorOpen =
        true;


    document.body.classList.add(
        "cvm-editor-open"
    );


    document
        .querySelector(
            "#cvmEditorOverlay"
        )
        ?.classList.add(
            "open"
        );


    cvmV06SetEditorTab(
        tab
    );


    cvmV06EnhanceEditorFields();

    cvmV06EnsureSpacingEditor();

    cvmV06RefreshSocialHints();

    cvmV06RemoveCountryPreset();

    cvmV06MountCompleteness();


    const gate =
        document.querySelector(
            "#cvmV06LanguageGate"
        );


    gate?.classList.toggle(
        "visible",
        Boolean(
            askLanguage
        )
    );


    if (
        askLanguage
    ) {
        const current =
            cvmV06CvLanguage();


        document
            .querySelectorAll(
                "[data-v06-cv-language]"
            )
            .forEach(
                (
                    button
                ) => {

                    button.classList.toggle(
                        "selected",
                        button.dataset
                            .v06CvLanguage
                        === current
                    );
                }
            );
    }


    setTimeout(
        () => {

            cvmV06RemoveCountryPreset();

            cvmV06MountCompleteness();

            cvmV06EnhanceEditorFields();

        },
        200
    );
}


function cvmV06CloseEditor() {
    cvmV06.editorOpen =
        false;


    document.body.classList.remove(
        "cvm-editor-open"
    );


    document
        .querySelector(
            "#cvmEditorOverlay"
        )
        ?.classList.remove(
            "open"
        );


    document
        .querySelector(
            "#cvmV06LanguageGate"
        )
        ?.classList.remove(
            "visible"
        );


    cvmV06ClosePickers();
}


async function cvmV06ChooseCvLanguage(language) {
    if (
        !state?.project
    ) {
        return;
    }


    const normalized =
        language === "fr"
            ? "fr"
            : "en";


    state.project.design ||= {};

    state.project.design.cv_language =
        normalized;

    state.project.design.language =
        normalized;


    document
        .querySelector(
            "#cvmV06LanguageGate"
        )
        ?.classList.remove(
            "visible"
        );


    if (
        typeof cvmV05SyncDesignStudio
        === "function"
    ) {
        cvmV05SyncDesignStudio();
    }


    if (
        typeof cvmV05RenderCustomTitles
        === "function"
    ) {
        cvmV05RenderCustomTitles();
    }


    if (
        typeof projectChanged
        === "function"
    ) {
        projectChanged();
    }


    cvmV06EnhanceEditorFields();


    if (
        typeof renderPreview
        === "function"
    ) {
        renderPreview();
    }
}


async function cvmV06ApplyEditor() {
    if (
        !state?.project
    ) {
        return;
    }


    try {
        if (
            typeof collectStaticFields
            === "function"
        ) {
            collectStaticFields();
        }


        cvmV06EnsureDesign();


        const response =
            await cvmV06Api()
                ?.update_project
                ?.(state.project);


        if (
            response
            && !response.ok
        ) {
            cvmV06ShowToast(
                response.message
                || "Unable to apply CV changes.",
                "error"
            );

            return;
        }


        cvmV06.editorSnapshot =
            JSON.stringify(
                state.project
            );


        if (
            typeof cvmV05SetDirty
            === "function"
        ) {
            await cvmV05SetDirty(
                false
            );
        }


        cvmV06SetProjectActive(
            true
        );


        cvmV06CloseEditor();

        cvmV06ShowMainPage(
            "home"
        );

        cvmV06RefreshModifyButton();


        cvmV06ShowToast(
            cvmV06Text(
                "CV changes applied.",
                "Modifications du CV appliquées."
            ),
            "success"
        );

    }
    catch (
        error
    ) {
        console.error(
            error
        );


        cvmV06ShowToast(
            cvmV06Text(
                "Unable to apply CV changes.",
                "Impossible d'appliquer les modifications."
            ),
            "error"
        );
    }
}


async function cvmV06CancelEditor() {
    if (
        !cvmV06.editorSnapshot
    ) {
        cvmV06CloseEditor();

        return;
    }


    let proceed =
        true;


    if (
        typeof cvmV05Confirm
        === "function"
    ) {
        proceed =
            await cvmV05Confirm(
                cvmV06Text(
                    "Discard editor changes?",
                    "Annuler les modifications ?"
                ),
                cvmV06Text(
                    "The CV will return to the state it had when you opened the editor.",
                    "Le CV reviendra à l'état qu'il avait à l'ouverture de l'éditeur."
                ),
                cvmV06Text(
                    "Discard changes",
                    "Annuler les modifications"
                )
            );
    }


    if (
        !proceed
    ) {
        return;
    }


    try {
        const restored =
            JSON.parse(
                cvmV06.editorSnapshot
            );


        state.project =
            restored;


        if (
            typeof loadProjectIntoUI
            === "function"
        ) {
            loadProjectIntoUI(
                restored
            );
        }


        await cvmV06Api()
            ?.update_project
            ?.(restored);


        cvmV06CloseEditor();

        cvmV06ShowMainPage(
            "home"
        );

        cvmV06RefreshModifyButton();

    }
    catch (
        error
    ) {
        console.error(
            error
        );

        cvmV06CloseEditor();
    }
}


// ===========================================================
// HOME / NAVIGATION
// ===========================================================

function cvmV06ReplaceButton(
    id,
    handler
) {
    const oldButton =
        document.querySelector(
            `#${id}`
        );


    if (
        !oldButton
    ) {
        return null;
    }


    const fresh =
        oldButton.cloneNode(
            true
        );


    oldButton.replaceWith(
        fresh
    );


    fresh.addEventListener(
        "click",
        handler
    );


    return fresh;
}


async function cvmV06CreateNew() {
    const response =
        await cvmV06Api()
            ?.create_new_project
            ?.();


    if (
        !response?.ok
    ) {
        cvmV06ShowToast(
            response?.message
            || "Unable to create a new CV.",
            "error"
        );

        return;
    }


    if (
        typeof loadProjectIntoUI
        === "function"
    ) {
        loadProjectIntoUI(
            response.project
        );
    }


    cvmV06SetProjectActive(
        true
    );


    cvmV06OpenEditor({
        askLanguage: true,
        tab: "content",
    });
}


async function cvmV06OpenProject() {
    const api =
        cvmV06Api();


    if (
        !api
    ) {
        return;
    }


    const finish =
        async (
            response
        ) => {

            if (
                !response?.ok
            ) {
                if (
                    !response?.cancelled
                ) {
                    cvmV06ShowToast(
                        response?.message
                        || "Unable to open project.",
                        "error"
                    );
                }

                return;
            }


            if (
                typeof loadProjectIntoUI
                === "function"
            ) {
                loadProjectIntoUI(
                    response.project
                );
            }


            cvmV06SetProjectActive(
                true
            );


            cvmV06OpenEditor({
                askLanguage: true,
                tab: "content",
            });
        };


    if (
        typeof cvmOpenBrowser
        === "function"
        && api.load_project_path
    ) {
        await cvmOpenBrowser(
            "project",
            "",
            async (
                path
            ) =>
                finish(
                    await api.load_project_path(
                        path
                    )
                )
        );

        return;
    }


    await finish(
        await api.open_project
            ?.()
    );
}


async function cvmV06LoadDemo() {
    const response =
        await cvmV06Api()
            ?.load_demo_project
            ?.();


    if (
        !response?.ok
    ) {
        cvmV06ShowToast(
            response?.message
            || "Unable to load the demo CV.",
            "error"
        );

        return;
    }


    if (
        typeof loadProjectIntoUI
        === "function"
    ) {
        loadProjectIntoUI(
            response.project
        );
    }


    cvmV06SetProjectActive(
        true
    );


    cvmV06OpenEditor({
        askLanguage: true,
        tab: "content",
    });
}


function cvmV06InstallHomeActions() {
    cvmV06ReplaceButton(
        "newCvBtn",
        cvmV06CreateNew
    );


    cvmV06ReplaceButton(
        "openProjectBtn",
        cvmV06OpenProject
    );


    cvmV06ReplaceButton(
        "demoBtn",
        cvmV06LoadDemo
    );


    const heroActions =
        document.querySelector(
            "#page-home .hero-actions"
        );


    if (
        heroActions
        && !document.querySelector(
            "#cvmModifyCvBtn"
        )
    ) {
        const modify =
            document.createElement(
                "button"
            );


        modify.id =
            "cvmModifyCvBtn";

        modify.type =
            "button";

        modify.className =
            "secondary-button";

        modify.textContent =
            cvmV06Text(
                "Modify CV",
                "Modifier le CV"
            );


        modify.addEventListener(
            "click",
            () =>
                cvmV06OpenEditor({
                    askLanguage: false,
                    tab: "content",
                })
        );


        heroActions.appendChild(
            modify
        );
    }


    cvmV06RefreshModifyButton();
}


function cvmV06RefreshModifyButton() {
    const active =
        cvmV06ProjectActive();


    document.body.classList.toggle(
        "cvm-has-project",
        active
    );


    const button =
        document.querySelector(
            "#cvmModifyCvBtn"
        );


    if (
        button
    ) {
        button.style.display =
            active
                ? ""
                : "none";
    }
}


function cvmV06ShowMainPage(pageName) {
    const manager =
        pageName === "exports-manager"
        || pageName === "logs-manager";


    if (
        manager
    ) {
        document
            .querySelectorAll(
                ".main-content > .page"
            )
            .forEach(
                (
                    page
                ) =>
                    page.classList.remove(
                        "active"
                    )
            );


        document
            .querySelector(
                `#page-${pageName}`
            )
            ?.classList.add(
                "active"
            );


        document
            .querySelectorAll(
                ".nav-item"
            )
            .forEach(
                (
                    button
                ) =>
                    button.classList.remove(
                        "active"
                    )
            );


        (
            pageName === "exports-manager"
                ? document.querySelector(
                    "#openExportsBtn"
                )
                : document.querySelector(
                    "#openLogsBtn"
                )
        )
            ?.classList.add(
                "active"
            );


        return;
    }


    if (
        cvmV06.baseShowPage
    ) {
        cvmV06.baseShowPage(
            pageName
        );

        return;
    }


    document
        .querySelectorAll(
            ".main-content > .page"
        )
        .forEach(
            (
                page
            ) => {

                page.classList.toggle(
                    "active",
                    page.id
                    === `page-${pageName}`
                );
            }
        );
}


function cvmV06PatchShowPage() {
    if (
        typeof showPage
        !== "function"
    ) {
        return;
    }


    cvmV06.baseShowPage =
        showPage;


    showPage =
        function (
            pageName
        ) {
            if (
                pageName === "content"
                || pageName === "design"
            ) {
                cvmV06OpenEditor({
                    askLanguage: false,
                    tab: pageName,
                });

                return;
            }


            return cvmV06.baseShowPage(
                pageName
            );
        };
}


// ===========================================================
// SPACING EDITOR
// ===========================================================

function cvmV06SpacingRange(key) {
    if (
        key.endsWith(
            "_line_height"
        )
        || key === "body_line_height"
    ) {
        return {
            min: 0.95,
            max: 1.65,
            step: 0.01,
            unit: "×",
        };
    }


    if (
        key.startsWith(
            "page_"
        )
    ) {
        return {
            min:
                key.includes(
                    "left"
                )
                || key.includes(
                    "right"
                )
                    ? 5
                    : 3,

            max: 25,
            step: 0.5,
            unit: "mm",
        };
    }


    return {
        min: 0,
        max: 8,
        step: 0.1,
        unit: "mm",
    };
}


function cvmV06SpacingControl(
    key,
    label
) {
    const range =
        cvmV06SpacingRange(
            key
        );


    const value =
        Number(
            state?.project
                ?.design
                ?.spacing
                ?.[key]
            ?? CVM_V06_SPACING_DEFAULTS[key]
            ?? 0
        );


    return `
        <label class="cvm-spacing-control">

            <span>
                ${cvmV06Escape(
                    label
                )}
            </span>

            <input
                type="range"
                min="${range.min}"
                max="${range.max}"
                step="${range.step}"
                value="${value}"
                data-v06-spacing-key="${key}"
            >

            <output
                class="cvm-spacing-value"
                data-v06-spacing-output="${key}"
            >
                ${value}${range.unit}
            </output>

        </label>
    `;
}


function cvmV06EnsureSpacingEditor() {
    const grid =
        document.querySelector(
            "#page-design .settings-grid"
        );


    if (
        !grid
        || !state?.project
    ) {
        return;
    }


    cvmV06EnsureDesign();


    let card =
        document.querySelector(
            "#cvmV06SpacingCard"
        );


    if (
        !card
    ) {
        card =
            document.createElement(
                "section"
            );


        card.id =
            "cvmV06SpacingCard";

        card.className =
            "settings-card cvm-spacing-card";


        grid.prepend(
            card
        );
    }


    const groups = [
        {
            title:
                cvmV06Text(
                    "Whole page",
                    "Page entière"
                ),

            controls: [
                [
                    "page_top_mm",
                    cvmV06Text(
                        "Top margin",
                        "Marge haute"
                    ),
                ],
                [
                    "page_bottom_mm",
                    cvmV06Text(
                        "Bottom margin",
                        "Marge basse"
                    ),
                ],
                [
                    "page_left_mm",
                    cvmV06Text(
                        "Left margin",
                        "Marge gauche"
                    ),
                ],
                [
                    "page_right_mm",
                    cvmV06Text(
                        "Right margin",
                        "Marge droite"
                    ),
                ],
                [
                    "body_line_height",
                    cvmV06Text(
                        "Global line spacing",
                        "Interligne global"
                    ),
                ],
                [
                    "section_gap_mm",
                    cvmV06Text(
                        "Space between sections",
                        "Espace entre sections"
                    ),
                ],
                [
                    "entry_gap_mm",
                    cvmV06Text(
                        "Space between entries",
                        "Espace entre entrées"
                    ),
                ],
                [
                    "bullet_gap_mm",
                    cvmV06Text(
                        "Space between bullets",
                        "Espace entre puces"
                    ),
                ],
            ],
        },
        {
            title:
                cvmV06Text(
                    "Section titles",
                    "Titres des sections"
                ),

            controls: [
                [
                    "title_before_mm",
                    cvmV06Text(
                        "Space before title",
                        "Espace avant le titre"
                    ),
                ],
                [
                    "title_after_mm",
                    cvmV06Text(
                        "Title → separator",
                        "Titre → séparateur"
                    ),
                ],
                [
                    "separator_gap_mm",
                    cvmV06Text(
                        "Separator → content",
                        "Séparateur → contenu"
                    ),
                ],
            ],
        },
    ];


    const labels = {
        profile:
            cvmV06Text(
                "Profile",
                "Profil"
            ),

        experiences:
            cvmV06Text(
                "Experience",
                "Expérience"
            ),

        education:
            cvmV06Text(
                "Education",
                "Formation"
            ),

        projects:
            cvmV06Text(
                "Projects",
                "Projets"
            ),

        volunteering:
            cvmV06Text(
                "Volunteering",
                "Bénévolat"
            ),

        skills:
            cvmV06Text(
                "Skills",
                "Compétences"
            ),

        languages:
            cvmV06Text(
                "Languages",
                "Langues"
            ),

        certifications:
            cvmV06Text(
                "Certifications",
                "Certifications"
            ),
    };


    for (
        const section
        of CVM_V06_SECTIONS
    ) {
        groups.push({
            title:
                labels[
                    section
                ],

            controls: [
                [
                    `${section}_before_mm`,
                    cvmV06Text(
                        "Space before section",
                        "Espace avant la section"
                    ),
                ],
                [
                    `${section}_after_mm`,
                    cvmV06Text(
                        "Space after section",
                        "Espace après la section"
                    ),
                ],
                [
                    `${section}_line_height`,
                    cvmV06Text(
                        "Internal line spacing",
                        "Interligne interne"
                    ),
                ],
            ],
        });
    }


    card.innerHTML = `
        <div class="section-order-heading">

            <div>

                <h2>
                    ${cvmV06Text(
                        "Spacing editor",
                        "Éditeur d'espacements"
                    )}
                </h2>

                <p class="cvm-spacing-intro">
                    ${cvmV06Text(
                        "Fine-tune page margins, section spacing, titles, entries, bullets and line spacing.",
                        "Ajustez les marges, les sections, les titres, les entrées, les puces et les interlignes."
                    )}
                </p>

            </div>


            <button
                id="cvmV06ResetSpacing"
                type="button"
                class="secondary-button"
            >
                ${cvmV06Text(
                    "Reset spacing",
                    "Réinitialiser"
                )}
            </button>

        </div>


        ${groups
            .map(
                (
                    group
                ) => `
                    <div class="cvm-spacing-group">

                        <div class="cvm-spacing-group-header">

                            <strong>
                                ${cvmV06Escape(
                                    group.title
                                )}
                            </strong>

                        </div>


                        <div class="cvm-spacing-grid">

                            ${group.controls
                                .map(
                                    (
                                        [
                                            key,
                                            label
                                        ]
                                    ) =>
                                        cvmV06SpacingControl(
                                            key,
                                            label
                                        )
                                )
                                .join(
                                    ""
                                )}

                        </div>

                    </div>
                `
            )
            .join(
                ""
            )}
    `;


    card
        .querySelectorAll(
            "[data-v06-spacing-key]"
        )
        .forEach(
            (
                input
            ) => {

                input.addEventListener(
                    "input",
                    () => {
                        const key =
                            input.dataset
                                .v06SpacingKey;


                        const value =
                            Number(
                                input.value
                            );


                        const range =
                            cvmV06SpacingRange(
                                key
                            );


                        state.project
                            .design
                            .spacing[
                                key
                            ] =
                            value;


                        const output =
                            card.querySelector(
                                `[data-v06-spacing-output="${key}"]`
                            );


                        if (
                            output
                        ) {
                            output.textContent =
                                `${value}${range.unit}`;
                        }


                        if (
                            typeof projectChanged
                            === "function"
                        ) {
                            projectChanged();
                        }


                        if (
                            typeof renderPreview
                            === "function"
                        ) {
                            renderPreview();
                        }
                    }
                );
            }
        );


    card
        .querySelector(
            "#cvmV06ResetSpacing"
        )
        ?.addEventListener(
            "click",
            () => {

                state.project.design.spacing =
                    cvmV06Clone(
                        CVM_V06_SPACING_DEFAULTS
                    );


                cvmV06EnsureSpacingEditor();


                if (
                    typeof projectChanged
                    === "function"
                ) {
                    projectChanged();
                }


                if (
                    typeof renderPreview
                    === "function"
                ) {
                    renderPreview();
                }
            }
        );
}


// ===========================================================
// DATE / YEAR PICKERS
// ===========================================================

function cvmV06ParseMonthYear(value) {
    const text =
        String(
            value || ""
        )
            .trim()
            .replace(
                /\/+/g,
                "/"
            );


    let match =
        text.match(
            /^(0?[1-9]|1[0-2])\/(\d{4})$/
        );


    if (
        match
    ) {
        return {
            month:
                Number(
                    match[1]
                ),

            year:
                Number(
                    match[2]
                ),
        };
    }


    match =
        text.match(
            /^(\d{4})-(0?[1-9]|1[0-2])$/
        );


    if (
        match
    ) {
        return {
            month:
                Number(
                    match[2]
                ),

            year:
                Number(
                    match[1]
                ),
        };
    }


    match =
        text.match(
            /^(\d{4})$/
        );


    if (
        match
    ) {
        return {
            month: null,
            year:
                Number(
                    match[1]
                ),
        };
    }


    return {
        month: null,
        year: null,
    };
}


function cvmV06DisplayMonthYear(raw) {
    const parsed =
        cvmV06ParseMonthYear(
            raw
        );


    if (
        !parsed.year
    ) {
        return String(
            raw || ""
        );
    }


    if (
        !parsed.month
    ) {
        return String(
            parsed.year
        );
    }


    return (
        `${CVM_V06_MONTHS[
            cvmV06CvLanguage()
        ][
            parsed.month
        ]} ${parsed.year}`
    );
}


function cvmV06FormatRange(
    start,
    end,
    current = false
) {
    const lang =
        cvmV06CvLanguage();


    const a =
        cvmV06ParseMonthYear(
            start
        );


    const b =
        cvmV06ParseMonthYear(
            end
        );


    const present =
        lang === "fr"
            ? "Présent"
            : "Present";


    if (
        current
    ) {
        const startText =
            cvmV06DisplayMonthYear(
                start
            );


        return startText
            ? `${startText} - ${present}`
            : present;
    }


    if (
        !a.year
        && !b.year
    ) {
        return [
            start,
            end
        ]
            .filter(
                Boolean
            )
            .join(
                " - "
            );
    }


    if (
        a.year
        && !b.year
    ) {
        return cvmV06DisplayMonthYear(
            start
        );
    }


    if (
        !a.year
        && b.year
    ) {
        return cvmV06DisplayMonthYear(
            end
        );
    }


    if (
        a.year === b.year
        && a.month
        && b.month
    ) {
        if (
            a.month === b.month
        ) {
            return (
                `${CVM_V06_MONTHS[
                    lang
                ][
                    a.month
                ]} ${a.year}`
            );
        }


        return (
            `${CVM_V06_MONTHS[
                lang
            ][
                a.month
            ]} - ${CVM_V06_MONTHS[
                lang
            ][
                b.month
            ]} ${a.year}`
        );
    }


    if (
        a.year === b.year
        && !a.month
        && !b.month
    ) {
        return String(
            a.year
        );
    }


    return (
        `${cvmV06DisplayMonthYear(
            start
        )} - ${cvmV06DisplayMonthYear(
            end
        )}`
    );
}


function cvmV06ExtractYear(value) {
    const matches =
        String(
            value || ""
        )
            .match(
                /(?:19|20|21)\d{2}/g
            );


    return matches?.length
        ? matches[
            matches.length - 1
        ]
        : "";
}


function cvmV06BuildPickers() {
    if (
        !document.querySelector(
            "#cvmV06MonthPicker"
        )
    ) {
        const picker =
            document.createElement(
                "div"
            );


        picker.id =
            "cvmV06MonthPicker";

        picker.className =
            "cvm-picker-popover";


        document.body.appendChild(
            picker
        );
    }


    if (
        !document.querySelector(
            "#cvmV06YearPicker"
        )
    ) {
        const picker =
            document.createElement(
                "div"
            );


        picker.id =
            "cvmV06YearPicker";

        picker.className =
            "cvm-picker-popover";


        document.body.appendChild(
            picker
        );
    }


    document.addEventListener(
        "pointerdown",
        (
            event
        ) => {

            if (
                !event.target.closest(
                    ".cvm-picker-popover"
                )
                && !event.target.closest(
                    ".cvm-month-field"
                )
                && !event.target.closest(
                    ".cvm-year-field"
                )
            ) {
                cvmV06ClosePickers();
            }
        }
    );
}


function cvmV06PositionPicker(
    picker,
    input
) {
    const rect =
        input.getBoundingClientRect();


    const width =
        300;


    let left =
        rect.left;


    let top =
        rect.bottom + 7;


    if (
        left + width
        > window.innerWidth - 12
    ) {
        left =
            window.innerWidth
            - width
            - 12;
    }


    if (
        top + 330
        > window.innerHeight - 12
    ) {
        top =
            Math.max(
                12,
                rect.top - 330
            );
    }


    picker.style.left =
        `${Math.max(
            12,
            left
        )}px`;


    picker.style.top =
        `${top}px`;
}


function cvmV06DynamicItem(input) {
    const collection =
        input.dataset
            .collection;


    const index =
        Number(
            input.dataset
                .index
        );


    if (
        !collection
        || Number.isNaN(
            index
        )
        || !state?.project
            ?.[collection]
            ?.[index]
    ) {
        return null;
    }


    return state.project[
        collection
    ][
        index
    ];
}


function cvmV06SetDynamicValue(
    input,
    raw
) {
    const item =
        cvmV06DynamicItem(
            input
        );


    const key =
        input.dataset
            .key;


    if (
        !item
        || !key
    ) {
        return;
    }


    item[
        key
    ] =
        raw;


    if (
        input.dataset.collection === "projects"
        && key === "year"
    ) {
        item.date =
            raw;

        item.start_date =
            "";

        item.end_date =
            "";

        item.current =
            false;
    }


    input.dataset.raw =
        raw;


    input.value =
        key === "year"
            ? raw
            : cvmV06DisplayMonthYear(
                raw
            );


    if (
        typeof projectChanged
        === "function"
    ) {
        projectChanged();
    }


    if (
        typeof renderPreview
        === "function"
    ) {
        renderPreview();
    }
}


function cvmV06OpenMonthPicker(input) {
    const picker =
        document.querySelector(
            "#cvmV06MonthPicker"
        );


    if (
        !picker
    ) {
        return;
    }


    cvmV06ClosePickers();


    cvmV06.monthTarget =
        input;


    const raw =
        input.dataset.raw
        || cvmV06DynamicItem(
            input
        )?.[
            input.dataset.key
        ]
        || "";


    const parsed =
        cvmV06ParseMonthYear(
            raw
        );


    cvmV06.pickerYear =
        parsed.year
        || new Date()
            .getFullYear();


    cvmV06RenderMonthPicker();


    cvmV06PositionPicker(
        picker,
        input
    );


    picker.classList.add(
        "visible"
    );
}


function cvmV06RenderMonthPicker() {
    const picker =
        document.querySelector(
            "#cvmV06MonthPicker"
        );


    const input =
        cvmV06.monthTarget;


    if (
        !picker
        || !input
    ) {
        return;
    }


    const selected =
        cvmV06ParseMonthYear(
            input.dataset.raw
            || cvmV06DynamicItem(
                input
            )?.[
                input.dataset.key
            ]
            || ""
        );


    const lang =
        cvmV06CvLanguage();


    picker.innerHTML = `
        <div class="cvm-picker-head">

            <button
                class="cvm-picker-nav"
                type="button"
                data-v06-year-delta="-1"
            >
                ‹
            </button>

            <strong>
                ${cvmV06.pickerYear}
            </strong>

            <button
                class="cvm-picker-nav"
                type="button"
                data-v06-year-delta="1"
            >
                ›
            </button>

        </div>


        <div class="cvm-month-grid">

            ${CVM_V06_MONTHS[
                lang
            ]
                .slice(
                    1
                )
                .map(
                    (
                        name,
                        index
                    ) => {

                        const month =
                            index + 1;


                        const selectedClass =
                            selected.year === cvmV06.pickerYear
                            && selected.month === month
                                ? "selected"
                                : "";


                        return `
                            <button
                                type="button"
                                class="cvm-month-option ${selectedClass}"
                                data-v06-month="${month}"
                            >
                                ${cvmV06Escape(
                                    name.slice(
                                        0,
                                        3
                                    )
                                )}
                            </button>
                        `;
                    }
                )
                .join(
                    ""
                )}

        </div>


        <div class="cvm-picker-footer">

            <button
                type="button"
                data-v06-picker-clear
            >
                ${cvmV06Text(
                    "Clear",
                    "Effacer"
                )}
            </button>


            <button
                type="button"
                data-v06-picker-today
            >
                ${cvmV06Text(
                    "This month",
                    "Ce mois"
                )}
            </button>

        </div>
    `;


    picker
        .querySelectorAll(
            "[data-v06-year-delta]"
        )
        .forEach(
            (
                button
            ) => {

                button.addEventListener(
                    "click",
                    () => {

                        cvmV06.pickerYear +=
                            Number(
                                button.dataset
                                    .v06YearDelta
                            );


                        cvmV06RenderMonthPicker();
                    }
                );
            }
        );


    picker
        .querySelectorAll(
            "[data-v06-month]"
        )
        .forEach(
            (
                button
            ) => {

                button.addEventListener(
                    "click",
                    () => {

                        const month =
                            String(
                                Number(
                                    button.dataset
                                        .v06Month
                                )
                            )
                                .padStart(
                                    2,
                                    "0"
                                );


                        cvmV06SetDynamicValue(
                            input,
                            `${month}/${cvmV06.pickerYear}`
                        );


                        cvmV06ClosePickers();
                    }
                );
            }
        );


    picker
        .querySelector(
            "[data-v06-picker-clear]"
        )
        ?.addEventListener(
            "click",
            () => {

                cvmV06SetDynamicValue(
                    input,
                    ""
                );


                cvmV06ClosePickers();
            }
        );


    picker
        .querySelector(
            "[data-v06-picker-today]"
        )
        ?.addEventListener(
            "click",
            () => {

                const now =
                    new Date();


                cvmV06SetDynamicValue(
                    input,
                    `${String(
                        now.getMonth() + 1
                    ).padStart(
                        2,
                        "0"
                    )}/${now.getFullYear()}`
                );


                cvmV06ClosePickers();
            }
        );
}


function cvmV06OpenYearPicker(input) {
    const picker =
        document.querySelector(
            "#cvmV06YearPicker"
        );


    if (
        !picker
    ) {
        return;
    }


    cvmV06ClosePickers();


    cvmV06.yearTarget =
        input;


    const current =
        Number(
            input.value
        );


    cvmV06.yearPageStart =
        Number.isInteger(
            current
        )
        && current >= 1900
        && current <= 2200

            ? current - 5

            : new Date()
                .getFullYear() - 5;


    cvmV06RenderYearPicker();


    cvmV06PositionPicker(
        picker,
        input
    );


    picker.classList.add(
        "visible"
    );
}


function cvmV06RenderYearPicker() {
    const picker =
        document.querySelector(
            "#cvmV06YearPicker"
        );


    const input =
        cvmV06.yearTarget;


    if (
        !picker
        || !input
    ) {
        return;
    }


    const selected =
        Number(
            input.value
        );


    const years =
        Array.from(
            {
                length: 12
            },
            (
                _,
                index
            ) =>
                cvmV06.yearPageStart
                + index
        );


    picker.innerHTML = `
        <div class="cvm-picker-head">

            <button
                class="cvm-picker-nav"
                type="button"
                data-v06-year-page="-12"
            >
                ‹
            </button>


            <strong>
                ${years[0]}
                –
                ${years[
                    years.length - 1
                ]}
            </strong>


            <button
                class="cvm-picker-nav"
                type="button"
                data-v06-year-page="12"
            >
                ›
            </button>

        </div>


        <div class="cvm-year-grid">

            ${years
                .map(
                    (
                        year
                    ) => `
                        <button
                            type="button"
                            class="cvm-year-option ${
                                selected === year
                                    ? "selected"
                                    : ""
                            }"
                            data-v06-pick-year="${year}"
                        >
                            ${year}
                        </button>
                    `
                )
                .join(
                    ""
                )}

        </div>


        <div class="cvm-picker-footer">

            <button
                type="button"
                data-v06-picker-clear
            >
                ${cvmV06Text(
                    "Clear",
                    "Effacer"
                )}
            </button>


            <span>
                ${cvmV06Text(
                    "You can also type YYYY.",
                    "Vous pouvez aussi saisir YYYY."
                )}
            </span>

        </div>
    `;


    picker
        .querySelectorAll(
            "[data-v06-year-page]"
        )
        .forEach(
            (
                button
            ) => {

                button.addEventListener(
                    "click",
                    () => {

                        cvmV06.yearPageStart +=
                            Number(
                                button.dataset
                                    .v06YearPage
                            );


                        cvmV06RenderYearPicker();
                    }
                );
            }
        );


    picker
        .querySelectorAll(
            "[data-v06-pick-year]"
        )
        .forEach(
            (
                button
            ) => {

                button.addEventListener(
                    "click",
                    () => {

                        cvmV06SetDynamicValue(
                            input,
                            button.dataset
                                .v06PickYear
                        );


                        cvmV06ClosePickers();
                    }
                );
            }
        );


    picker
        .querySelector(
            "[data-v06-picker-clear]"
        )
        ?.addEventListener(
            "click",
            () => {

                cvmV06SetDynamicValue(
                    input,
                    ""
                );


                cvmV06ClosePickers();
            }
        );
}


function cvmV06ClosePickers() {
    document
        .querySelectorAll(
            ".cvm-picker-popover"
        )
        .forEach(
            (
                picker
            ) =>
                picker.classList.remove(
                    "visible"
                )
        );


    cvmV06.monthTarget =
        null;


    cvmV06.yearTarget =
        null;
}


function cvmV06UpgradeMonthInput(input) {
    if (
        !input
        || input.dataset
            .v06MonthEnhanced === "true"
    ) {
        return;
    }


    const item =
        cvmV06DynamicItem(
            input
        );


    if (
        !item
    ) {
        return;
    }


    input.dataset.v06MonthEnhanced =
        "true";


    const raw =
        item[
            input.dataset.key
        ]
        || input.value
        || "";


    input.type =
        "text";

    input.readOnly =
        true;

    input.autocomplete =
        "off";


    input.classList.add(
        "cvm-month-field"
    );


    input.dataset.raw =
        raw;


    input.value =
        cvmV06DisplayMonthYear(
            raw
        );


    input.addEventListener(
        "click",
        () =>
            cvmV06OpenMonthPicker(
                input
            )
    );


    input.addEventListener(
        "keydown",
        (
            event
        ) => {

            if (
                [
                    "Enter",
                    " ",
                    "ArrowDown",
                ]
                    .includes(
                        event.key
                    )
            ) {
                event.preventDefault();


                cvmV06OpenMonthPicker(
                    input
                );
            }
        }
    );
}


function cvmV06UpgradeYearInput(
    input,
    {
        projectYear = false,
        warningEn = "Year must use YYYY.",
        warningFr = "L'année doit utiliser YYYY.",
    } = {}
) {
    if (
        !input
        || input.dataset
            .v06YearEnhanced === "true"
    ) {
        return;
    }


    input.dataset.v06YearEnhanced =
        "true";


    input.classList.remove(
        "cvm-month-field"
    );


    input.classList.add(
        "cvm-year-field"
    );


    input.type =
        "text";

    input.readOnly =
        false;

    input.autocomplete =
        "off";

    input.inputMode =
        "numeric";

    input.maxLength =
        4;

    input.placeholder =
        "YYYY";


    if (
        projectYear
    ) {
        const item =
            cvmV06DynamicItem(
                input
            );


        if (
            item
        ) {
            const year =
                cvmV06ExtractYear(
                    item.year
                )
                || cvmV06ExtractYear(
                    item.date
                )
                || cvmV06ExtractYear(
                    item.end_date
                )
                || cvmV06ExtractYear(
                    item.start_date
                );


            item.year =
                year;

            item.date =
                year;

            item.start_date =
                "";

            item.end_date =
                "";

            item.current =
                false;

            input.value =
                year;
        }
    }


    input.addEventListener(
        "focus",
        () =>
            cvmV06OpenYearPicker(
                input
            )
    );


    input.addEventListener(
        "click",
        () =>
            cvmV06OpenYearPicker(
                input
            )
    );


    input.addEventListener(
        "input",
        () => {

            input.value =
                input.value
                    .replace(
                        /\D/g,
                        ""
                    )
                    .slice(
                        0,
                        4
                    );


            if (
                projectYear
            ) {
                const item =
                    cvmV06DynamicItem(
                        input
                    );


                if (
                    item
                ) {
                    item.year =
                        input.value;

                    item.date =
                        input.value;

                    item.start_date =
                        "";

                    item.end_date =
                        "";

                    item.current =
                        false;


                    if (
                        typeof projectChanged
                        === "function"
                    ) {
                        projectChanged();
                    }


                    if (
                        typeof renderPreview
                        === "function"
                    ) {
                        renderPreview();
                    }
                }
            }
        }
    );


    input.addEventListener(
        "blur",
        () => {

            if (
                input.value
                && !/^\d{4}$/.test(
                    input.value
                )
            ) {
                cvmV06ShowToast(
                    cvmV06Text(
                        warningEn,
                        warningFr
                    ),
                    "warning"
                );
            }
        }
    );
}


function cvmV06UpgradeProjectYears() {
    const indexes =
        new Set();


    document
        .querySelectorAll(
            'input[data-collection="projects"][data-index]'
        )
        .forEach(
            (
                input
            ) =>
                indexes.add(
                    Number(
                        input.dataset.index
                    )
                )
        );


    for (
        const index
        of indexes
    ) {
        const item =
            state?.project
                ?.projects
                ?.[index];


        if (
            !item
        ) {
            continue;
        }


        const candidates =
            Array.from(
                document.querySelectorAll(
                    `input[data-collection="projects"][data-index="${index}"]`
                )
            )
                .filter(
                    (
                        input
                    ) =>
                        [
                            "year",
                            "date",
                            "start_date",
                            "end_date",
                        ]
                            .includes(
                                input.dataset.key
                            )
                );


        if (
            !candidates.length
        ) {
            continue;
        }


        const input =
            candidates.find(
                (
                    candidate
                ) =>
                    candidate.dataset.key
                    === "year"
            )
            || candidates.find(
                (
                    candidate
                ) =>
                    candidate.dataset.key
                    === "date"
            )
            || candidates[0];


        const label =
            input.closest(
                "label.field"
            );


        if (
            !label
        ) {
            continue;
        }


        candidates.forEach(
            (
                candidate
            ) => {

                if (
                    candidate !== input
                ) {
                    candidate
                        .closest(
                            "label.field"
                        )
                        ?.remove();
                }
            }
        );


        const firstLabel =
            label.querySelector(
                ":scope > span"
            );


        if (
            firstLabel
        ) {
            firstLabel.textContent =
                cvmV06Text(
                    "Year",
                    "Année"
                );
        }


        input.dataset.key =
            "year";


        input.removeAttribute(
            "min"
        );

        input.removeAttribute(
            "max"
        );


        const year =
            cvmV06ExtractYear(
                item.year
            )
            || cvmV06ExtractYear(
                item.date
            )
            || cvmV06ExtractYear(
                item.end_date
            )
            || cvmV06ExtractYear(
                item.start_date
            );


        item.year =
            year;

        item.date =
            year;

        item.start_date =
            "";

        item.end_date =
            "";

        item.current =
            false;

        input.value =
            year;


        cvmV06UpgradeYearInput(
            input,
            {
                projectYear:
                    true,

                warningEn:
                    "Project year must use YYYY.",

                warningFr:
                    "L'année du projet doit utiliser YYYY.",
            }
        );
    }
}


function cvmV06UpgradeCertificationYears() {
    document
        .querySelectorAll(
            'input[data-collection="certifications"][data-key="year"]'
        )
        .forEach(
            (
                input
            ) => {

                cvmV06UpgradeYearInput(
                    input,
                    {
                        warningEn:
                            "Certification year must use YYYY.",

                        warningFr:
                            "L'année de certification doit utiliser YYYY.",
                    }
                );
            }
        );
}


function cvmV06EnhanceDateFields() {
    cvmV06UpgradeProjectYears();


    document
        .querySelectorAll(
            'input[data-key="start_date"]:not([data-collection="projects"]), input[data-key="end_date"]:not([data-collection="projects"])'
        )
        .forEach(
            cvmV06UpgradeMonthInput
        );


    cvmV06UpgradeCertificationYears();
}


// ===========================================================
// SOCIAL LINKS
// ===========================================================

function cvmV06RefreshSocialHints() {
    const fields = [
        [
            "linkedin",
            "https://linkedin.com/in/your-profile",
            cvmV06Text(
                "Prefer the full LinkedIn URL, not only your name.",
                "Utilisez de préférence le lien LinkedIn complet, pas seulement votre nom."
            ),
        ],
        [
            "github",
            "https://github.com/username",
            cvmV06Text(
                "Prefer the full GitHub profile URL.",
                "Utilisez de préférence le lien complet de votre profil GitHub."
            ),
        ],
        [
            "website",
            "https://example.com",
            cvmV06Text(
                "Use the full clickable website URL.",
                "Utilisez l'URL complète et cliquable du site."
            ),
        ],
    ];


    for (
        const [
            id,
            example,
            normalText,
        ]
        of fields
    ) {
        const input =
            document.querySelector(
                `#${id}`
            );


        if (
            !input
        ) {
            continue;
        }


        input.placeholder =
            example;


        const field =
            input.closest(
                "label.field"
            );


        if (
            !field
        ) {
            continue;
        }


        let hint =
            field.querySelector(
                ".cvm-social-hint"
            );


        if (
            !hint
        ) {
            hint =
                document.createElement(
                    "small"
                );

            hint.className =
                "cvm-social-hint";

            field.appendChild(
                hint
            );
        }


        const validate =
            () => {

                const value =
                    input.value
                        .trim();


                const valid =
                    !value
                    || /^https?:\/\//i.test(
                        value
                    );


                hint.textContent =
                    valid
                        ? normalText
                        : cvmV06Text(
                            "Use a full link starting with https://",
                            "Utilisez un lien complet commençant par https://"
                        );


                hint.classList.toggle(
                    "warning",
                    !valid
                );
            };


        if (
            input.dataset
                .v06SocialBound !== "true"
        ) {
            input.dataset.v06SocialBound =
                "true";


            input.addEventListener(
                "input",
                validate
            );


            input.addEventListener(
                "blur",
                validate
            );
        }


        validate();
    }
}


// ===========================================================
// PREVIEW
// ===========================================================

function cvmV06FixPreviewDates() {
    const preview =
        document.querySelector(
            "#cvPreview"
        );


    if (
        !preview
        || !state?.project
    ) {
        return;
    }


    const formatted =
        [];


    for (
        const item
        of state.project.experiences || []
    ) {
        formatted.push(
            cvmV06FormatRange(
                item.start_date,
                item.end_date,
                Boolean(
                    item.current
                )
            )
        );
    }


    for (
        const item
        of state.project.education || []
    ) {
        formatted.push(
            cvmV06FormatRange(
                item.start_date,
                item.end_date,
                false
            )
        );
    }


    for (
        const item
        of state.project.projects || []
    ) {
        formatted.push(
            cvmV06ExtractYear(
                item.year
            )
            || cvmV06ExtractYear(
                item.date
            )
            || cvmV06ExtractYear(
                item.end_date
            )
            || cvmV06ExtractYear(
                item.start_date
            )
        );
    }


    for (
        const item
        of state.project.volunteering || []
    ) {
        formatted.push(
            cvmV06FormatRange(
                item.start_date,
                item.end_date,
                false
            )
        );
    }


    const spans =
        Array.from(
            preview.querySelectorAll(
                ".preview-entry-header > span:last-child"
            )
        );


    for (
        let index = 0;
        index < Math.min(
            spans.length,
            formatted.length
        );
        index += 1
    ) {
        spans[index].textContent =
            formatted[index] || "";
    }
}


function cvmV06PatchPreview() {
    if (
        typeof renderPreview
        !== "function"
        || cvmV06.baseRenderPreview
    ) {
        return;
    }


    cvmV06.baseRenderPreview =
        renderPreview;


    renderPreview =
        function (
            ...args
        ) {
            const result =
                cvmV06.baseRenderPreview
                    .apply(
                        this,
                        args
                    );


            queueMicrotask(
                cvmV06FixPreviewDates
            );


            return result;
        };
}


function cvmV06EnhanceEditorFields() {
    cvmV06EnhanceDateFields();

    cvmV06RefreshSocialHints();
}


function cvmV06PatchDynamicRenderer() {
    if (
        typeof renderDynamicSections
        !== "function"
        || cvmV06.baseRenderDynamicSections
    ) {
        return;
    }


    cvmV06.baseRenderDynamicSections =
        renderDynamicSections;


    renderDynamicSections =
        function (
            ...args
        ) {
            const result =
                cvmV06
                    .baseRenderDynamicSections
                    .apply(
                        this,
                        args
                    );


            queueMicrotask(
                cvmV06EnhanceEditorFields
            );


            return result;
        };
}


// ===========================================================
// EXPORTS / LOGS PAGES
// ===========================================================

function cvmV06BuildManagerPages() {
    const main =
        document.querySelector(
            ".main-content"
        );


    if (
        !main
    ) {
        return;
    }


    if (
        !document.querySelector(
            "#page-exports-manager"
        )
    ) {
        const page =
            document.createElement(
                "section"
            );


        page.id =
            "page-exports-manager";

        page.className =
            "page cvm-manager-page";


        page.innerHTML = `
            <div class="page-heading">

                <div>

                    <div class="eyebrow">
                        LOCAL FILES
                    </div>

                    <h1>
                        ${cvmV06Text(
                            "Exports",
                            "Exports"
                        )}
                    </h1>

                    <p>
                        ${cvmV06Text(
                            "Generated files stay on this computer. Public CVM builds use Documents/CVM Exports by default.",
                            "Les fichiers générés restent sur cet ordinateur. Les versions publiques de CVM utilisent par défaut Documents/CVM Exports."
                        )}
                    </p>

                </div>


                <div class="cvm-manager-toolbar">

                    <button
                        id="cvmV06RefreshExports"
                        class="secondary-button"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Refresh",
                            "Actualiser"
                        )}
                    </button>

                    <button
                        id="cvmV06OpenExportsFolder"
                        class="secondary-button"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Open folder",
                            "Ouvrir le dossier"
                        )}
                    </button>

                </div>

            </div>


            <div
                id="cvmV06ExportsPath"
                class="cvm-manager-path"
            ></div>


            <div
                id="cvmV06ExportsList"
                class="cvm-manager-list"
            ></div>
        `;


        main.appendChild(
            page
        );
    }


    if (
        !document.querySelector(
            "#page-logs-manager"
        )
    ) {
        const page =
            document.createElement(
                "section"
            );


        page.id =
            "page-logs-manager";

        page.className =
            "page cvm-manager-page";


        page.innerHTML = `
            <div class="page-heading">

                <div>

                    <div class="eyebrow">
                        DIAGNOSTICS
                    </div>

                    <h1>
                        ${cvmV06Text(
                            "Logs",
                            "Journaux techniques"
                        )}
                    </h1>

                    <p>
                        ${cvmV06Text(
                            "Technical diagnostics are shown inside CVM. Log files remain local on this computer.",
                            "Les diagnostics techniques s'affichent dans CVM. Les fichiers de log restent locaux sur cet ordinateur."
                        )}
                    </p>

                </div>


                <div class="cvm-manager-toolbar">

                    <button
                        id="cvmV06RefreshLogs"
                        class="secondary-button"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Refresh",
                            "Actualiser"
                        )}
                    </button>

                    <button
                        id="cvmV06ClearVisibleLogs"
                        class="secondary-button"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Clear visible",
                            "Effacer l'affichage"
                        )}
                    </button>

                    <button
                        id="cvmV06CopyLastError"
                        class="secondary-button"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Copy last error",
                            "Copier la dernière erreur"
                        )}
                    </button>

                    <button
                        id="cvmV06OpenLogsFolder"
                        class="secondary-button"
                        type="button"
                    >
                        ${cvmV06Text(
                            "Open logs folder",
                            "Ouvrir le dossier des logs"
                        )}
                    </button>

                </div>

            </div>


            <div
                id="cvmV06LogsPath"
                class="cvm-manager-path"
            ></div>


            <section class="settings-card">

                <h2>
                    ${cvmV06Text(
                        "Current session",
                        "Session actuelle"
                    )}
                </h2>

                <div id="cvmV06LogEvents"></div>

            </section>


            <section class="settings-card">

                <h2>
                    ${cvmV06Text(
                        "Stored log files",
                        "Fichiers de log enregistrés"
                    )}
                </h2>

                <div
                    id="cvmV06LogFiles"
                    class="cvm-manager-list"
                ></div>

            </section>
        `;


        main.appendChild(
            page
        );
    }


    document
        .querySelector(
            "#cvmV06RefreshExports"
        )
        ?.addEventListener(
            "click",
            cvmV06RefreshExports
        );


    document
        .querySelector(
            "#cvmV06OpenExportsFolder"
        )
        ?.addEventListener(
            "click",
            async () =>
                await cvmV06Api()
                    ?.open_exports_folder
                    ?.()
        );


    document
        .querySelector(
            "#cvmV06RefreshLogs"
        )
        ?.addEventListener(
            "click",
            cvmV06RefreshLogs
        );


    document
        .querySelector(
            "#cvmV06OpenLogsFolder"
        )
        ?.addEventListener(
            "click",
            async () =>
                await cvmV06Api()
                    ?.open_logs_folder
                    ?.()
        );


    document
        .querySelector(
            "#cvmV06ClearVisibleLogs"
        )
        ?.addEventListener(
            "click",
            () => {
                const host =
                    document.querySelector(
                        "#cvmV06LogEvents"
                    );


                if (
                    host
                ) {
                    host.innerHTML = `
                        <p>
                            ${cvmV06Text(
                                "Visible session log cleared.",
                                "Affichage du journal de session effacé."
                            )}
                        </p>
                    `;
                }
            }
        );


    document
        .querySelector(
            "#cvmV06CopyLastError"
        )
        ?.addEventListener(
            "click",
            cvmV06CopyLastError
        );


    document.addEventListener(
        "click",
        cvmV06ManagerActionHandler
    );
}


function cvmV06ReplaceApplicationNavButtons() {
    cvmV06ReplaceButton(
        "openExportsBtn",
        async () => {
            cvmV06ShowMainPage(
                "exports-manager"
            );


            await cvmV06RefreshExports();
        }
    );


    cvmV06ReplaceButton(
        "openLogsBtn",
        async () => {
            cvmV06ShowMainPage(
                "logs-manager"
            );


            await cvmV06RefreshLogs();
        }
    );
}


async function cvmV06RefreshExports() {
    const response =
        await cvmV06Api()
            ?.list_exports
            ?.();


    if (
        !response?.ok
    ) {
        cvmV06ShowToast(
            response?.message
            || "Unable to load exports.",
            "error"
        );

        return;
    }


    const path =
        document.querySelector(
            "#cvmV06ExportsPath"
        );


    const list =
        document.querySelector(
            "#cvmV06ExportsList"
        );


    if (
        path
    ) {
        path.textContent =
            response.directory || "";
    }


    if (
        !list
    ) {
        return;
    }


    const items =
        response.items || [];


    list.innerHTML =
        items.length
            ? items
                .map(
                    (
                        item
                    ) => `
                        <article class="cvm-manager-row">

                            <div>

                                <h3>
                                    ${cvmV06Escape(
                                        item.name
                                    )}
                                </h3>

                                <div class="cvm-manager-meta">

                                    <span>
                                        ${cvmV06Escape(
                                            item.type
                                        )}
                                    </span>

                                    <span>
                                        ${cvmV06Escape(
                                            cvmV06FormatBytes(
                                                item.size_bytes
                                            )
                                        )}
                                    </span>

                                    <span>
                                        ${cvmV06Escape(
                                            item.modified_at
                                            || ""
                                        )}
                                    </span>

                                    <span>
                                        ${cvmV06Escape(
                                            item.folder
                                            || ""
                                        )}
                                    </span>

                                </div>

                            </div>


                            <div class="cvm-manager-actions">

                                <button
                                    class="secondary-button"
                                    type="button"
                                    data-v06-open-file="${cvmV06Escape(
                                        item.path
                                    )}"
                                >
                                    ${cvmV06Text(
                                        "Open",
                                        "Ouvrir"
                                    )}
                                </button>


                                <button
                                    class="secondary-button"
                                    type="button"
                                    data-v06-open-parent="${cvmV06Escape(
                                        item.path
                                    )}"
                                >
                                    ${cvmV06Text(
                                        "Open folder",
                                        "Ouvrir le dossier"
                                    )}
                                </button>

                            </div>

                        </article>
                    `
                )
                .join(
                    ""
                )

            : `
                <div class="analysis-empty">
                    ${cvmV06Text(
                        "No generated PDF or DOCX file is available yet.",
                        "Aucun fichier PDF ou DOCX généré pour le moment."
                    )}
                </div>
            `;
}


async function cvmV06RefreshLogs() {
    const response =
        await cvmV06Api()
            ?.get_logs_view
            ?.();


    if (
        !response?.ok
    ) {
        cvmV06ShowToast(
            response?.message
            || "Unable to load logs.",
            "error"
        );

        return;
    }


    const path =
        document.querySelector(
            "#cvmV06LogsPath"
        );


    const eventsHost =
        document.querySelector(
            "#cvmV06LogEvents"
        );


    const filesHost =
        document.querySelector(
            "#cvmV06LogFiles"
        );


    if (
        path
    ) {
        path.textContent =
            response.directory || "";
    }


    if (
        eventsHost
    ) {
        const events =
            response.events || [];


        eventsHost.dataset.lastErrorReport =
            response.last_error_report || "";


        eventsHost.innerHTML =
            events.length
                ? events
                    .map(
                        (
                            event
                        ) => `
                            <div class="cvm-log-event">

                                <time>
                                    ${cvmV06Escape(
                                        event.timestamp
                                        || ""
                                    )}
                                </time>

                                <span
                                    class="cvm-log-level ${cvmV06Escape(
                                        event.level
                                        || ""
                                    )}"
                                >
                                    ${cvmV06Escape(
                                        event.level
                                        || "INFO"
                                    )}
                                </span>

                                <span>
                                    ${cvmV06Escape(
                                        event.message
                                        || ""
                                    )}
                                </span>

                            </div>
                        `
                    )
                    .join(
                        ""
                    )

                : `
                    <p>
                        ${cvmV06Text(
                            "No event in this session yet.",
                            "Aucun événement dans cette session."
                        )}
                    </p>
                `;
    }


    if (
        filesHost
    ) {
        const files =
            response.files || [];


        filesHost.innerHTML =
            files.length
                ? files
                    .map(
                        (
                            file
                        ) => `
                            <article class="cvm-manager-row">

                                <div>

                                    <h3>
                                        ${cvmV06Escape(
                                            file.name
                                        )}
                                    </h3>

                                    <div class="cvm-manager-meta">

                                        <span>
                                            ${cvmV06Escape(
                                                cvmV06FormatBytes(
                                                    file.size_bytes
                                                )
                                            )}
                                        </span>

                                        <span>
                                            ${cvmV06Escape(
                                                file.modified_at
                                                || ""
                                            )}
                                        </span>

                                    </div>

                                </div>


                                <div class="cvm-manager-actions">

                                    <button
                                        type="button"
                                        class="secondary-button"
                                        data-v06-read-log="${cvmV06Escape(
                                            file.path
                                        )}"
                                    >
                                        ${cvmV06Text(
                                            "View inside CVM",
                                            "Voir dans CVM"
                                        )}
                                    </button>

                                </div>

                            </article>
                        `
                    )
                    .join(
                        ""
                    )

                : `
                    <p>
                        ${cvmV06Text(
                            "No stored log file yet.",
                            "Aucun fichier de log enregistré."
                        )}
                    </p>
                `;
    }
}


async function cvmV06CopyLastError() {
    const report =
        document
            .querySelector(
                "#cvmV06LogEvents"
            )
            ?.dataset
            .lastErrorReport
        || "";


    if (
        !report
    ) {
        cvmV06ShowToast(
            cvmV06Text(
                "No technical error report is available.",
                "Aucun rapport d'erreur technique disponible."
            ),
            "warning"
        );

        return;
    }


    try {
        await navigator.clipboard.writeText(
            report
        );


        cvmV06ShowToast(
            cvmV06Text(
                "Last error report copied.",
                "Dernier rapport d'erreur copié."
            ),
            "success"
        );

    }
    catch (
        _
    ) {
        cvmV06ShowToast(
            cvmV06Text(
                "Clipboard access is unavailable.",
                "Le presse-papiers n'est pas disponible."
            ),
            "warning"
        );
    }
}


async function cvmV06ManagerActionHandler(event) {
    const openFile =
        event.target.closest?.(
            "[data-v06-open-file]"
        );


    if (
        openFile
    ) {
        const result =
            await cvmV06Api()
                ?.open_file
                ?.(
                    openFile.dataset
                        .v06OpenFile
                );


        if (
            result
            && !result.ok
        ) {
            cvmV06ShowToast(
                result.message
                || "Unable to open file.",
                "error"
            );
        }


        return;
    }


    const openParent =
        event.target.closest?.(
            "[data-v06-open-parent]"
        );


    if (
        openParent
    ) {
        const result =
            await cvmV06Api()
                ?.open_parent_folder
                ?.(
                    openParent.dataset
                        .v06OpenParent
                );


        if (
            result
            && !result.ok
        ) {
            cvmV06ShowToast(
                result.message
                || "Unable to open folder.",
                "error"
            );
        }


        return;
    }


    const readLog =
        event.target.closest?.(
            "[data-v06-read-log]"
        );


    if (
        readLog
    ) {
        const response =
            await cvmV06Api()
                ?.read_log_file
                ?.(
                    readLog.dataset
                        .v06ReadLog
                );


        if (
            !response?.ok
        ) {
            cvmV06ShowToast(
                response?.message
                || "Unable to read log file.",
                "error"
            );

            return;
        }


        if (
            typeof cvmV05Modal
            === "function"
        ) {
            await cvmV05Modal({
                id:
                    "cvmV06LogViewerModal",

                eyebrow:
                    "LOG",

                title:
                    response.name
                    || "CVM log",

                html:
                    `<pre class="cvm-log-viewer">${cvmV06Escape(
                        response.text
                        || ""
                    )}</pre>`,

                actions: [
                    {
                        id:
                            "close",

                        label:
                            cvmV06Text(
                                "Close",
                                "Fermer"
                            ),

                        primary:
                            true,
                    },
                ],
            });
        }
    }
}


// ===========================================================
// ABOUT CVM
// ===========================================================

async function cvmV06ShowAbout() {
    const about =
        await cvmV06Api()
            ?.get_about
            ?.();


    if (
        !about?.ok
        || typeof cvmV05Modal
        !== "function"
    ) {
        return;
    }


    const version =
        cvmV06Escape(
            about.version
            || "0.6.2"
        );


    const creator =
        cvmV06Escape(
            about.author
            || "Farouk"
        );


    const website =
        cvmV06Escape(
            about.website
            || "https://www.damergi.com"
        );


    const licenses =
        Array.isArray(
            about.licenses
        )
            ? about.licenses
            : [];


    const result =
        await cvmV05Modal({
            id:
                "cvmV06AboutModal",

            eyebrow:
                cvmV06Text(
                    "ABOUT CVM",
                    "À PROPOS DE CVM"
                ),

            title:
                "CV Maker",

            html: `
                <div class="cvm-about-v062">

                    <div class="cvm-about-v062-head">

                        <div
                            class="cvm-about-v062-monogram"
                            aria-hidden="true"
                        >
                            CVM
                        </div>


                        <div>

                            <div class="cvm-about-v062-name">

                                <strong>
                                    CV Maker
                                </strong>

                                <span>
                                    v${version}
                                </span>

                            </div>


                            <p>
                                ${cvmV06Text(
                                    "ATS-friendly CV creation, locally on your computer.",
                                    "Création de CV compatibles ATS, localement sur votre ordinateur."
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="cvm-about-v062-facts">

                        <div>

                            <span>
                                ${cvmV06Text(
                                    "Created by",
                                    "Créé par"
                                )}
                            </span>

                            <strong>
                                ${creator}
                            </strong>

                        </div>


                        <div>

                            <span>
                                ${cvmV06Text(
                                    "Privacy",
                                    "Confidentialité"
                                )}
                            </span>

                            <strong>
                                Local-first
                            </strong>

                        </div>

                    </div>


                    <p class="cvm-about-v062-copy">
                        ${cvmV06Text(
                            "Your CV projects, autosaves and generated files stay on your computer by default. Online access is only used when you explicitly request an online action, such as checking for updates.",
                            "Vos projets CV, sauvegardes automatiques et fichiers générés restent par défaut sur votre ordinateur. L’accès en ligne n’est utilisé que lorsque vous demandez explicitement une action en ligne, comme la vérification des mises à jour."
                        )}
                    </p>


                    <div class="cvm-about-v062-links">

                        <a
                            href="${website}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            damergi.com ↗
                        </a>


                        ${
                            about.github_repository
                                ? `
                                    <a
                                        href="https://github.com/${cvmV06Escape(
                                            about.github_repository
                                        )}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        GitHub ↗
                                    </a>
                                `
                                : ""
                        }


                        ${
                            about.donation_url
                                ? `
                                    <a
                                        href="${cvmV06Escape(
                                            about.donation_url
                                        )}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        ${cvmV06Text(
                                            "Support CV Maker ♡",
                                            "Soutenir CV Maker ♡"
                                        )}
                                    </a>
                                `
                                : ""
                        }

                    </div>


                    ${
                        licenses.length
                            ? `
                                <details class="cvm-about-v062-details">

                                    <summary>
                                        ${cvmV06Text(
                                            "Open-source components",
                                            "Composants open source"
                                        )}
                                    </summary>

                                    <p>
                                        ${cvmV06Escape(
                                            licenses.join(
                                                ", "
                                            )
                                        )}
                                    </p>

                                </details>
                            `
                            : ""
                    }

                </div>
            `,

            actions: [
                {
                    id:
                        "update",

                    label:
                        cvmV06Text(
                            "Check updates",
                            "Vérifier les mises à jour"
                        ),
                },
                {
                    id:
                        "close",

                    label:
                        cvmV06Text(
                            "Close",
                            "Fermer"
                        ),

                    primary:
                        true,
                },
            ],
        });


    if (
        result === "update"
        && typeof cvmV05CheckUpdates
        === "function"
    ) {
        await cvmV05CheckUpdates();
    }
}


function cvmV06InstallAboutButton() {
    const oldButton =
        document.querySelector(
            "#cvmAboutBtn"
        );


    if (
        !oldButton
    ) {
        return false;
    }


    if (
        oldButton.dataset
            .v06AboutBound === "true"
    ) {
        return true;
    }


    const button =
        oldButton.cloneNode(
            true
        );


    button.dataset.v06AboutBound =
        "true";


    oldButton.replaceWith(
        button
    );


    button.addEventListener(
        "click",
        cvmV06ShowAbout
    );


    return true;
}


// ===========================================================
// LOAD / RENDER HOOKS
// ===========================================================

if (
    typeof loadProjectIntoUI
    === "function"
) {
    const cvmV06BaseLoadProjectIntoUI =
        loadProjectIntoUI;


    loadProjectIntoUI =
        function (
            project
        ) {
            project.design ||= {};

            project.design.cv_language ||=
                project.design.language
                || "en";

            project.design.ui_language ||=
                cvmV06Lang();

            project.design.spacing ||=
                {};


            const result =
                cvmV06BaseLoadProjectIntoUI(
                    project
                );


            setTimeout(
                () => {

                    cvmV06EnhanceEditorFields();

                    cvmV06EnsureSpacingEditor();

                    cvmV06RemoveCountryPreset();

                    cvmV06MountCompleteness();

                },
                0
            );


            return result;
        };
}


function cvmV06RefreshLabels() {
    const modify =
        document.querySelector(
            "#cvmModifyCvBtn"
        );


    if (
        modify
    ) {
        modify.textContent =
            cvmV06Text(
                "Modify CV",
                "Modifier le CV"
            );
    }
}


// ===========================================================
// INIT
// ===========================================================

function cvmV06Init() {
    if (
        cvmV06.initialized
    ) {
        return;
    }


    cvmV06.initialized =
        true;


    cvmV06BuildEditorOverlay();

    cvmV06BuildPickers();

    cvmV06PatchShowPage();

    cvmV06PatchDynamicRenderer();

    cvmV06PatchPreview();


    cvmV06InstallHomeActions();

    cvmV06BuildManagerPages();

    cvmV06ReplaceApplicationNavButtons();


    cvmV06EnhanceEditorFields();

    cvmV06RefreshModifyButton();

    cvmV06RemoveCountryPreset();

    cvmV06MountCompleteness();

    cvmV06InstallAboutButton();


    setTimeout(
        () => {

            cvmV06RemoveCountryPreset();

            cvmV06MountCompleteness();

            cvmV06InstallAboutButton();

            cvmV06EnhanceEditorFields();

        },
        500
    );


    document.addEventListener(
        "click",
        (
            event
        ) => {

            if (
                event.target.closest?.(
                    ".cvm-language-switch button"
                )
                || event.target.closest?.(
                    "[data-cvm-lang]"
                )
            ) {
                setTimeout(
                    cvmV06RefreshLabels,
                    0
                );
            }
        }
    );


    window.addEventListener(
        "resize",
        cvmV06ClosePickers
    );
}


document.addEventListener(
    "DOMContentLoaded",
    () =>
        setTimeout(
            cvmV06Init,
            140
        )
);


window.addEventListener(
    "pywebviewready",
    () => {

        setTimeout(
            () => {

                if (
                    !cvmV06.initialized
                ) {
                    cvmV06Init();
                }


                cvmV06RefreshModifyButton();

                cvmV06RemoveCountryPreset();

                cvmV06MountCompleteness();

                cvmV06InstallAboutButton();

                cvmV06EnhanceEditorFields();

            },
            220
        );
    }
);
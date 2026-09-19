"use strict";

// ===========================================================
// CVM 0.5 PRODUCTIVITY LAYER
// Real PDF preview, history, recovery, guards, chips, bullets,
// completeness, optimizer, templates, presets, import, recents,
// Save As / Duplicate, About / updates, shortcuts and errors.
// ===========================================================

const CVM_V05_SECTION_KEYS = [
    "profile",
    "experiences",
    "education",
    "projects",
    "volunteering",
    "skills",
    "languages",
    "certifications",
];

const CVM_V05_DEFAULT_TITLES = {
    en: {
        profile: "PROFILE",
        experiences: "PROFESSIONAL EXPERIENCE",
        education: "EDUCATION",
        projects: "PROJECTS",
        volunteering: "VOLUNTEERING",
        skills: "TECHNICAL SKILLS",
        languages: "LANGUAGES",
        certifications: "CERTIFICATIONS",
    },

    fr: {
        profile: "PROFIL",
        experiences: "EXPÉRIENCE PROFESSIONNELLE",
        education: "FORMATION",
        projects: "PROJETS",
        volunteering: "BÉNÉVOLAT / VIE ASSOCIATIVE",
        skills: "COMPÉTENCES TECHNIQUES",
        languages: "LANGUES",
        certifications: "CERTIFICATIONS",
    },
};


const cvmV05 = {
    undo: [],
    redo: [],

    maxHistory: 70,

    restoring: false,
    dirty: false,

    lastSnapshot: "",

    previewTimer: null,
    analysisTimer: null,

    realPreviewEnabled: true,

    initialized: false,

    recoveryAsked: false,
    closingAsked: false,
};


// ===========================================================
// CORE HELPERS
// ===========================================================

function cvmV05Api() {
    return (
        window.pywebview?.api
        || null
    );
}


function cvmV05ProjectReady() {
    return Boolean(
        state?.project
        && cvmProjectActive
    );
}


function cvmV05Clone(
    value
) {
    return JSON.parse(
        JSON.stringify(
            value
        )
    );
}


function cvmV05Snapshot() {
    if (
        !state?.project
    ) {
        return "";
    }

    try {
        collectStaticFields();
    }
    catch (_) {
    }

    return JSON.stringify(
        state.project
    );
}


function cvmV05Lang() {
    return (
        typeof cvmCurrentLanguage !== "undefined"
        && cvmCurrentLanguage === "fr"
    )
        ? "fr"
        : "en";
}


function cvmV05Text(
    en,
    fr
) {
    return (
        cvmV05Lang() === "fr"
            ? fr
            : en
    );
}


function cvmV05Escape(
    value
) {
    return (
        typeof escapeHtml === "function"
            ? escapeHtml(
                value
            )
            : String(
                value ?? ""
            )
                .replaceAll(
                    "&",
                    "&amp;"
                )
                .replaceAll(
                    "<",
                    "&lt;"
                )
                .replaceAll(
                    ">",
                    "&gt;"
                )
                .replaceAll(
                    '"',
                    "&quot;"
                )
    );
}


// ===========================================================
// GENERIC MODALS / ERRORS
// ===========================================================

function cvmV05EnsureModalLayer() {

    if (
        !document.querySelector(
            "#cvmModalLayer"
        )
    ) {
        const layer =
            document.createElement(
                "div"
            );

        layer.id =
            "cvmModalLayer";

        layer.className =
            "cvm-modal-layer hidden";

        document.body.appendChild(
            layer
        );
    }

    return document.querySelector(
        "#cvmModalLayer"
    );
}


function cvmV05Modal({
    id,
    eyebrow = "CVM",
    title,
    html,
    actions = [],
}) {

    const layer =
        cvmV05EnsureModalLayer();

    document.querySelector(
        `#${id}`
    )?.remove();


    const modal =
        document.createElement(
            "section"
        );

    modal.id =
        id;

    modal.className =
        "cvm-modal";


    modal.innerHTML = `
        <div class="cvm-modal-header">

            <div>

                <div class="eyebrow">
                    ${cvmV05Escape(
                        eyebrow
                    )}
                </div>

                <h2>
                    ${cvmV05Escape(
                        title
                    )}
                </h2>

            </div>


            <button
                type="button"
                class="cvm-modal-close"
                data-v05-close
            >
                ×
            </button>

        </div>


        <div class="cvm-modal-content">
            ${html}
        </div>


        <div class="cvm-modal-footer">

            ${actions
                .map(
                    (
                        action
                    ) => `
                        <button
                            type="button"

                            class="${
                                action.primary
                                    ? "primary-button"
                                    : "secondary-button"
                            }"

                            data-v05-action="${cvmV05Escape(
                                action.id
                            )}"
                        >
                            ${cvmV05Escape(
                                action.label
                            )}
                        </button>
                    `
                )
                .join(
                    ""
                )}

        </div>
    `;


    layer.appendChild(
        modal
    );


    layer.classList.remove(
        "hidden"
    );


    layer.querySelectorAll(
        ".cvm-modal"
    ).forEach(
        (
            item
        ) => {

            item.classList.toggle(
                "hidden",
                item.id !== id
            );
        }
    );


    return new Promise(
        (
            resolve
        ) => {

            const finish =
                (
                    result
                ) => {

                    layer.classList.add(
                        "hidden"
                    );

                    modal.remove();

                    resolve(
                        result
                    );
                };


            modal.querySelector(
                "[data-v05-close]"
            )?.addEventListener(
                "click",
                () =>
                    finish(
                        null
                    )
            );


            modal.querySelectorAll(
                "[data-v05-action]"
            ).forEach(
                (
                    button
                ) => {

                    button.addEventListener(
                        "click",
                        () =>
                            finish(
                                button.dataset
                                    .v05Action
                            )
                    );
                }
            );
        }
    );
}


function cvmV05TextInputModal({
    id,
    eyebrow = "CVM",
    title,
    label,
    value = "",
    confirmLabel = "Save",
}) {

    const layer =
        cvmV05EnsureModalLayer();


    document.querySelector(
        `#${id}`
    )?.remove();


    const modal =
        document.createElement(
            "section"
        );


    modal.id =
        id;

    modal.className =
        "cvm-modal";


    modal.innerHTML = `
        <div class="cvm-modal-header">

            <div>

                <div class="eyebrow">
                    ${cvmV05Escape(
                        eyebrow
                    )}
                </div>

                <h2>
                    ${cvmV05Escape(
                        title
                    )}
                </h2>

            </div>


            <button
                type="button"
                class="cvm-modal-close"
                data-v05-close
            >
                ×
            </button>

        </div>


        <div class="cvm-modal-content">

            <label class="field">

                <span>
                    ${cvmV05Escape(
                        label
                    )}
                </span>

                <input
                    data-v05-text-input
                    value="${cvmV05Escape(
                        value
                    )}"
                >

            </label>

        </div>


        <div class="cvm-modal-footer">

            <button
                type="button"
                class="secondary-button"
                data-v05-cancel
            >
                ${cvmV05Escape(
                    cvmV05Text(
                        "Cancel",
                        "Annuler"
                    )
                )}
            </button>


            <button
                type="button"
                class="primary-button"
                data-v05-confirm
            >
                ${cvmV05Escape(
                    confirmLabel
                )}
            </button>

        </div>
    `;


    layer.appendChild(
        modal
    );


    layer.classList.remove(
        "hidden"
    );


    layer.querySelectorAll(
        ".cvm-modal"
    ).forEach(
        (
            item
        ) => {

            item.classList.toggle(
                "hidden",
                item.id !== id
            );
        }
    );


    const input =
        modal.querySelector(
            "[data-v05-text-input]"
        );


    window.setTimeout(
        () => {

            input?.focus();

            input?.select();

        },
        0
    );


    return new Promise(
        (
            resolve
        ) => {

            const finish =
                (
                    result
                ) => {

                    layer.classList.add(
                        "hidden"
                    );

                    modal.remove();

                    resolve(
                        result
                    );
                };


            const confirm =
                () => {

                    const typed =
                        String(
                            input?.value
                            || ""
                        )
                            .trim();


                    finish(
                        typed
                        || null
                    );
                };


            modal.querySelector(
                "[data-v05-close]"
            )?.addEventListener(
                "click",
                () =>
                    finish(
                        null
                    )
            );


            modal.querySelector(
                "[data-v05-cancel]"
            )?.addEventListener(
                "click",
                () =>
                    finish(
                        null
                    )
            );


            modal.querySelector(
                "[data-v05-confirm]"
            )?.addEventListener(
                "click",
                confirm
            );


            input?.addEventListener(
                "keydown",
                (
                    event
                ) => {

                    if (
                        event.key === "Enter"
                    ) {
                        event.preventDefault();

                        confirm();
                    }
                }
            );
        }
    );
}


async function cvmV05Confirm(
    title,
    message,
    confirmLabel = "Continue"
) {

    const result =
        await cvmV05Modal({

            id:
                "cvmV05ConfirmModal",

            eyebrow:
                "CVM",

            title,

            html:
                `<p>${cvmV05Escape(
                    message
                )}</p>`,

            actions: [

                {
                    id:
                        "cancel",

                    label:
                        cvmV05Text(
                            "Cancel",
                            "Annuler"
                        ),
                },

                {
                    id:
                        "confirm",

                    label:
                        confirmLabel,

                    primary:
                        true,
                },
            ],
        });


    return (
        result === "confirm"
    );
}


async function cvmV05ShowError(
    message,
    technical = ""
) {

    await cvmV05Modal({

        id:
            "cvmV05ErrorModal",

        eyebrow:
            "CVM ERROR",

        title:
            cvmV05Text(
                "Something went wrong",
                "Une erreur est survenue"
            ),

        html: `
            <div class="cvm-error-modal">

                <div class="cvm-error-icon">
                    !
                </div>

                <p>
                    ${cvmV05Escape(
                        message
                        || "Unknown error"
                    )}
                </p>

                ${
                    technical
                        ? `
                            <details>

                                <summary>
                                    Technical details
                                </summary>

                                <pre>${cvmV05Escape(
                                    technical
                                )}</pre>

                            </details>
                        `
                        : ""
                }

            </div>
        `,

        actions: [
            {
                id:
                    "close",

                label:
                    cvmV05Text(
                        "Close",
                        "Fermer"
                    ),

                primary:
                    true,
            },
        ],
    });
}


if (
    typeof showToast
    === "function"
) {

    const cvmV05BaseShowToast =
        showToast;


    showToast =
        function (
            message,
            type = "info",
            duration = 3300
        ) {

            if (
                type === "error"
            ) {

                cvmV05ShowError(
                    String(
                        message
                        || "Error"
                    )
                );

                return;
            }


            return cvmV05BaseShowToast(
                message,
                type,
                duration
            );
        };
}


// ===========================================================
// HISTORY / DIRTY / KEYBOARD
// ===========================================================

function cvmV05PushHistory() {

    if (
        cvmV05.restoring
        || !state?.project
    ) {
        return;
    }


    const snapshot =
        cvmV05Snapshot();


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


    cvmV05SetDirty(
        true
    );


    cvmV05RefreshHistoryButtons();
}


async function cvmV05SetDirty(
    value
) {

    cvmV05.dirty =
        Boolean(
            value
        );


    document.body.classList.toggle(
        "cvm-dirty",
        cvmV05.dirty
    );


    try {

        await cvmV05Api()
            ?.set_dirty_state(
                cvmV05.dirty
            );

    }
    catch (_) {
    }
}


function cvmV05RestoreSnapshot(
    snapshot
) {

    if (
        !snapshot
    ) {
        return;
    }


    cvmV05.restoring =
        true;


    try {

        const project =
            JSON.parse(
                snapshot
            );


        state.project =
            project;


        loadProjectIntoUI(
            project
        );


        cvmV05.lastSnapshot =
            JSON.stringify(
                project
            );


        cvmV05SetDirty(
            true
        );


        cvmV05ScheduleAnalyses();

        cvmV05ScheduleRealPreview();

    }
    finally {

        cvmV05.restoring =
            false;
    }
}


function cvmV05Undo() {

    if (
        !cvmV05.undo.length
        || !state?.project
    ) {
        return;
    }


    const current =
        cvmV05Snapshot();


    cvmV05.redo.push(
        current
    );


    cvmV05RestoreSnapshot(
        cvmV05.undo.pop()
    );


    cvmV05RefreshHistoryButtons();
}


function cvmV05Redo() {

    if (
        !cvmV05.redo.length
        || !state?.project
    ) {
        return;
    }


    const current =
        cvmV05Snapshot();


    cvmV05.undo.push(
        current
    );


    cvmV05RestoreSnapshot(
        cvmV05.redo.pop()
    );


    cvmV05RefreshHistoryButtons();
}


function cvmV05RefreshHistoryButtons() {

    const undo =
        document.querySelector(
            "#cvmUndoBtn"
        );


    const redo =
        document.querySelector(
            "#cvmRedoBtn"
        );


    if (
        undo
    ) {
        undo.disabled =
            !cvmV05.undo.length;
    }


    if (
        redo
    ) {
        redo.disabled =
            !cvmV05.redo.length;
    }
}


if (
    typeof projectChanged
    === "function"
) {

    const cvmV05BaseProjectChanged =
        projectChanged;


    projectChanged =
        function (
            ...args
        ) {

            if (
                !cvmV05.restoring
            ) {
                cvmV05PushHistory();
            }


            const result =
                cvmV05BaseProjectChanged.apply(
                    this,
                    args
                );


            cvmV05ScheduleAnalyses();

            cvmV05ScheduleRealPreview();


            return result;
        };
}


if (
    typeof autosaveProject
    === "function"
) {

    const cvmV05BaseAutosave =
        autosaveProject;


    autosaveProject =
        async function (
            ...args
        ) {

            const result =
                await cvmV05BaseAutosave.apply(
                    this,
                    args
                );


            try {

                const dirty =
                    await cvmV05Api()
                        ?.get_dirty_state();


                if (
                    dirty?.ok
                    && !dirty.dirty
                ) {

                    cvmV05.dirty =
                        false;


                    document.body
                        .classList
                        .remove(
                            "cvm-dirty"
                        );
                }

            }
            catch (_) {
            }


            return result;
        };
}


function cvmV05InstallKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        (
            event
        ) => {

            const mod =
                event.ctrlKey
                || event.metaKey;


            if (
                !mod
            ) {
                return;
            }


            const key =
                event.key
                    .toLowerCase();


            if (
                key === "s"
            ) {

                event.preventDefault();

                saveProject();

            }
            else if (
                key === "z"
                && !event.shiftKey
            ) {

                event.preventDefault();

                cvmV05Undo();

            }
            else if (
                key === "y"
                || (
                    key === "z"
                    && event.shiftKey
                )
            ) {

                event.preventDefault();

                cvmV05Redo();

            }
            else if (
                key === "n"
            ) {

                event.preventDefault();

                cvmV05GuardedNew();

            }
            else if (
                key === "o"
            ) {

                event.preventDefault();

                cvmV05GuardedOpen();

            }
            else if (
                key === "e"
            ) {

                event.preventDefault();


                if (
                    cvmV05ProjectReady()
                ) {
                    showPage(
                        "export"
                    );
                }
            }
        }
    );
}


// ===========================================================
// UNSAVED GUARDS + CLOSE
// ===========================================================

async function cvmV05CanLeaveCurrent() {

    if (
        !cvmV05.dirty
    ) {
        return true;
    }


    return cvmV05Confirm(

        cvmV05Text(
            "Unsaved changes",
            "Modifications non enregistrées"
        ),

        cvmV05Text(
            "Some changes are still waiting to finish autosaving. Continue anyway?",
            "Certaines modifications n'ont pas encore terminé leur sauvegarde automatique. Continuer quand même ?"
        ),

        cvmV05Text(
            "Continue",
            "Continuer"
        )
    );
}


async function cvmV05GuardedNew() {

    if (
        !(
            await cvmV05CanLeaveCurrent()
        )
    ) {
        return;
    }


    cvmV05.undo =
        [];

    cvmV05.redo =
        [];


    cvmUnlockOnNextProjectLoad =
        true;


    await cvmBaseNewProject();


    cvmV05ResetHistory();
}


async function cvmV05GuardedOpen() {

    if (
        !(
            await cvmV05CanLeaveCurrent()
        )
    ) {
        return;
    }


    await openProject();


    cvmV05ResetHistory();
}


window.cvmRequestCloseConfirmation =
    async function () {

        if (
            cvmV05.closingAsked
        ) {
            return;
        }


        cvmV05.closingAsked =
            true;


        const proceed =
            await cvmV05Confirm(

                cvmV05Text(
                    "Close CV Maker?",
                    "Fermer CV Maker ?"
                ),

                cvmV05Text(
                    "Some changes are not fully autosaved yet. Close anyway?",
                    "Certaines modifications ne sont pas encore totalement sauvegardées. Fermer quand même ?"
                ),

                cvmV05Text(
                    "Close anyway",
                    "Fermer quand même"
                )
            );


        cvmV05.closingAsked =
            false;


        if (
            proceed
        ) {
            await cvmV05Api()
                ?.confirm_close();
        }
    };


function cvmV05ResetHistory() {

    cvmV05.undo =
        [];

    cvmV05.redo =
        [];


    cvmV05.lastSnapshot =
        cvmV05Snapshot();


    cvmV05SetDirty(
        false
    );


    cvmV05RefreshHistoryButtons();

    cvmV05ScheduleAnalyses();

    cvmV05ScheduleRealPreview();
}


// ===========================================================
// REAL PDF PREVIEW
// ===========================================================

function cvmV05InstallRealPreview() {

    const column =
        document.querySelector(
            ".preview-column"
        );


    const header =
        column?.querySelector(
            ".preview-header"
        );


    const scroll =
        column?.querySelector(
            ".preview-scroll"
        );


    if (
        !column
        || !header
        || !scroll
        || document.querySelector(
            "#cvmRealPreview"
        )
    ) {
        return;
    }


    const toggle =
        document.createElement(
            "button"
        );


    toggle.id =
        "cvmPreviewModeBtn";

    toggle.type =
        "button";

    toggle.className =
        "cvm-v05-button";

    toggle.textContent =
        "Real PDF";

    toggle.title =
        "Toggle exact compiled PDF preview";


    header.appendChild(
        toggle
    );


    const real =
        document.createElement(
            "div"
        );


    real.id =
        "cvmRealPreview";

    real.className =
        "cvm-real-preview active";


    real.innerHTML = `
        <div class="cvm-real-preview-loading">
            Real PDF preview will appear here.
        </div>
    `;


    scroll.after(
        real
    );


    scroll.style.display =
        "none";


    toggle.addEventListener(
        "click",
        () => {

            cvmV05.realPreviewEnabled =
                !cvmV05.realPreviewEnabled;


            real.classList.toggle(
                "active",
                cvmV05.realPreviewEnabled
            );


            scroll.style.display =
                cvmV05.realPreviewEnabled
                    ? "none"
                    : "block";


            toggle.textContent =
                cvmV05.realPreviewEnabled
                    ? "Real PDF"
                    : "HTML preview";


            if (
                cvmV05.realPreviewEnabled
            ) {
                cvmV05ScheduleRealPreview(
                    true
                );
            }
        }
    );
}


function cvmV05ScheduleRealPreview(
    immediate = false
) {

    if (
        !cvmV05.realPreviewEnabled
        || !cvmV05ProjectReady()
    ) {
        return;
    }


    clearTimeout(
        cvmV05.previewTimer
    );


    cvmV05.previewTimer =
        setTimeout(
            cvmV05RenderRealPreview,
            immediate
                ? 80
                : 2200
        );
}


async function cvmV05RenderRealPreview() {

    const container =
        document.querySelector(
            "#cvmRealPreview"
        );


    if (
        !container
        || !cvmV05ProjectReady()
        || !cvmV05.realPreviewEnabled
    ) {
        return;
    }


    collectStaticFields();


    container.innerHTML = `
        <div class="cvm-real-preview-loading">
            Compiling exact PDF preview…
        </div>
    `;


    try {

        const result =
            await cvmV05Api()
                ?.render_pdf_preview(
                    state.project
                );


        if (
            !result?.ok
        ) {

            container.innerHTML = `
                <div class="cvm-real-preview-loading">
                    ${cvmV05Escape(
                        result?.message
                        || "PDF preview unavailable"
                    )}
                </div>
            `;

            return;
        }


        container.innerHTML = `
            <div class="cvm-real-preview-pages">

                ${result.pages
                    .map(
                        (
                            page
                        ) => `
                            <img
                                class="cvm-real-preview-page"

                                src="${page.data_uri}"

                                alt="PDF page ${page.page}"
                            >
                        `
                    )
                    .join(
                        ""
                    )}

            </div>
        `;

    }
    catch (
        error
    ) {

        container.innerHTML = `
            <div class="cvm-real-preview-loading">
                PDF preview failed.
            </div>
        `;


        console.error(
            error
        );
    }
}


// ===========================================================
// TOOL CHIPS + INDIVIDUAL BULLETS
// ===========================================================

function cvmV05EnhanceDynamicEditors(
    root = document
) {

    root.querySelectorAll(
        'input[data-key="tools"]'
    ).forEach(
        cvmV05UpgradeToolInput
    );


    root.querySelectorAll(
        'textarea[data-key="bullets"]'
    ).forEach(
        cvmV05UpgradeBulletArea
    );
}


function cvmV05UpgradeToolInput(
    input
) {

    if (
        input.dataset.v05Enhanced
    ) {
        return;
    }


    input.dataset.v05Enhanced =
        "true";


    const collection =
        input.dataset.collection;


    const index =
        Number(
            input.dataset.index
        );


    const item =
        state.project
            ?.[collection]
            ?.[index];


    if (
        !item
    ) {
        return;
    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "cvm-chip-editor";


    wrapper.dataset.collection =
        collection;


    wrapper.dataset.index =
        String(
            index
        );


    wrapper.innerHTML = `
        <div class="cvm-chip-list">

            ${(item.tools || [])
                .map(
                    (
                        tool,
                        toolIndex
                    ) => `
                        <span class="cvm-tool-chip">

                            ${cvmV05Escape(
                                tool
                            )}

                            <button
                                type="button"

                                data-v05-tool-remove="${toolIndex}"

                                aria-label="Remove ${cvmV05Escape(
                                    tool
                                )}"
                            >
                                ×
                            </button>

                        </span>
                    `
                )
                .join(
                    ""
                )}

        </div>


        <small>
            ${cvmV05Text(
                "Type a tool and press Enter to add it.",
                "Saisissez un outil puis appuyez sur Entrée."
            )}
        </small>


        <input
            class="cvm-chip-input"

            type="text"

            data-v05-tool-input

            placeholder="Power BI — Enter"
        >
    `;


    input.replaceWith(
        wrapper
    );
}


function cvmV05UpgradeBulletArea(
    textarea
) {

    if (
        textarea.dataset.v05Enhanced
    ) {
        return;
    }


    textarea.dataset.v05Enhanced =
        "true";


    const collection =
        textarea.dataset.collection;


    const index =
        Number(
            textarea.dataset.index
        );


    const item =
        state.project
            ?.[collection]
            ?.[index];


    if (
        !item
    ) {
        return;
    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "cvm-bullet-editor";


    wrapper.dataset.collection =
        collection;


    wrapper.dataset.index =
        String(
            index
        );


    wrapper.innerHTML = `
        ${(item.bullets || [])
            .map(
                (
                    bullet,
                    bulletIndex
                ) =>
                    cvmV05BulletRow(
                        bullet,
                        bulletIndex
                    )
            )
            .join(
                ""
            )}

        <button
            type="button"
            class="cvm-v05-button cvm-bullet-add"
            data-v05-bullet-add
        >
            +
            ${cvmV05Text(
                "Add bullet",
                "Ajouter une puce"
            )}
        </button>
    `;


    textarea.replaceWith(
        wrapper
    );


    cvmV05BindBulletDrag(
        wrapper
    );
}


function cvmV05BulletRow(
    text,
    index
) {

    return `
        <div
            class="cvm-bullet-item"

            draggable="true"

            data-bullet-index="${index}"
        >

            <span
                class="cvm-bullet-handle"
                title="Drag"
            >
                ⋮⋮
            </span>


            <textarea
                class="cvm-bullet-text"

                rows="2"

                data-v05-bullet-text
            >${cvmV05Escape(
                text
            )}</textarea>


            <button
                type="button"

                class="cvm-bullet-remove"

                data-v05-bullet-remove

                aria-label="Remove bullet"
            >
                ×
            </button>

        </div>
    `;
}


function cvmV05BindBulletDrag(
    wrapper
) {

    let from =
        null;


    wrapper.querySelectorAll(
        ".cvm-bullet-item"
    ).forEach(
        (
            row
        ) => {

            row.addEventListener(
                "dragstart",
                () => {

                    from =
                        Number(
                            row.dataset
                                .bulletIndex
                        );
                }
            );


            row.addEventListener(
                "dragover",
                (
                    event
                ) =>
                    event.preventDefault()
            );


            row.addEventListener(
                "drop",
                (
                    event
                ) => {

                    event.preventDefault();


                    const to =
                        Number(
                            row.dataset
                                .bulletIndex
                        );


                    if (
                        from === null
                        || from === to
                    ) {
                        return;
                    }


                    const item =
                        cvmV05EditorItem(
                            wrapper
                        );


                    if (
                        !item
                    ) {
                        return;
                    }


                    const [
                        moved
                    ] =
                        item.bullets.splice(
                            from,
                            1
                        );


                    item.bullets.splice(
                        to,
                        0,
                        moved
                    );


                    renderDynamicSections();

                    projectChanged();
                }
            );
        }
    );
}


function cvmV05EditorItem(
    wrapper
) {

    const collection =
        wrapper.dataset.collection;


    const index =
        Number(
            wrapper.dataset.index
        );


    return (
        state.project
            ?.[collection]
            ?.[index]
        || null
    );
}


function cvmV05InstallEditorDelegation() {

    document.addEventListener(
        "keydown",
        (
            event
        ) => {

            const input =
                event.target.closest?.(
                    "[data-v05-tool-input]"
                );


            if (
                !input
                || event.key !== "Enter"
            ) {
                return;
            }


            event.preventDefault();


            const wrapper =
                input.closest(
                    ".cvm-chip-editor"
                );


            const item =
                cvmV05EditorItem(
                    wrapper
                );


            if (
                !item
            ) {
                return;
            }


            const values =
                input.value
                    .split(
                        /[,;]+/
                    )
                    .map(
                        (
                            value
                        ) =>
                            value.trim()
                    )
                    .filter(
                        Boolean
                    );


            item.tools ||=
                [];


            for (
                const value
                of values
            ) {

                if (
                    !item.tools.some(
                        (
                            existing
                        ) =>
                            existing.toLowerCase()
                            === value.toLowerCase()
                    )
                ) {
                    item.tools.push(
                        value
                    );
                }
            }


            renderDynamicSections();

            projectChanged();
        }
    );


    document.addEventListener(
        "click",
        (
            event
        ) => {

            const toolRemove =
                event.target.closest?.(
                    "[data-v05-tool-remove]"
                );


            if (
                toolRemove
            ) {

                const wrapper =
                    toolRemove.closest(
                        ".cvm-chip-editor"
                    );


                const item =
                    cvmV05EditorItem(
                        wrapper
                    );


                if (
                    !item
                ) {
                    return;
                }


                item.tools.splice(
                    Number(
                        toolRemove.dataset
                            .v05ToolRemove
                    ),
                    1
                );


                renderDynamicSections();

                projectChanged();

                return;
            }


            const add =
                event.target.closest?.(
                    "[data-v05-bullet-add]"
                );


            if (
                add
            ) {

                const wrapper =
                    add.closest(
                        ".cvm-bullet-editor"
                    );


                const item =
                    cvmV05EditorItem(
                        wrapper
                    );


                if (
                    !item
                ) {
                    return;
                }


                item.bullets ||=
                    [];


                item.bullets.push(
                    ""
                );


                renderDynamicSections();

                projectChanged();

                return;
            }


            const remove =
                event.target.closest?.(
                    "[data-v05-bullet-remove]"
                );


            if (
                remove
            ) {

                const wrapper =
                    remove.closest(
                        ".cvm-bullet-editor"
                    );


                const row =
                    remove.closest(
                        ".cvm-bullet-item"
                    );


                const item =
                    cvmV05EditorItem(
                        wrapper
                    );


                if (
                    !item
                ) {
                    return;
                }


                item.bullets.splice(
                    Number(
                        row.dataset
                            .bulletIndex
                    ),
                    1
                );


                renderDynamicSections();

                projectChanged();
            }
        }
    );


    document.addEventListener(
        "input",
        (
            event
        ) => {

            const field =
                event.target.closest?.(
                    "[data-v05-bullet-text]"
                );


            if (
                !field
            ) {
                return;
            }


            const wrapper =
                field.closest(
                    ".cvm-bullet-editor"
                );


            const row =
                field.closest(
                    ".cvm-bullet-item"
                );


            const item =
                cvmV05EditorItem(
                    wrapper
                );


            if (
                !item
            ) {
                return;
            }


            item.bullets[
                Number(
                    row.dataset
                        .bulletIndex
                )
            ] =
                field.value;


            projectChanged();
        }
    );
}


if (
    typeof renderDynamicSections
    === "function"
) {

    const cvmV05BaseRenderDynamic =
        renderDynamicSections;


    renderDynamicSections =
        function (
            ...args
        ) {

            const result =
                cvmV05BaseRenderDynamic.apply(
                    this,
                    args
                );


            queueMicrotask(
                () =>
                    cvmV05EnhanceDynamicEditors(
                        document
                    )
            );


            return result;
        };
}


// ===========================================================
// COMPLETENESS / OPTIMIZER / BULLET QUALITY
// ===========================================================

function cvmV05InstallCompleteness() {

    const heading =
        document.querySelector(
            "#page-content .page-heading"
        );


    if (
        !heading
        || document.querySelector(
            "#cvmCompleteness"
        )
    ) {
        return;
    }


    const box =
        document.createElement(
            "button"
        );


    box.id =
        "cvmCompleteness";

    box.type =
        "button";

    box.className =
        "cvm-completeness";


    box.innerHTML = `
        <span>
            ${cvmV05Text(
                "Complete",
                "Complet"
            )}
        </span>

        <span class="cvm-completeness-track">
            <span></span>
        </span>

        <strong>
            0%
        </strong>
    `;


    heading.appendChild(
        box
    );


    box.addEventListener(
        "click",
        cvmV05ShowCompletenessDetails
    );
}


async function cvmV05ScheduleAnalyses() {

    if (
        !cvmV05ProjectReady()
    ) {
        return;
    }


    clearTimeout(
        cvmV05.analysisTimer
    );


    cvmV05.analysisTimer =
        setTimeout(
            async () => {

                const api =
                    cvmV05Api();


                if (
                    !api
                ) {
                    return;
                }


                collectStaticFields();


                try {

                    const result =
                        await api.get_completeness(
                            state.project
                        );


                    if (
                        result?.ok
                    ) {
                        cvmV05PaintCompleteness(
                            result.result
                        );
                    }

                }
                catch (_) {
                }

            },
            450
        );
}


function cvmV05PaintCompleteness(
    result
) {

    const box =
        document.querySelector(
            "#cvmCompleteness"
        );


    if (
        !box
    ) {
        return;
    }


    box.dataset.report =
        JSON.stringify(
            result
        );


    box.querySelector(
        "strong"
    ).textContent =
        `${result.score}%`;


    box.querySelector(
        ".cvm-completeness-track > span"
    ).style.width =
        `${result.score}%`;
}


async function cvmV05ShowCompletenessDetails() {

    const box =
        document.querySelector(
            "#cvmCompleteness"
        );


    let report =
        null;


    try {

        report =
            JSON.parse(
                box?.dataset.report
                || "null"
            );

    }
    catch (_) {
    }


    if (
        !report
    ) {
        return;
    }


    await cvmV05Modal({

        id:
            "cvmCompletenessModal",

        eyebrow:
            "CVM",

        title:
            `${
                report.score
            }% ${
                cvmV05Text(
                    "complete",
                    "complet"
                )
            }`,

        html:
            report.missing.length
                ? `
                    <ul class="cvm-v05-list">

                        ${report.missing
                            .map(
                                (
                                    item
                                ) => `
                                    <li>
                                        ${cvmV05Escape(
                                            item.message
                                        )}
                                    </li>
                                `
                            )
                            .join(
                                ""
                            )}

                    </ul>
                `
                : `
                    <p>
                        ${cvmV05Text(
                            "Your main CV fields are complete.",
                            "Les principaux champs de votre CV sont complets."
                        )}
                    </p>
                `,

        actions: [
            {
                id:
                    "close",

                label:
                    cvmV05Text(
                        "Close",
                        "Fermer"
                    ),

                primary:
                    true,
            },
        ],
    });
}


async function cvmV05ShowOptimizer() {

    if (
        !cvmV05ProjectReady()
    ) {
        return;
    }


    collectStaticFields();


    const [
        optimizer,
        quality
    ] =
        await Promise.all([

            cvmV05Api()
                ?.get_optimizer_report(
                    state.project
                ),

            cvmV05Api()
                ?.get_bullet_quality(
                    state.project
                ),
        ]);


    const suggestions =
        optimizer?.result
            ?.suggestions
        || [];


    const badBullets =
        (
            quality?.result
                ?.bullets
            || []
        )
            .filter(
                (
                    row
                ) =>
                    row.issues.length
            );


    await cvmV05Modal({

        id:
            "cvmOptimizerModal",

        eyebrow:
            "CVM OPTIMIZER",

        title:
            cvmV05Text(
                "One-page & bullet coach",
                "Coach une page & puces"
            ),

        html: `
            <h3>
                ${cvmV05Text(
                    "Page-fit suggestions",
                    "Suggestions de mise en page"
                )}
            </h3>


            ${
                suggestions.length
                    ? `
                        <ul class="cvm-v05-list">

                            ${suggestions
                                .map(
                                    (
                                        suggestion
                                    ) => `
                                        <li>
                                            ${cvmV05Escape(
                                                suggestion.message
                                            )}
                                        </li>
                                    `
                                )
                                .join(
                                    ""
                                )}

                        </ul>
                    `
                    : `
                        <p>
                            No obvious page-pressure issue detected.
                        </p>
                    `
            }


            <h3>
                ${cvmV05Text(
                    "Bullet quality",
                    "Qualité des puces"
                )}
            </h3>


            ${
                badBullets.length
                    ? `
                        <ul class="cvm-v05-list">

                            ${badBullets
                                .slice(
                                    0,
                                    12
                                )
                                .map(
                                    (
                                        row
                                    ) => `
                                        <li>

                                            <strong>
                                                ${cvmV05Escape(
                                                    row.section
                                                )}
                                                ${row.item_index}.${row.bullet_index}
                                            </strong>

                                            —
                                            ${cvmV05Escape(
                                                row.issues.join(
                                                    ", "
                                                )
                                            )}

                                        </li>
                                    `
                                )
                                .join(
                                    ""
                                )}

                        </ul>
                    `
                    : `
                        <p>
                            No obvious bullet issue detected.
                        </p>
                    `
            }
        `,

        actions: [
            {
                id:
                    "close",

                label:
                    cvmV05Text(
                        "Close",
                        "Fermer"
                    ),

                primary:
                    true,
            },
        ],
    });
}


// ===========================================================
// TEMPLATE GALLERY / PRESETS / CV LANGUAGE / CUSTOM TITLES
// ===========================================================

async function cvmV05InstallDesignStudio() {

    const page =
        document.querySelector(
            "#page-design .settings-grid"
        );


    if (
        !page
        || document.querySelector(
            "#cvmV05DesignStudio"
        )
    ) {
        return;
    }


    const panel =
        document.createElement(
            "section"
        );


    panel.id =
        "cvmV05DesignStudio";

    panel.className =
        "settings-card";


    panel.innerHTML = `
        <h2>
            ${cvmV05Text(
                "Template gallery",
                "Galerie de modèles"
            )}
        </h2>


        <div
            id="cvmTemplateGallery"
            class="cvm-template-gallery"
        ></div>


        <div class="cvm-v05-panel">

            <h3>
                ${cvmV05Text(
                    "Country preset",
                    "Préréglage pays"
                )}
            </h3>

            <select
                id="cvmCountryPreset"
                class="cvm-v05-select"
            ></select>

            <p id="cvmCountryNote"></p>

        </div>


        <div class="cvm-v05-panel">

            <h3>
                ${cvmV05Text(
                    "CV language",
                    "Langue du CV"
                )}
            </h3>

            <p>
                ${cvmV05Text(
                    "Independent from the CV Maker interface language.",
                    "Indépendante de la langue de l'interface CV Maker."
                )}
            </p>

            <select
                id="cvmCvLanguage"
                class="cvm-v05-select"
            >

                <option value="en">
                    English
                </option>

                <option value="fr">
                    Français
                </option>

            </select>

        </div>


        <div class="cvm-v05-panel">

            <h3>
                ${cvmV05Text(
                    "Custom section names",
                    "Noms personnalisés des sections"
                )}
            </h3>

            <div
                id="cvmCustomSectionTitles"
                class="field-grid"
            ></div>

        </div>
    `;


    page.prepend(
        panel
    );


    const [
        templates,
        presets
    ] =
        await Promise.all([

            cvmV05Api()
                ?.get_template_catalog(),

            cvmV05Api()
                ?.get_country_presets(),
        ]);


    cvmV05RenderTemplates(
        templates?.items
        || []
    );


    cvmV05RenderPresets(
        presets?.items
        || {}
    );


    cvmV05RenderCustomTitles();

    cvmV05SyncDesignStudio();
}


function cvmV05RenderTemplates(
    items
) {

    const gallery =
        document.querySelector(
            "#cvmTemplateGallery"
        );


    if (
        !gallery
    ) {
        return;
    }


    gallery.innerHTML =
        items
            .map(
                (
                    item
                ) => `
                    <button
                        type="button"

                        class="cvm-template-card"

                        data-v05-template="${cvmV05Escape(
                            item.id
                        )}"
                    >

                        <div class="cvm-template-thumb">

                            <div class="cvm-template-lines">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>

                        </div>


                        <div class="cvm-template-body">

                            <strong>
                                ${cvmV05Escape(
                                    item.name
                                )}
                            </strong>

                            <p>
                                ${cvmV05Escape(
                                    item.description
                                )}
                            </p>

                            <div class="cvm-template-badges">

                                ${item.badges
                                    .map(
                                        (
                                            badge
                                        ) => `
                                            <span class="cvm-template-badge">
                                                ${cvmV05Escape(
                                                    badge
                                                )}
                                            </span>
                                        `
                                    )
                                    .join(
                                        ""
                                    )}

                            </div>

                        </div>

                    </button>
                `
            )
            .join(
                ""
            );


    gallery.addEventListener(
        "click",
        (
            event
        ) => {

            const card =
                event.target.closest(
                    "[data-v05-template]"
                );


            if (
                !card
                || !state?.project
            ) {
                return;
            }


            state.project.design
                .template_id =
                card.dataset
                    .v05Template;


            if (
                document.querySelector(
                    "#templateSelect"
                )
            ) {

                document.querySelector(
                    "#templateSelect"
                ).value =
                    card.dataset
                        .v05Template;
            }


            cvmV05SyncDesignStudio();

            projectChanged();
        }
    );
}


function cvmV05RenderPresets(
    items
) {

    const select =
        document.querySelector(
            "#cvmCountryPreset"
        );


    if (
        !select
    ) {
        return;
    }


    select.innerHTML =
        Object.entries(
            items
        )
            .map(
                (
                    [
                        key,
                        value
                    ]
                ) => `
                    <option value="${key}">
                        ${cvmV05Escape(
                            value.name
                        )}
                    </option>
                `
            )
            .join(
                ""
            );


    select.dataset.presets =
        JSON.stringify(
            items
        );


    select.addEventListener(
        "change",
        () =>
            cvmV05ApplyCountryPreset(
                select.value
            )
    );
}


function cvmV05ApplyCountryPreset(
    key
) {

    if (
        !state?.project
    ) {
        return;
    }


    const select =
        document.querySelector(
            "#cvmCountryPreset"
        );


    let presets =
        {};


    try {

        presets =
            JSON.parse(
                select.dataset.presets
                || "{}"
            );

    }
    catch (_) {
    }


    const preset =
        presets[
            key
        ];


    if (
        !preset
    ) {
        return;
    }


    state.project.design
        .country_preset =
        key;


    state.project.design
        .region =
        key;


    state.project.design
        .cv_language =
        preset.default_cv_language
        || "en";


    state.project.design
        .language =
        state.project.design
            .cv_language;


    state.project.design
        .section_titles =
        cvmV05Clone(
            preset.section_titles
            || {}
        );


    document.querySelector(
        "#cvmCountryNote"
    ).textContent =
        preset.notes
        || "";


    cvmV05RenderCustomTitles();

    cvmV05SyncDesignStudio();

    projectChanged();
}


function cvmV05RenderCustomTitles() {

    const host =
        document.querySelector(
            "#cvmCustomSectionTitles"
        );


    if (
        !host
        || !state?.project
    ) {
        return;
    }


    const lang =
        state.project.design
            .cv_language
        || state.project.design
            .language
        || "en";


    const defaults =
        CVM_V05_DEFAULT_TITLES[
            lang
        ]
        || CVM_V05_DEFAULT_TITLES.en;


    const custom =
        state.project.design
            .section_titles
        || {};


    host.innerHTML =
        CVM_V05_SECTION_KEYS
            .map(
                (
                    key
                ) => `
                    <label class="field">

                        <span>
                            ${cvmV05Escape(
                                defaults[
                                    key
                                ]
                            )}
                        </span>

                        <input
                            type="text"

                            data-v05-section-title="${key}"

                            value="${cvmV05Escape(
                                custom[
                                    key
                                ]
                                || ""
                            )}"

                            placeholder="${cvmV05Escape(
                                defaults[
                                    key
                                ]
                            )}"
                        >

                    </label>
                `
            )
            .join(
                ""
            );
}


function cvmV05SyncDesignStudio() {

    if (
        !state?.project
    ) {
        return;
    }


    document.querySelectorAll(
        "[data-v05-template]"
    ).forEach(
        (
            card
        ) => {

            card.classList.toggle(
                "active",
                card.dataset
                    .v05Template
                === state.project.design
                    .template_id
            );
        }
    );


    const preset =
        document.querySelector(
            "#cvmCountryPreset"
        );


    if (
        preset
    ) {

        preset.value =
            state.project.design
                .country_preset
            || state.project.design
                .region
            || "international";
    }


    const cvLang =
        document.querySelector(
            "#cvmCvLanguage"
        );


    if (
        cvLang
    ) {

        cvLang.value =
            state.project.design
                .cv_language
            || state.project.design
                .language
            || "en";
    }
}


function cvmV05InstallDesignEvents() {

    document.addEventListener(
        "change",
        (
            event
        ) => {

            if (
                event.target.id
                === "cvmCvLanguage"

                && state?.project
            ) {

                state.project.design
                    .cv_language =
                    event.target.value;


                state.project.design
                    .language =
                    event.target.value;


                cvmV05RenderCustomTitles();

                projectChanged();
            }
        }
    );


    document.addEventListener(
        "input",
        (
            event
        ) => {

            const input =
                event.target.closest?.(
                    "[data-v05-section-title]"
                );


            if (
                !input
                || !state?.project
            ) {
                return;
            }


            state.project.design
                .section_titles ||=
                {};


            const value =
                input.value
                    .trim();


            if (
                value
            ) {

                state.project.design
                    .section_titles[
                        input.dataset
                            .v05SectionTitle
                    ] =
                    value;

            }
            else {

                delete state.project.design
                    .section_titles[
                        input.dataset
                            .v05SectionTitle
                    ];
            }


            projectChanged();
        }
    );
}


// Keep UI language independent from CV language
// despite the older localization layer.

if (
    typeof cvmSetLanguage
    === "function"
) {

    const cvmV05BaseSetLanguage =
        cvmSetLanguage;


    cvmSetLanguage =
        function (
            language,
            saveToProject = true
        ) {

            const cvLanguage =
                state?.project
                    ?.design
                    ?.cv_language

                || state?.project
                    ?.design
                    ?.language

                || "en";


            const result =
                cvmV05BaseSetLanguage(
                    language,
                    false
                );


            if (
                state?.project
            ) {

                state.project.design
                    .ui_language =
                    language;


                state.project.design
                    .cv_language =
                    cvLanguage;


                state.project.design
                    .language =
                    cvLanguage;


                if (
                    saveToProject
                ) {
                    projectChanged();
                }
            }


            return result;
        };
}


// ===========================================================
// RECENT PROJECTS / IMPORT / SAVE AS / DUPLICATE
// ===========================================================

async function cvmV05InstallHomeTools() {

    const home =
        document.querySelector(
            "#page-home .section-block"
        );


    if (
        !home
        || document.querySelector(
            "#cvmRecentProjects"
        )
    ) {
        return;
    }


    const block =
        document.createElement(
            "section"
        );


    block.id =
        "cvmRecentProjects";

    block.className =
        "cvm-v05-panel";


    block.innerHTML = `
        <div class="section-heading">

            <div>

                <div class="eyebrow">
                    CVM
                </div>

                <h2>
                    ${cvmV05Text(
                        "Recent projects",
                        "Projets récents"
                    )}
                </h2>

            </div>


            <button
                id="cvmImportCvBtn"

                type="button"

                class="cvm-v05-button"
            >
                ${cvmV05Text(
                    "Import PDF / DOCX",
                    "Importer PDF / DOCX"
                )}
            </button>

        </div>


        <div
            id="cvmRecentProjectCards"

            class="cvm-home-recent"
        ></div>
    `;


    home.after(
        block
    );


    document.querySelector(
        "#cvmImportCvBtn"
    )?.addEventListener(
        "click",
        cvmV05ImportCv
    );


    await cvmV05RefreshRecents();
}


async function cvmV05RefreshRecents() {

    const host =
        document.querySelector(
            "#cvmRecentProjectCards"
        );


    if (
        !host
    ) {
        return;
    }


    const result =
        await cvmV05Api()
            ?.get_recent_projects();


    const items =
        result?.items
        || [];


    host.innerHTML =
        items.length
            ? items
                .map(
                    (
                        item
                    ) => `
                        <article class="cvm-recent-card">

                            <strong>
                                ${cvmV05Escape(
                                    item.title
                                    || item.name
                                )}
                            </strong>


                            <span>
                                ${cvmV05Escape(
                                    item.person
                                    || ""
                                )}
                            </span>


                            <small>
                                ${cvmV05Escape(
                                    item.modified_at
                                    || ""
                                )}
                            </small>


                            <button
                                class="cvm-v05-button"

                                type="button"

                                data-v05-recent-open="${cvmV05Escape(
                                    item.path
                                )}"
                            >
                                ${cvmV05Text(
                                    "Open",
                                    "Ouvrir"
                                )}
                            </button>

                        </article>
                    `
                )
                .join(
                    ""
                )

            : `
                <p>
                    ${cvmV05Text(
                        "No recent project yet.",
                        "Aucun projet récent pour le moment."
                    )}
                </p>
            `;
}


async function cvmV05ImportCv() {

    if (
        !(
            await cvmV05CanLeaveCurrent()
        )
    ) {
        return;
    }


    await cvmOpenBrowser(
        "import",
        "",
        async (
            selectedPath
        ) => {

            const result =
                await cvmV05Api()
                    ?.import_cv_path(
                        selectedPath
                    );


            if (
                !result?.ok
            ) {

                return cvmV05ShowError(
                    result?.message
                    || "Import failed"
                );
            }


            cvmUnlockOnNextProjectLoad =
                true;


            loadProjectIntoUI(
                result.project
            );


            cvmSetProjectActive(
                true
            );


            showPage(
                "content"
            );


            cvmV05ResetHistory();


            await cvmV05Modal({

                id:
                    "cvmImportNotice",

                eyebrow:
                    "IMPORT",

                title:
                    cvmV05Text(
                        "CV imported",
                        "CV importé"
                    ),

                html:
                    `<p>${cvmV05Escape(
                        result.warning
                        || "Review the imported fields."
                    )}</p>`,

                actions: [
                    {
                        id:
                            "ok",

                        label:
                            "OK",

                        primary:
                            true,
                    },
                ],
            });
        }
    );
}


async function cvmV05SaveAs() {

    if (
        !cvmV05ProjectReady()
    ) {
        return;
    }


    collectStaticFields();


    const defaultName =
    `${
        state.project.title
        || state.project.personal
            .full_name
        || "CV"
    }.cvm`;


    await cvmOpenBrowser(
        "folder",
        "",
        async (
            folder
        ) => {

            const name =
                await cvmV05TextInputModal({

                    id:
                        "cvmSaveAsNameModal",

                    eyebrow:
                        "SAVE AS",

                    title:
                        cvmV05Text(
                            "Save project copy",
                            "Enregistrer une copie"
                        ),

                    label:
                        cvmV05Text(
                            "File name",
                            "Nom du fichier"
                        ),

                    value:
                        defaultName,

                    confirmLabel:
                        cvmV05Text(
                            "Save",
                            "Enregistrer"
                        ),
                });


            if (
                !name
            ) {
                return;
            }


            const response =
                await cvmV05Api()
                    ?.save_project_as(

                        state.project,

                        folder,

                        name
                    );


            if (
                !response?.ok
            ) {

                return cvmV05ShowError(
                    response?.message
                    || "Save As failed"
                );
            }


            await cvmV05SetDirty(
                false
            );


            cvmV05RefreshRecents();


            showToast(
                cvmV05Text(
                    "Project copy saved.",
                    "Copie du projet enregistrée."
                ),
                "success"
            );
        }
    );
}


async function cvmV05Duplicate() {

    if (
        !cvmV05ProjectReady()
    ) {
        return;
    }


    collectStaticFields();


    const result =
        await cvmV05Api()
            ?.duplicate_project(
                state.project
            );


    if (
        !result?.ok
    ) {

        return cvmV05ShowError(
            result?.message
            || "Duplicate failed"
        );
    }


    cvmV05RefreshRecents();


    showToast(
        cvmV05Text(
            "CV duplicated.",
            "CV dupliqué."
        ),
        "success"
    );
}


// ===========================================================
// RECOVERY
// ===========================================================

async function cvmV05CheckRecovery() {

    if (
        cvmV05.recoveryAsked
        || !cvmV05Api()
    ) {
        return;
    }


    cvmV05.recoveryAsked =
        true;


    const stateResult =
        await cvmV05Api()
            .get_recovery_state();


    if (
        !stateResult?.available
    ) {
        return;
    }


    const choice =
        await cvmV05Modal({

            id:
                "cvmRecoveryModal",

            eyebrow:
                "RECOVERY",

            title:
                cvmV05Text(
                    "Recover previous session?",
                    "Récupérer la session précédente ?"
                ),

            html: `
                <p>
                    ${cvmV05Escape(
                        stateResult.title
                        || "CV"
                    )}
                </p>

                <p>
                    ${cvmV05Escape(
                        stateResult.modified_at
                        || ""
                    )}
                </p>
            `,

            actions: [

                {
                    id:
                        "discard",

                    label:
                        cvmV05Text(
                            "Discard",
                            "Ignorer"
                        ),
                },

                {
                    id:
                        "recover",

                    label:
                        cvmV05Text(
                            "Recover",
                            "Récupérer"
                        ),

                    primary:
                        true,
                },
            ],
        });


    if (
        choice === "recover"
    ) {

        const recovered =
            await cvmV05Api()
                .recover_autosave();


        if (
            recovered?.ok
        ) {

            cvmUnlockOnNextProjectLoad =
                true;


            loadProjectIntoUI(
                recovered.project
            );


            cvmSetProjectActive(
                true
            );


            showPage(
                "content"
            );


            cvmV05ResetHistory();


            await cvmV05SetDirty(
                true
            );
        }
    }
    else if (
        choice === "discard"
    ) {

        await cvmV05Api()
            .discard_recovery();
    }
}


// ===========================================================
// ABOUT / UPDATE / DONATION CONFIG
// ===========================================================

async function cvmV05ShowAbout() {

    const about =
        await cvmV05Api()
            ?.get_about();


    if (
        !about?.ok
    ) {
        return;
    }


    const result =
        await cvmV05Modal({

            id:
                "cvmAboutModal",

            eyebrow:
                "CVM",

            title:
                `${
                    about.name
                } ${
                    about.version
                }`,

            html: `
                <p>
                    <strong>
                        ${cvmV05Escape(
                            about.author
                        )}
                    </strong>
                </p>


                <p>
                    ${cvmV05Escape(
                        about.privacy
                    )}
                </p>


                <p>
                    <a
                        href="${cvmV05Escape(
                            about.website
                        )}"

                        target="_blank"

                        rel="noopener noreferrer"
                    >
                        damergi.com ↗
                    </a>
                </p>


                <p>
                    ${
                        about.github_repository
                            ? `
                                GitHub:
                                ${cvmV05Escape(
                                    about.github_repository
                                )}
                            `
                            : `
                                GitHub repository will be configured before public release.
                            `
                    }
                </p>


                <p>
                    ${
                        about.donation_url
                            ? "Support link configured."
                            : "Donation link not configured yet."
                    }
                </p>


                <p>

                    <strong>
                        ${cvmV05Text(
                            "Open-source components",
                            "Composants open source"
                        )}:
                    </strong>

                    ${cvmV05Escape(
                        (
                            about.licenses
                            || []
                        ).join(
                            ", "
                        )
                    )}

                </p>
            `,

            actions: [

                {
                    id:
                        "update",

                    label:
                        cvmV05Text(
                            "Check updates",
                            "Vérifier les mises à jour"
                        ),
                },

                {
                    id:
                        "close",

                    label:
                        cvmV05Text(
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
    ) {
        cvmV05CheckUpdates();
    }
}


async function cvmV05CheckUpdates() {

    const result =
        await cvmV05Api()
            ?.check_for_updates();


    if (
        !result?.configured
    ) {

        return cvmV05Modal({

            id:
                "cvmUpdateInfo",

            eyebrow:
                "UPDATE",

            title:
                cvmV05Text(
                    "Not configured yet",
                    "Pas encore configuré"
                ),

            html:
                `<p>${cvmV05Escape(
                    result?.message
                    || "Configure GITHUB_REPOSITORY in src/config.py after creating the repository."
                )}</p>`,

            actions: [
                {
                    id:
                        "ok",

                    label:
                        "OK",

                    primary:
                        true,
                },
            ],
        });
    }


    if (
        !result?.ok
    ) {

        return cvmV05ShowError(
            result?.message
            || "Update check failed"
        );
    }


    await cvmV05Modal({

        id:
            "cvmUpdateResult",

        eyebrow:
            "UPDATE",

        title:
            result.available
                ? "Update available"
                : "CVM is up to date",

        html: `
            <p>
                Current:
                ${cvmV05Escape(
                    result.current
                )}
            </p>

            <p>
                Latest:
                ${cvmV05Escape(
                    result.latest
                )}
            </p>

            ${
                result.release_url
                    ? `
                        <p>

                            <a
                                href="${cvmV05Escape(
                                    result.release_url
                                )}"

                                target="_blank"
                            >
                                View release ↗
                            </a>

                        </p>
                    `
                    : ""
            }
        `,

        actions: [
            {
                id:
                    "ok",

                label:
                    "OK",

                primary:
                    true,
            },
        ],
    });
}


async function cvmV05WireDonation() {

    const about =
        await cvmV05Api()
            ?.get_about();


    if (
        !about?.ok
        || !about.donation_url
    ) {
        return;
    }


    const button =
        document.querySelector(
            "#cvmDonationBtn"
        );


    if (
        button
        && !button.dataset
            .v05DonationBound
    ) {

        button.dataset
            .v05DonationBound =
            "true";


        button.addEventListener(
            "click",
            (
                event
            ) => {

                event.preventDefault();

                event.stopImmediatePropagation();


                window.open(
                    about.donation_url,
                    "_blank",
                    "noopener,noreferrer"
                );
            },
            true
        );
    }


    const link =
        document.querySelector(
            "#cvmSupportDonateLink"
        );


    if (
        link
    ) {

        link.href =
            about.donation_url;

        link.target =
            "_blank";

        link.rel =
            "noopener noreferrer";

        link.removeAttribute(
            "aria-disabled"
        );

        link.classList.remove(
            "cvm-support-coming-soon"
        );

        link.textContent =
            cvmV05Text(
                "Support CV Maker ♡",
                "Soutenir CV Maker ♡"
            );
    }
}


// ===========================================================
// TOOLBAR / SIDEBAR UI
// ===========================================================

function cvmV05InstallToolbar() {

    const group =
        document.querySelector(
            ".cvm-toolbar-group--project"
        )

        || document.querySelector(
            ".topbar-actions"
        );


    if (
        !group
        || document.querySelector(
            "#cvmUndoBtn"
        )
    ) {
        return;
    }


    const tools =
        document.createElement(
            "div"
        );


    tools.className =
        "cvm-v05-toolbar";


    tools.innerHTML = `
        <span
            class="cvm-unsaved-dot"
            title="Unsaved changes"
        ></span>


        <button
            id="cvmUndoBtn"

            type="button"

            class="cvm-v05-button"

            title="Ctrl+Z"
        >
            ↶
        </button>


        <button
            id="cvmRedoBtn"

            type="button"

            class="cvm-v05-button"

            title="Ctrl+Y"
        >
            ↷
        </button>


        <button
            id="cvmSaveAsBtn"

            type="button"

            class="cvm-v05-button"
        >
            ${cvmV05Text(
                "Save As",
                "Enregistrer sous"
            )}
        </button>


        <button
            id="cvmDuplicateBtn"

            type="button"

            class="cvm-v05-button"
        >
            ${cvmV05Text(
                "Duplicate",
                "Dupliquer"
            )}
        </button>


        <button
            id="cvmOptimizerBtn"

            type="button"

            class="cvm-v05-button"
        >
            ${cvmV05Text(
                "Coach",
                "Coach"
            )}
        </button>
    `;


    group.appendChild(
        tools
    );


    document.querySelector(
        "#cvmUndoBtn"
    )?.addEventListener(
        "click",
        cvmV05Undo
    );


    document.querySelector(
        "#cvmRedoBtn"
    )?.addEventListener(
        "click",
        cvmV05Redo
    );


    document.querySelector(
        "#cvmSaveAsBtn"
    )?.addEventListener(
        "click",
        cvmV05SaveAs
    );


    document.querySelector(
        "#cvmDuplicateBtn"
    )?.addEventListener(
        "click",
        cvmV05Duplicate
    );


    document.querySelector(
        "#cvmOptimizerBtn"
    )?.addEventListener(
        "click",
        cvmV05ShowOptimizer
    );


    cvmV05RefreshHistoryButtons();
}


function cvmV05InstallAboutButton() {

    const nav =
        document.querySelector(
            ".nav-list.compact"
        );


    if (
        !nav
        || document.querySelector(
            "#cvmAboutBtn"
        )
    ) {
        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "cvmAboutBtn";

    button.className =
        "nav-item";

    button.type =
        "button";


    button.innerHTML = `
        <span class="nav-icon">
            i
        </span>

        <span>
            ${cvmV05Text(
                "About CVM",
                "À propos de CVM"
            )}
        </span>
    `;


    nav.appendChild(
        button
    );


    button.addEventListener(
        "click",
        cvmV05ShowAbout
    );
}


// ===========================================================
// LOAD PATCH / RECENT OPEN / BROWSER IMPORT TITLE
// ===========================================================

if (
    typeof loadProjectIntoUI
    === "function"
) {

    const cvmV05BaseLoad =
        loadProjectIntoUI;


    loadProjectIntoUI =
        function (
            project
        ) {

            project.design ||=
                {};


            project.design
                .cv_language ||=
                project.design
                    .language
                || "en";


            project.design
                .ui_language ||=
                cvmV05Lang();


            project.design
                .country_preset ||=
                project.design
                    .region
                || "international";


            project.design
                .section_titles ||=
                {};


            const result =
                cvmV05BaseLoad(
                    project
                );


            setTimeout(
                () => {

                    cvmV05EnhanceDynamicEditors(
                        document
                    );

                    cvmV05SyncDesignStudio();

                    cvmV05RenderCustomTitles();

                    cvmV05ScheduleAnalyses();

                    cvmV05ScheduleRealPreview(
                        true
                    );

                },
                0
            );


            return result;
        };
}


// Extend the browser wording for import mode.

if (
    typeof cvmOpenBrowser
    === "function"
) {

    const cvmV05BaseOpenBrowser =
        cvmOpenBrowser;


    cvmOpenBrowser =
        async function (
            mode,
            startPath,
            callback
        ) {

            const result =
                await cvmV05BaseOpenBrowser(
                    mode,
                    startPath,
                    callback
                );


            if (
                mode === "import"
            ) {

                const title =
                    document.querySelector(
                        "#cvmBrowserTitle"
                    );


                if (
                    title
                ) {

                    title.textContent =
                        cvmV05Text(
                            "Import an existing PDF or DOCX CV",
                            "Importer un CV PDF ou DOCX existant"
                        );
                }
            }


            return result;
        };
}


function cvmV05InstallImportBrowserSelection() {

    document.addEventListener(
        "click",
        (
            event
        ) => {

            const file =
                event.target.closest?.(
                    "[data-browser-file]"
                );


            if (
                !file
                || typeof cvmBrowserMode
                    === "undefined"
                || cvmBrowserMode
                    !== "import"
            ) {
                return;
            }


            event.preventDefault();

            event.stopImmediatePropagation();


            const selectedPath =
                file.dataset
                    .browserFile;


            const callback =
                typeof cvmBrowserCallback
                !== "undefined"

                    ? cvmBrowserCallback

                    : null;


            if (
                typeof cvmCloseModals
                === "function"
            ) {

                cvmCloseModals();
            }


            callback?.(
                selectedPath
            );

        },
        true
    );
}


function cvmV05InstallRecentOpen() {

    document.addEventListener(
        "click",
        async (
            event
        ) => {

            const button =
                event.target.closest?.(
                    "[data-v05-recent-open]"
                );


            if (
                !button
            ) {
                return;
            }


            if (
                !(
                    await cvmV05CanLeaveCurrent()
                )
            ) {
                return;
            }


            const result =
                await cvmV05Api()
                    ?.load_project_path(
                        button.dataset
                            .v05RecentOpen
                    );


            if (
                !result?.ok
            ) {

                return cvmV05ShowError(
                    result?.message
                    || "Open failed"
                );
            }


            cvmUnlockOnNextProjectLoad =
                true;


            loadProjectIntoUI(
                result.project
            );


            cvmSetProjectActive(
                true
            );


            showPage(
                "content"
            );


            cvmV05ResetHistory();
        }
    );
}


// ===========================================================
// START
// ===========================================================

async function cvmV05Start() {

    if (
        cvmV05.initialized
    ) {
        return;
    }


    cvmV05.initialized =
        true;


    cvmV05InstallToolbar();

    cvmV05InstallAboutButton();

    cvmV05InstallRealPreview();

    cvmV05InstallCompleteness();

    cvmV05InstallEditorDelegation();

    cvmV05InstallKeyboardShortcuts();

    cvmV05InstallDesignEvents();

    cvmV05InstallRecentOpen();

    cvmV05InstallImportBrowserSelection();


    // Replace visible New/Open behavior
    // with unsaved-change-protected versions.

    document.querySelector(
        "#newCvBtn"
    )?.addEventListener(
        "click",
        (
            event
        ) => {

            event.stopImmediatePropagation();

            cvmV05GuardedNew();

        },
        true
    );


    document.querySelector(
        "#openProjectBtn"
    )?.addEventListener(
        "click",
        (
            event
        ) => {

            event.stopImmediatePropagation();

            cvmV05GuardedOpen();

        },
        true
    );


    await cvmV05InstallDesignStudio();

    await cvmV05InstallHomeTools();


    // Wait for Python bridge before checking
    // recovery, donation config and initial history.

    const waitBridge =
        setInterval(
            async () => {

                if (
                    !cvmV05Api()
                ) {
                    return;
                }


                clearInterval(
                    waitBridge
                );


                await cvmV05WireDonation();

                await cvmV05CheckRecovery();


                if (
                    state?.project
                ) {
                    cvmV05ResetHistory();
                }

            },
            250
        );


    cvmV05EnhanceDynamicEditors(
        document
    );
}


document.addEventListener(
    "DOMContentLoaded",
    cvmV05Start
);


window.addEventListener(
    "pywebviewready",
    () =>
        setTimeout(
            cvmV05Start,
            0
        )
);
"use strict";

// ===========================================================
// CVM 0.4.0 FEATURES
// ===========================================================

const CVM_SECTION_ORDER = [
    "profile",
    "experiences",
    "education",
    "projects",
    "volunteering",
    "skills",
    "languages",
    "certifications",
];

const CVM_SECTION_META = {
    profile: { label: "Profile", detail: "Professional summary" },
    experiences: { label: "Professional experience", detail: "Jobs and internships" },
    education: { label: "Education", detail: "Degrees and studies" },
    projects: { label: "Projects", detail: "Academic and personal projects" },
    volunteering: { label: "Volunteering", detail: "Associative and volunteer work" },
    skills: { label: "Technical skills", detail: "Tools, technologies and methods" },
    languages: { label: "Languages", detail: "Languages and proficiency" },
    certifications: { label: "Certifications", detail: "Professional certifications" },
};

const CVM_COLOR_TARGETS = [
    ["name", "Name"],
    ["section_titles", "Section titles"],
    ["role_titles", "Role / degree titles"],
    ["subtitles", "Companies / subtitles"],
    ["lines", "Separator lines"],
    ["links", "Links / contact links"],
];

const CVM_PALETTE = [
    "#8B1540",
    "#4F46E5",
    "#1D4ED8",
    "#0F766E",
    "#16803C",
    "#B45309",
    "#C2410C",
    "#B91C1C",
    "#7E22CE",
    "#374151",
];

let cvmProjectActive = false;
let cvmUnlockOnNextProjectLoad = false;
let cvmDragState = null;
let cvmPhotoDataUri = "";
let cvmBrowserMode = "folder";
let cvmBrowserCallback = null;
let cvmExportFormat = "pdf";
let cvmLastExportPath = "";


// ===========================================================
// COMPATIBILITY / DEFAULTS
// ===========================================================

function cvmNormalizeSectionOrder(value) {
    const source = Array.isArray(value) ? value : [];
    const normalized = [];

    for (const item of source) {
        if (
            CVM_SECTION_ORDER.includes(item)
            && !normalized.includes(item)
        ) {
            normalized.push(item);
        }
    }

    for (const item of CVM_SECTION_ORDER) {
        if (!normalized.includes(item)) {
            normalized.push(item);
        }
    }

    return normalized;
}

function cvmEnsureProjectLayout(project) {
    if (!project) return;

    project.design ||= {};

    const design = project.design;

    design.section_order = cvmNormalizeSectionOrder(
        design.section_order
    );

    design.section_visibility ||= {};

    for (const key of CVM_SECTION_ORDER) {
        if (typeof design.section_visibility[key] !== "boolean") {
            design.section_visibility[key] = true;
        }
    }

    design.use_color = design.use_color !== false;

    design.primary_color = (
        design.primary_color
        || design.accent_color
        || "#8B1540"
    ).toUpperCase();

    design.accent_color = design.primary_color;

    design.primary_targets = Array.isArray(
        design.primary_targets
    )
        ? design.primary_targets
        : [
            "section_titles",
            "lines",
        ];

    design.secondary_color_enabled = Boolean(
        design.secondary_color_enabled
    );

    design.secondary_color = (
        design.secondary_color
        || "#4F46E5"
    ).toUpperCase();

    design.secondary_targets = Array.isArray(
        design.secondary_targets
    )
        ? design.secondary_targets
        : [
            "name",
        ];

    design.auto_fit =
        design.auto_fit !== false;

    design.photo_enabled =
        Boolean(
            design.photo_enabled
        );

    design.photo_path ||= "";
}

function cvmIsSectionVisible(key) {
    return (
        state.project
            ?.design
            ?.section_visibility
            ?.[key]
        !== false
    );
}

function cvmDesignColor(target) {
    const design =
        state.project?.design;

    if (
        !design
        || design.use_color === false
    ) {
        return "#111827";
    }

    if (
        design.secondary_color_enabled
        && design.secondary_targets.includes(
            target
        )
    ) {
        return (
            design.secondary_color
            || "#4F46E5"
        );
    }

    if (
        design.primary_targets.includes(
            target
        )
    ) {
        return (
            design.primary_color
            || "#8B1540"
        );
    }

    return "#111827";
}


// ===========================================================
// WORKSPACE LOCKING
// ===========================================================

function cvmSetProjectActive(active) {
    cvmProjectActive =
        Boolean(active);

    document.body.classList.toggle(
        "cvm-project-locked",
        !cvmProjectActive
    );

    document.querySelectorAll(
        '.nav-item[data-page]:not([data-page="home"])'
    ).forEach(
        (button) => {
            button.disabled =
                !cvmProjectActive;

            button.classList.toggle(
                "cvm-nav-locked",
                !cvmProjectActive
            );
        }
    );

    [
        "#saveProjectBtn",
        "#quickPdfBtn",
        "#quickDocxBtn",
    ].forEach(
        (selector) => {
            const button =
                document.querySelector(
                    selector
                );

            if (button) {
                button.disabled =
                    !cvmProjectActive;
            }
        }
    );

    if (
        !cvmProjectActive
        && state.currentPage !== "home"
    ) {
        cvmBaseShowPage(
            "home"
        );
    }
}

const cvmBaseShowPage =
    showPage;

showPage = function (pageName) {
    if (
        !cvmProjectActive
        && pageName !== "home"
    ) {
        showToast(
            "Create, open or load a demo CV first.",
            "info",
            2200
        );

        return;
    }

    cvmBaseShowPage(
        pageName
    );
};


// ===========================================================
// PROJECT LOAD PATCHES
// ===========================================================

const cvmBaseLoadProjectIntoUI =
    loadProjectIntoUI;

loadProjectIntoUI = function (project) {
    cvmEnsureProjectLayout(
        project
    );

    cvmBaseLoadProjectIntoUI(
        project
    );

    cvmSyncDesignControls();
    cvmRenderSectionOrderList();
    cvmDecorateDynamicCards();
    cvmRefreshPhotoPreview();
    cvmRenderCapacity();

    if (
        cvmUnlockOnNextProjectLoad
    ) {
        cvmUnlockOnNextProjectLoad =
            false;

        cvmSetProjectActive(
            true
        );
    }
};

const cvmBaseNewProject =
    newProject;

newProject = async function () {
    cvmUnlockOnNextProjectLoad =
        true;

    await cvmBaseNewProject();
};

const cvmBaseDemoProject =
    demoProject;

demoProject = async function () {
    cvmUnlockOnNextProjectLoad =
        true;

    await cvmBaseDemoProject();
};

openProject = async function () {
    if (
        !bridgeApiAvailable()
    ) {
        return;
    }

    await cvmOpenBrowser(
        "project",
        "",
        async (
            selectedPath
        ) => {
            const result =
                await window.pywebview.api
                    .load_project_path(
                        selectedPath
                    );

            if (
                !result.ok
            ) {
                showToast(
                    result.message
                    || "Unable to open project.",
                    "error"
                );

                return;
            }

            cvmUnlockOnNextProjectLoad =
                true;

            loadProjectIntoUI(
                result.project
            );

            showPage(
                "content"
            );

            showToast(
                "Project opened.",
                "success"
            );
        }
    );
};

const cvmBaseCollectStaticFields =
    collectStaticFields;

collectStaticFields = function () {
    cvmBaseCollectStaticFields();

    if (
        !state.project
    ) {
        return;
    }

    cvmEnsureProjectLayout(
        state.project
    );

    const design =
        state.project.design;

    const useColor =
        document.querySelector(
            "#useColor"
        );

    const secondaryEnabled =
        document.querySelector(
            "#secondaryColorEnabled"
        );

    const autoFit =
        document.querySelector(
            "#autoFit"
        );

    if (useColor) {
        design.use_color =
            useColor.checked;
    }

    if (secondaryEnabled) {
        design.secondary_color_enabled =
            secondaryEnabled.checked;
    }

    if (autoFit) {
        design.auto_fit =
            autoFit.checked;
    }

    design.primary_color = (
        document.querySelector(
            "#accentColorText"
        )?.value
        || design.primary_color
        || "#8B1540"
    ).toUpperCase();

    design.accent_color =
        design.primary_color;

    design.secondary_color = (
        document.querySelector(
            "#secondaryColorText"
        )?.value
        || design.secondary_color
        || "#4F46E5"
    ).toUpperCase();

    design.primary_targets =
        Array.from(
            document.querySelectorAll(
                '[data-color-group="primary"]:checked'
            )
        ).map(
            (item) =>
                item.dataset
                    .colorTarget
        );

    design.secondary_targets =
        Array.from(
            document.querySelectorAll(
                '[data-color-group="secondary"]:checked'
            )
        ).map(
            (item) =>
                item.dataset
                    .colorTarget
        );
};


// ===========================================================
// DESIGN UI
// ===========================================================

function cvmTargetCheckboxes(
    group
) {
    return CVM_COLOR_TARGETS
        .map(
            (
                [
                    key,
                    label,
                ]
            ) => `
                <label class="cvm-check-chip">

                    <input
                        type="checkbox"
                        data-color-group="${group}"
                        data-color-target="${key}"
                    >

                    <span>
                        ${escapeHtml(
                            label
                        )}
                    </span>

                </label>
            `
        )
        .join("");
}

function cvmPaletteHtml(
    targetInputId
) {
    return `
        <div
            class="cvm-color-palette"
            data-palette-for="${targetInputId}"
        >

            ${CVM_PALETTE
                .map(
                    (color) => `
                        <button
                            type="button"
                            class="cvm-color-swatch"
                            data-color="${color}"
                            data-color-target-input="${targetInputId}"
                            style="--swatch:${color}"
                            title="${color}"
                            aria-label="${color}"
                        ></button>
                    `
                )
                .join("")}

        </div>
    `;
}

function cvmBuildDesignControls() {
    const designCards =
        Array.from(
            document.querySelectorAll(
                "#page-design .settings-card"
            )
        );

    const colorCard =
        designCards.find(
            (card) =>
                card
                    .querySelector(
                        "h2"
                    )
                    ?.textContent
                    .trim()
                === "Colors"
        );

    if (colorCard) {
        colorCard.classList.add(
            "cvm-color-card"
        );

        colorCard.innerHTML = `
            <div class="cvm-card-heading-row">

                <div>

                    <h2>
                        Colors
                    </h2>

                    <p>
                        Use one or two colors and decide exactly where each one appears.
                    </p>

                </div>

                <label class="cvm-switch-row compact">

                    <span>
                        Use color
                    </span>

                    <input
                        id="useColor"
                        type="checkbox"
                        checked
                    >

                </label>

            </div>


            <div
                id="primaryColorPanel"
                class="cvm-color-panel"
            >

                <div class="cvm-color-panel-title">

                    <strong>
                        Primary color
                    </strong>

                    <span>
                        HEX + palette
                    </span>

                </div>


                <div class="color-field">

                    <input
                        id="accentColor"
                        type="color"
                        value="#8B1540"
                    >

                    <input
                        id="accentColorText"
                        type="text"
                        value="#8B1540"
                        maxlength="7"
                    >

                </div>

                ${cvmPaletteHtml(
                    "accentColorText"
                )}

                <div class="cvm-target-grid">

                    ${cvmTargetCheckboxes(
                        "primary"
                    )}

                </div>

            </div>


            <div class="cvm-color-panel">

                <label class="cvm-switch-row">

                    <div>

                        <strong>
                            Secondary color
                        </strong>

                        <span>
                            Add a second accent only where you want it.
                        </span>

                    </div>

                    <input
                        id="secondaryColorEnabled"
                        type="checkbox"
                    >

                </label>


                <div
                    id="secondaryColorPanel"
                    class="cvm-secondary-panel"
                >

                    <div class="color-field">

                        <input
                            id="secondaryColor"
                            type="color"
                            value="#4F46E5"
                        >

                        <input
                            id="secondaryColorText"
                            type="text"
                            value="#4F46E5"
                            maxlength="7"
                        >

                    </div>

                    ${cvmPaletteHtml(
                        "secondaryColorText"
                    )}

                    <div class="cvm-target-grid">

                        ${cvmTargetCheckboxes(
                            "secondary"
                        )}

                    </div>

                </div>

            </div>
        `;
    }

    const layoutCard =
        designCards.find(
            (card) =>
                card
                    .querySelector(
                        "h2"
                    )
                    ?.textContent
                    .trim()
                === "Layout"
        );

    if (layoutCard) {
        layoutCard.innerHTML = `
            <h2>
                Layout
            </h2>


            <label class="field">

                <span>
                    Preferred page mode
                </span>

                <select id="pageMode">

                    <option value="1">
                        One page
                    </option>

                    <option value="2">
                        Two pages
                    </option>

                </select>

            </label>


            <label class="cvm-switch-row">

                <div>

                    <strong>
                        Automatic page fitting
                    </strong>

                    <span>
                        CVM progressively tightens spacing if the exported PDF exceeds your selected page target.
                    </span>

                </div>

                <input
                    id="autoFit"
                    type="checkbox"
                    checked
                >

            </label>


            <label class="cvm-switch-row">

                <div>

                    <strong>
                        Photo
                    </strong>

                    <span>
                        Add a PNG or JPG photo to the top-right of the CV.
                    </span>

                </div>

                <input
                    id="photoEnabled"
                    type="checkbox"
                >

            </label>


            <div
                id="photoControls"
                class="cvm-photo-controls hidden"
            >

                <div
                    id="photoPreviewBox"
                    class="cvm-photo-preview"
                >

                    <span>
                        No photo selected
                    </span>

                </div>


                <div class="cvm-photo-actions">

                    <button
                        id="photoSelectBtn"
                        type="button"
                        class="secondary-button"
                    >
                        Choose photo
                    </button>

                    <button
                        id="photoRemoveBtn"
                        type="button"
                        class="text-button danger-text"
                    >
                        Remove
                    </button>

                </div>

                <small>
                    Accepted: PNG, JPG, JPEG only.
                </small>

            </div>


            <div class="info-box">
                A photo is optional. CVM keeps it outside the main PDF text flow, but photo-free CVs remain the safest default for many ATS workflows.
            </div>
        `;
    }

    const previewHeader =
        document.querySelector(
            ".preview-header"
        );

    if (
        previewHeader
        && !document.querySelector(
            "#capacityMeter"
        )
    ) {
        previewHeader.insertAdjacentHTML(
            "beforeend",
            `
                <div
                    id="capacityMeter"
                    class="cvm-capacity compact"
                >

                    <div class="cvm-capacity-top">

                        <span>
                            Page capacity
                        </span>

                        <strong id="capacityValue">
                            0%
                        </strong>

                    </div>

                    <div class="cvm-capacity-track">
                        <span id="capacityBar"></span>
                    </div>

                </div>
            `
        );
    }
}

function cvmValidHex(
    value
) {
    return (
        /^#[0-9A-Fa-f]{6}$/
            .test(
                String(
                    value
                    || ""
                )
            )
    );
}

function cvmSetColorPair(
    textId,
    colorId,
    value
) {
    if (
        !cvmValidHex(
            value
        )
    ) {
        return false;
    }

    const normalized =
        value.toUpperCase();

    const text =
        document.querySelector(
            `#${textId}`
        );

    const picker =
        document.querySelector(
            `#${colorId}`
        );

    if (text) {
        text.value =
            normalized;
    }

    if (picker) {
        picker.value =
            normalized;
    }

    return true;
}

function cvmSyncDesignControls() {
    if (
        !state.project
    ) {
        return;
    }

    cvmEnsureProjectLayout(
        state.project
    );

    const design =
        state.project.design;

    const useColor =
        document.querySelector(
            "#useColor"
        );

    const secondaryEnabled =
        document.querySelector(
            "#secondaryColorEnabled"
        );

    const autoFit =
        document.querySelector(
            "#autoFit"
        );

    const photoEnabled =
        document.querySelector(
            "#photoEnabled"
        );

    if (useColor) {
        useColor.checked =
            design.use_color;
    }

    if (secondaryEnabled) {
        secondaryEnabled.checked =
            design.secondary_color_enabled;
    }

    if (autoFit) {
        autoFit.checked =
            design.auto_fit;
    }

    if (photoEnabled) {
        photoEnabled.checked =
            design.photo_enabled;
    }

    cvmSetColorPair(
        "accentColorText",
        "accentColor",
        design.primary_color
    );

    cvmSetColorPair(
        "secondaryColorText",
        "secondaryColor",
        design.secondary_color
    );

    document.querySelectorAll(
        '[data-color-group="primary"]'
    ).forEach(
        (checkbox) => {
            checkbox.checked =
                design.primary_targets
                    .includes(
                        checkbox.dataset
                            .colorTarget
                    );
        }
    );

    document.querySelectorAll(
        '[data-color-group="secondary"]'
    ).forEach(
        (checkbox) => {
            checkbox.checked =
                design.secondary_targets
                    .includes(
                        checkbox.dataset
                            .colorTarget
                    );
        }
    );

    cvmUpdateDesignVisibility();
}

function cvmUpdateDesignVisibility() {
    const useColor =
        document.querySelector(
            "#useColor"
        )?.checked
        ?? true;

    const secondaryEnabled =
        document.querySelector(
            "#secondaryColorEnabled"
        )?.checked
        ?? false;

    const photoEnabled =
        document.querySelector(
            "#photoEnabled"
        )?.checked
        ?? false;

    document.querySelector(
        "#primaryColorPanel"
    )?.classList.toggle(
        "disabled-panel",
        !useColor
    );

    document.querySelector(
        "#secondaryColorPanel"
    )?.classList.toggle(
        "disabled-panel",
        !useColor
        || !secondaryEnabled
    );

    document.querySelector(
        "#photoControls"
    )?.classList.toggle(
        "hidden",
        !photoEnabled
    );
}


// ===========================================================
// PHOTO
// ===========================================================

async function cvmRefreshPhotoPreview() {
    const box =
        document.querySelector(
            "#photoPreviewBox"
        );

    if (
        !box
        || !state.project
    ) {
        return;
    }

    const design =
        state.project.design;

    if (
        !design.photo_enabled
        || !design.photo_path
    ) {
        cvmPhotoDataUri =
            "";

        box.innerHTML =
            "<span>No photo selected</span>";

        renderPreview();

        return;
    }

    if (
        !state.bridgeReady
    ) {
        return;
    }

    try {
        const result =
            await window.pywebview.api
                .load_photo_preview(
                    design.photo_path
                );

        if (
            !result.ok
        ) {
            cvmPhotoDataUri =
                "";

            box.innerHTML = `
                <span>
                    ${escapeHtml(
                        result.message
                    )}
                </span>
            `;

            return;
        }

        cvmPhotoDataUri =
            result.data_uri;

        box.innerHTML = `
            <img
                src="${result.data_uri}"
                alt="CV photo preview"
            >

            <div>

                <strong>
                    ${escapeHtml(
                        result.name
                    )}
                </strong>

                <span>
                    ${escapeHtml(
                        result.path
                    )}
                </span>

            </div>
        `;

        renderPreview();
    }
    catch (error) {
        console.error(
            error
        );
    }
}

function cvmRemovePhoto() {
    if (
        !state.project
    ) {
        return;
    }

    state.project.design
        .photo_path =
        "";

    state.project.design
        .photo_enabled =
        false;

    const checkbox =
        document.querySelector(
            "#photoEnabled"
        );

    if (checkbox) {
        checkbox.checked =
            false;
    }

    cvmPhotoDataUri =
        "";

    cvmUpdateDesignVisibility();
    cvmRefreshPhotoPreview();
    projectChanged();
}


// ===========================================================
// SECTION ORDER / VISIBILITY
// ===========================================================

function cvmRenderSectionOrderList() {
    const container =
        document.querySelector(
            "#sectionOrderList"
        );

    if (
        !container
        || !state.project
    ) {
        return;
    }

    cvmEnsureProjectLayout(
        state.project
    );

    container.innerHTML =
        state.project.design
            .section_order
            .map(
                (
                    sectionKey,
                    index
                ) => {
                    const meta =
                        CVM_SECTION_META[
                            sectionKey
                        ];

                    const visible =
                        cvmIsSectionVisible(
                            sectionKey
                        );

                    return `
                        <div
                            class="section-order-item ${
                                visible
                                    ? ""
                                    : "section-disabled"
                            }"
                            data-section-key="${escapeHtml(
                                sectionKey
                            )}"
                            data-section-index="${index}"
                        >

                            <span
                                class="section-drag-handle"
                                draggable="true"
                                title="Drag section"
                            >
                                ⋮⋮
                            </span>


                            <div class="section-order-copy">

                                <strong>
                                    ${escapeHtml(
                                        meta.label
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        meta.detail
                                    )}
                                </span>

                            </div>


                            <label
                                class="cvm-section-toggle"
                                title="Show or hide section"
                            >

                                <input
                                    type="checkbox"
                                    data-section-visibility="${sectionKey}"
                                    ${
                                        visible
                                            ? "checked"
                                            : ""
                                    }
                                >

                                <span>
                                    ${
                                        visible
                                            ? "Shown"
                                            : "Hidden"
                                    }
                                </span>

                            </label>


                            <span class="section-order-index">
                                ${String(
                                    index + 1
                                ).padStart(
                                    2,
                                    "0"
                                )}
                            </span>

                        </div>
                    `;
                }
            )
            .join("");

    cvmBindSectionOrderDrag();
}

function cvmClearSectionDragClasses() {
    document.querySelectorAll(
        ".section-order-item"
    ).forEach(
        (item) => {
            item.classList.remove(
                "dragging",
                "drag-over"
            );
        }
    );
}

function cvmBindSectionOrderDrag() {
    document.querySelectorAll(
        ".section-order-item"
    ).forEach(
        (item) => {
            const handle =
                item.querySelector(
                    ".section-drag-handle"
                );

            if (!handle) {
                return;
            }

            handle.addEventListener(
                "dragstart",
                (event) => {
                    const index =
                        Number(
                            item.dataset
                                .sectionIndex
                        );

                    cvmDragState = {
                        kind: "section",
                        fromIndex: index,
                    };

                    item.classList.add(
                        "dragging"
                    );

                    if (
                        event.dataTransfer
                    ) {
                        event.dataTransfer
                            .effectAllowed =
                            "move";

                        event.dataTransfer
                            .setData(
                                "text/plain",
                                `section:${index}`
                            );
                    }
                }
            );

            handle.addEventListener(
                "dragend",
                () => {
                    cvmClearSectionDragClasses();

                    cvmDragState =
                        null;
                }
            );

            item.addEventListener(
                "dragover",
                (event) => {
                    if (
                        cvmDragState?.kind
                        !== "section"
                    ) {
                        return;
                    }

                    event.preventDefault();

                    item.classList.add(
                        "drag-over"
                    );
                }
            );

            item.addEventListener(
                "dragleave",
                () => {
                    item.classList.remove(
                        "drag-over"
                    );
                }
            );

            item.addEventListener(
                "drop",
                (event) => {
                    if (
                        cvmDragState?.kind
                        !== "section"
                        || !state.project
                    ) {
                        return;
                    }

                    event.preventDefault();

                    const fromIndex =
                        cvmDragState
                            .fromIndex;

                    const toIndex =
                        Number(
                            item.dataset
                                .sectionIndex
                        );

                    if (
                        Number.isNaN(
                            fromIndex
                        )
                        || Number.isNaN(
                            toIndex
                        )
                        || fromIndex
                        === toIndex
                    ) {
                        cvmClearSectionDragClasses();

                        return;
                    }

                    const order = [
                        ...state.project
                            .design
                            .section_order,
                    ];

                    const [
                        moved,
                    ] = order.splice(
                        fromIndex,
                        1
                    );

                    order.splice(
                        toIndex,
                        0,
                        moved
                    );

                    state.project.design
                        .section_order =
                        order;

                    cvmDragState =
                        null;

                    cvmRenderSectionOrderList();

                    projectChanged();

                    showToast(
                        "CV section order updated.",
                        "success",
                        1600
                    );
                }
            );
        }
    );
}


// ===========================================================
// DYNAMIC ITEM DRAGGING
// ===========================================================

function cvmDecorateDynamicCards() {
    document.querySelectorAll(
        ".dynamic-card"
    ).forEach(
        (card) => {
            const removeButton =
                card.querySelector(
                    "[data-remove]"
                );

            const header =
                card.querySelector(
                    ".dynamic-card-header"
                );

            const title =
                header?.querySelector(
                    ":scope > strong"
                );

            if (
                !removeButton
                || !header
                || !title
            ) {
                return;
            }

            const collection =
                removeButton.dataset
                    .remove;

            const index =
                Number(
                    removeButton.dataset
                        .index
                );

            card.dataset
                .dragCollection =
                collection;

            card.dataset
                .dragIndex =
                String(index);

            let titleWrap =
                header.querySelector(
                    ".dynamic-card-title-wrap"
                );

            if (!titleWrap) {
                titleWrap =
                    document.createElement(
                        "div"
                    );

                titleWrap.className =
                    "dynamic-card-title-wrap";

                const handle =
                    document.createElement(
                        "span"
                    );

                handle.className =
                    "dynamic-drag-handle";

                handle.draggable =
                    true;

                handle.title =
                    "Drag to reorder";

                handle.textContent =
                    "⋮⋮";

                titleWrap.appendChild(
                    handle
                );

                titleWrap.appendChild(
                    title
                );

                header.insertBefore(
                    titleWrap,
                    removeButton
                );
            }

            const handle =
                titleWrap.querySelector(
                    ".dynamic-drag-handle"
                );

            if (
                handle
                && !handle.dataset
                    .dragBound
            ) {
                handle.dataset
                    .dragBound =
                    "true";

                handle.addEventListener(
                    "dragstart",
                    (event) => {
                        const currentIndex =
                            Number(
                                card.dataset
                                    .dragIndex
                            );

                        cvmDragState = {
                            kind: "item",
                            collection,
                            fromIndex:
                                currentIndex,
                        };

                        card.classList.add(
                            "dynamic-dragging"
                        );

                        if (
                            event.dataTransfer
                        ) {
                            event.dataTransfer
                                .effectAllowed =
                                "move";

                            event.dataTransfer
                                .setData(
                                    "text/plain",
                                    `${collection}:${currentIndex}`
                                );
                        }
                    }
                );

                handle.addEventListener(
                    "dragend",
                    () => {
                        document.querySelectorAll(
                            ".dynamic-card"
                        ).forEach(
                            (
                                element
                            ) => {
                                element
                                    .classList
                                    .remove(
                                        "dynamic-dragging",
                                        "dynamic-drag-over"
                                    );
                            }
                        );

                        cvmDragState =
                            null;
                    }
                );
            }

            if (
                !card.dataset
                    .dropBound
            ) {
                card.dataset
                    .dropBound =
                    "true";

                card.addEventListener(
                    "dragover",
                    (event) => {
                        if (
                            cvmDragState?.kind
                            !== "item"
                            || cvmDragState
                                .collection
                            !== card.dataset
                                .dragCollection
                        ) {
                            return;
                        }

                        event.preventDefault();

                        card.classList.add(
                            "dynamic-drag-over"
                        );
                    }
                );

                card.addEventListener(
                    "dragleave",
                    () => {
                        card.classList.remove(
                            "dynamic-drag-over"
                        );
                    }
                );

                card.addEventListener(
                    "drop",
                    (event) => {
                        if (
                            cvmDragState?.kind
                            !== "item"
                            || !state.project
                        ) {
                            return;
                        }

                        const targetCollection =
                            card.dataset
                                .dragCollection;

                        if (
                            cvmDragState
                                .collection
                            !== targetCollection
                        ) {
                            return;
                        }

                        event.preventDefault();

                        const fromIndex =
                            cvmDragState
                                .fromIndex;

                        const toIndex =
                            Number(
                                card.dataset
                                    .dragIndex
                            );

                        const collectionData =
                            state.project[
                                targetCollection
                            ];

                        if (
                            !Array.isArray(
                                collectionData
                            )
                            || Number.isNaN(
                                fromIndex
                            )
                            || Number.isNaN(
                                toIndex
                            )
                            || fromIndex
                            === toIndex
                        ) {
                            return;
                        }

                        const [
                            moved,
                        ] =
                            collectionData
                                .splice(
                                    fromIndex,
                                    1
                                );

                        collectionData.splice(
                            toIndex,
                            0,
                            moved
                        );

                        cvmDragState =
                            null;

                        renderDynamicSections();

                        projectChanged();

                        showToast(
                            "Item order updated.",
                            "success",
                            1500
                        );
                    }
                );
            }
        }
    );
}

const cvmBaseRenderDynamicSections =
    renderDynamicSections;

renderDynamicSections =
    function () {
        cvmBaseRenderDynamicSections();

        cvmDecorateDynamicCards();
    };


// ===========================================================
// CAPACITY ESTIMATE
// ===========================================================

function cvmEstimateCapacity() {
    if (
        !state.project
    ) {
        return 0;
    }

    const project =
        state.project;

    let units =
        10;

    units += Math.min(
        15,
        (
            project.profile
            || ""
        ).length / 22
    );

    for (
        const item
        of project.experiences
    ) {
        units +=
            9;

        units +=
            item.bullets.reduce(
                (
                    sum,
                    bullet
                ) =>
                    sum
                    + Math.max(
                        2,
                        bullet.length
                        / 65
                    ),
                0
            );

        units +=
            item.tools.length
            * 0.25;
    }

    units +=
        project.education.length
        * 6;

    units +=
        project.projects.length
        * 6;

    units +=
        project.volunteering.length
        * 5;

    units +=
        project.skills.length
        * 2.5;

    units +=
        project.languages.length
        * 1.2;

    units +=
        project.certifications.length
        * 1.2;

    const targetPages =
        project.design.page_mode
        === "2"
            ? 2
            : 1;

    const percent =
        Math.round(
            (
                units
                / (
                    targetPages
                    * 100
                )
            )
            * 100
        );

    return Math.max(
        0,
        Math.min(
            160,
            percent
        )
    );
}

function cvmRenderCapacity() {
    const percent =
        cvmEstimateCapacity();

    const value =
        document.querySelector(
            "#capacityValue"
        );

    const bar =
        document.querySelector(
            "#capacityBar"
        );

    const meter =
        document.querySelector(
            "#capacityMeter"
        );

    if (value) {
        value.textContent =
            `${percent}%`;
    }

    if (bar) {
        bar.style.width =
            `${Math.min(
                100,
                percent
            )}%`;
    }

    if (meter) {
        meter.classList.toggle(
            "warning",
            percent > 90
            && percent <= 100
        );

        meter.classList.toggle(
            "overflow",
            percent > 100
        );
    }
}


// ===========================================================
// ORDER / COLOR / PHOTO AWARE LIVE PREVIEW
// ===========================================================

function cvmPreviewSectionTitle(
    text
) {
    return `
        <div
            class="preview-section-title"
            style="
                color:${cvmDesignColor(
                    "section_titles"
                )};
                border-bottom-color:${cvmDesignColor(
                    "lines"
                )};
            "
        >
            ${escapeHtml(
                text
            )}
        </div>
    `;
}

function cvmRenderPreviewSection(
    sectionKey,
    project
) {
    if (
        !cvmIsSectionVisible(
            sectionKey
        )
    ) {
        return "";
    }

    let html =
        "";

    const roleColor =
        cvmDesignColor(
            "role_titles"
        );

    const subtitleColor =
        cvmDesignColor(
            "subtitles"
        );

    const linkColor =
        cvmDesignColor(
            "links"
        );


    // -------------------------------------------------------
    // PROFILE
    // -------------------------------------------------------

    if (
        sectionKey === "profile"
        && project.profile
    ) {
        html +=
            cvmPreviewSectionTitle(
                "PROFILE"
            );

        html += `
            <div class="preview-entry">
                ${escapeHtml(
                    project.profile
                )}
            </div>
        `;
    }


    // -------------------------------------------------------
    // EXPERIENCE
    // -------------------------------------------------------

    if (
        sectionKey
        === "experiences"
        && project.experiences
            .length
    ) {
        html +=
            cvmPreviewSectionTitle(
                "PROFESSIONAL EXPERIENCE"
            );

        for (
            const item
            of project.experiences
        ) {
            const dates =
                [
                    item.start_date,

                    item.current
                        ? "Present"
                        : item.end_date,
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " - "
                    );

            html += `
                <div class="preview-entry">

                    <div
                        class="preview-entry-header"
                        style="color:${roleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.job_title
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                dates
                            )}
                        </span>

                    </div>


                    <div
                        class="preview-entry-sub"
                        style="color:${subtitleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.company
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.location
                            )}
                        </span>

                    </div>
            `;

            if (
                item.description_mode
                === "paragraph"
                && item.paragraph
            ) {
                html += `
                    <div class="preview-bullet">
                        ${escapeHtml(
                            item.paragraph
                        )}
                    </div>
                `;
            }
            else {
                for (
                    const bullet
                    of item.bullets
                ) {
                    html += `
                        <div class="preview-bullet">
                            ${escapeHtml(
                                bullet
                            )}
                        </div>
                    `;
                }
            }

            if (
                item.tools.length
            ) {
                html += `
                    <div class="preview-tools">

                        <strong>
                            Tools:
                        </strong>

                        ${escapeHtml(
                            item.tools.join(
                                ", "
                            )
                        )}

                    </div>
                `;
            }

            html +=
                "</div>";
        }
    }


    // -------------------------------------------------------
    // EDUCATION
    // -------------------------------------------------------

    if (
        sectionKey
        === "education"
        && project.education
            .length
    ) {
        html +=
            cvmPreviewSectionTitle(
                "EDUCATION"
            );

        for (
            const item
            of project.education
        ) {
            const dates =
                [
                    item.start_date,
                    item.end_date,
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " - "
                    );

            html += `
                <div class="preview-entry">

                    <div
                        class="preview-entry-header"
                        style="color:${roleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.degree
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                dates
                            )}
                        </span>

                    </div>


                    <div
                        class="preview-entry-sub"
                        style="color:${subtitleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.school
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.location
                            )}
                        </span>

                    </div>


                    ${
                        item.details
                            ? `
                                <div>
                                    ${escapeHtml(
                                        item.details
                                    )}
                                </div>
                            `
                            : ""
                    }

                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // PROJECTS
    // -------------------------------------------------------

    if (
        sectionKey
        === "projects"
        && project.projects
            .length
    ) {
        html +=
            cvmPreviewSectionTitle(
                "PROJECTS"
            );

        for (
            const item
            of project.projects
        ) {
            html += `
                <div class="preview-entry">

                    <div
                        class="preview-entry-header"
                        style="color:${roleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.name
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.date
                            )}
                        </span>

                    </div>


                    ${
                        item.subtitle
                            ? `
                                <div
                                    class="preview-entry-sub"
                                    style="color:${subtitleColor};"
                                >
                                    <span>
                                        ${escapeHtml(
                                            item.subtitle
                                        )}
                                    </span>

                                    <span></span>
                                </div>
                            `
                            : ""
                    }
            `;

            for (
                const bullet
                of item.bullets
            ) {
                html += `
                    <div class="preview-bullet">
                        ${escapeHtml(
                            bullet
                        )}
                    </div>
                `;
            }

            if (
                item.tools.length
            ) {
                html += `
                    <div class="preview-tools">

                        <strong>
                            Tools:
                        </strong>

                        ${escapeHtml(
                            item.tools.join(
                                ", "
                            )
                        )}

                    </div>
                `;
            }

            if (
                item.link
            ) {
                html += `
                    <div
                        class="preview-tools"
                        style="color:${linkColor};"
                    >
                        Project link
                    </div>
                `;
            }

            html +=
                "</div>";
        }
    }


    // -------------------------------------------------------
    // VOLUNTEERING
    // -------------------------------------------------------

    if (
        sectionKey
        === "volunteering"
        && project.volunteering
            .length
    ) {
        html +=
            cvmPreviewSectionTitle(
                "VOLUNTEERING"
            );

        for (
            const item
            of project.volunteering
        ) {
            const dates =
                [
                    item.start_date,
                    item.end_date,
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " - "
                    );

            html += `
                <div class="preview-entry">

                    <div
                        class="preview-entry-header"
                        style="color:${roleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.role
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                dates
                            )}
                        </span>

                    </div>


                    <div
                        class="preview-entry-sub"
                        style="color:${subtitleColor};"
                    >

                        <span>
                            ${escapeHtml(
                                item.organization
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                item.location
                            )}
                        </span>

                    </div>
            `;

            for (
                const bullet
                of item.bullets
            ) {
                html += `
                    <div class="preview-bullet">
                        ${escapeHtml(
                            bullet
                        )}
                    </div>
                `;
            }

            html +=
                "</div>";
        }
    }


    // -------------------------------------------------------
    // SKILLS
    // -------------------------------------------------------

    if (
        sectionKey === "skills"
        && project.skills.some(
            (group) =>
                group.name
                || group.items.length
        )
    ) {
        html +=
            cvmPreviewSectionTitle(
                "TECHNICAL SKILLS"
            );

        for (
            const group
            of project.skills
        ) {
            if (
                !group.name
                && !group.items.length
            ) {
                continue;
            }

            html += `
                <div>

                    <strong>
                        ${escapeHtml(
                            group.name
                        )}:
                    </strong>

                    ${escapeHtml(
                        group.items.join(
                            ", "
                        )
                    )}

                </div>
            `;
        }
    }


    // -------------------------------------------------------
    // LANGUAGES
    // -------------------------------------------------------

    if (
        sectionKey
        === "languages"
        && project.languages
            .length
    ) {
        html +=
            cvmPreviewSectionTitle(
                "LANGUAGES"
            );

        html += `
            <div>

                ${project.languages
                    .map(
                        (item) => `
                            <strong>
                                ${escapeHtml(
                                    item.name
                                )}:
                            </strong>

                            ${escapeHtml(
                                item.level
                            )}
                        `
                    )
                    .join(
                        " &nbsp; | &nbsp; "
                    )}

            </div>
        `;
    }


    // -------------------------------------------------------
    // CERTIFICATIONS
    // -------------------------------------------------------

    if (
        sectionKey
        === "certifications"
        && project.certifications
            .length
    ) {
        html +=
            cvmPreviewSectionTitle(
                "CERTIFICATIONS"
            );

        html += `
            <div>

                ${project.certifications
                    .map(
                        (item) =>
                            escapeHtml(
                                `${
                                    item.name
                                }${
                                    item.issuer
                                        ? ` - ${item.issuer}`
                                        : ""
                                }${
                                    item.year
                                        ? ` (${item.year})`
                                        : ""
                                }`
                            )
                    )
                    .join(
                        " | "
                    )}

            </div>
        `;
    }

    return html;
}

function cvmRenderPreview() {
    if (
        !state.project
    ) {
        return;
    }

    collectStaticFields();

    cvmEnsureProjectLayout(
        state.project
    );

    const preview =
        document.querySelector(
            "#cvPreview"
        );

    if (!preview) {
        return;
    }

    const project =
        state.project;

    const personal =
        project.personal;

    const contacts =
        [
            personal.location,
            personal.email,
            personal.phone,

            personal.linkedin
                ? "LinkedIn"
                : "",

            personal.github
                ? "GitHub"
                : "",

            personal.website
                ? "Website"
                : "",
        ]
            .filter(
                Boolean
            )
            .join(
                " | "
            );

    let html = `
        ${
            project.design.photo_enabled
            && cvmPhotoDataUri
                ? `
                    <img
                        class="cvm-preview-photo"
                        src="${cvmPhotoDataUri}"
                        alt="CV photo"
                    >
                `
                : ""
        }

        <div
            class="preview-name"
            style="color:${cvmDesignColor(
                "name"
            )};"
        >
            ${escapeHtml(
                personal.full_name
                || "YOUR NAME"
            )}
        </div>


        <div
            class="preview-role"
            style="color:${cvmDesignColor(
                "role_titles"
            )};"
        >
            ${escapeHtml(
                [
                    personal.target_role,
                    personal
                        .secondary_target_role,
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " | "
                    )
            )}
        </div>


        <div
            class="preview-contact"
            style="color:${cvmDesignColor(
                "links"
            )};"
        >
            ${escapeHtml(
                contacts
            )}
        </div>


        <div
            class="preview-top-line"
            style="background:${cvmDesignColor(
                "lines"
            )};"
        ></div>
    `;

    for (
        const sectionKey
        of project.design
            .section_order
    ) {
        html +=
            cvmRenderPreviewSection(
                sectionKey,
                project
            );
    }

    preview.innerHTML =
        html;

    cvmRenderCapacity();
}

renderPreview =
    cvmRenderPreview;


// ===========================================================
// CUSTOM CVM MODALS / FILE BROWSER
// ===========================================================

function cvmInjectModals() {
    if (
        document.querySelector(
            "#cvmModalLayer"
        )
    ) {
        return;
    }

    document.body.insertAdjacentHTML(
        "beforeend",
        `
            <div
                id="cvmModalLayer"
                class="cvm-modal-layer hidden"
            >


                <!-- =========================================
                     FILE BROWSER
                ========================================== -->

                <section
                    id="cvmBrowserModal"
                    class="cvm-modal cvm-browser-modal hidden"
                >

                    <div class="cvm-modal-header">

                        <div>

                            <div class="eyebrow">
                                CVM FILE BROWSER
                            </div>

                            <h2 id="cvmBrowserTitle">
                                Choose a folder
                            </h2>

                        </div>


                        <button
                            type="button"
                            class="cvm-modal-close"
                            data-close-modal
                        >
                            ×
                        </button>

                    </div>


                    <div class="cvm-browser-path-row">

                        <button
                            id="cvmBrowserUp"
                            type="button"
                            class="secondary-button"
                        >
                            ↑ Up
                        </button>

                        <input
                            id="cvmBrowserPath"
                            type="text"
                            readonly
                        >

                    </div>


                    <div class="cvm-browser-body">

                        <aside
                            id="cvmBrowserShortcuts"
                            class="cvm-browser-shortcuts"
                        ></aside>

                        <div
                            id="cvmBrowserList"
                            class="cvm-browser-list"
                        ></div>

                    </div>


                    <div class="cvm-modal-footer">

                        <button
                            type="button"
                            class="secondary-button"
                            data-close-modal
                        >
                            Cancel
                        </button>

                        <button
                            id="cvmBrowserSelectFolder"
                            type="button"
                            class="primary-button"
                        >
                            Use this folder
                        </button>

                    </div>

                </section>


                <!-- =========================================
                     EXPORT
                ========================================== -->

                <section
                    id="cvmExportModal"
                    class="cvm-modal hidden"
                >

                    <div class="cvm-modal-header">

                        <div>

                            <div class="eyebrow">
                                EXPORT
                            </div>

                            <h2 id="cvmExportTitle">
                                Generate PDF
                            </h2>

                        </div>


                        <button
                            type="button"
                            class="cvm-modal-close"
                            data-close-modal
                        >
                            ×
                        </button>

                    </div>


                    <div class="cvm-modal-content">

                        <label class="field">

                            <span>
                                File name
                            </span>

                            <input
                                id="cvmExportFilename"
                                type="text"
                            >

                        </label>


                        <label class="field">

                            <span>
                                Destination
                            </span>

                            <div class="cvm-destination-row">

                                <input
                                    id="cvmExportDirectory"
                                    type="text"
                                    readonly
                                >

                                <button
                                    id="cvmExportBrowse"
                                    type="button"
                                    class="secondary-button"
                                >
                                    Browse
                                </button>

                            </div>

                        </label>


                        <div
                            id="cvmExportHint"
                            class="info-box"
                        ></div>

                    </div>


                    <div class="cvm-modal-footer">

                        <button
                            type="button"
                            class="secondary-button"
                            data-close-modal
                        >
                            Cancel
                        </button>

                        <button
                            id="cvmExportConfirm"
                            type="button"
                            class="primary-button"
                        >
                            Generate
                        </button>

                    </div>

                </section>


                <!-- =========================================
                     EXPORT SUCCESS
                ========================================== -->

                <section
                    id="cvmSuccessModal"
                    class="cvm-modal cvm-success-modal hidden"
                >

                    <div class="cvm-success-icon">
                        ✓
                    </div>

                    <h2>
                        CV exported successfully
                    </h2>

                    <p id="cvmSuccessPath"></p>

                    <div
                        id="cvmSuccessDetails"
                        class="cvm-success-details"
                    ></div>


                    <div class="cvm-modal-footer centered">

                        <button
                            id="cvmSuccessOpenFolder"
                            type="button"
                            class="secondary-button"
                        >
                            Open folder
                        </button>

                        <button
                            id="cvmSuccessClose"
                            type="button"
                            class="secondary-button"
                        >
                            Close
                        </button>

                        <button
                            id="cvmSuccessOpenFile"
                            type="button"
                            class="primary-button"
                        >
                            Open file
                        </button>

                    </div>

                </section>


                <!-- =========================================
                     ATS LOADING
                ========================================== -->

                <section
                    id="cvmAtsLoading"
                    class="cvm-modal cvm-loading-modal hidden"
                >

                    <div class="cvm-loader-ring"></div>

                    <div class="eyebrow">
                        ATS ANALYSIS
                    </div>

                    <h2>
                        Checking your CV
                    </h2>

                    <p id="cvmAtsLoadingText">
                        Inspecting CV structure…
                    </p>

                    <div class="cvm-loader-track">
                        <span></span>
                    </div>

                    <small>
                        Content · structure · exported PDF text layer
                    </small>

                </section>


                <!-- =========================================
                     CONTACT / FEEDBACK
                ========================================== -->

                <section
                    id="cvmContactModal"
                    class="cvm-modal hidden"
                >

                    <div class="cvm-modal-header">

                        <div>

                            <div class="eyebrow">
                                CONTACT / FEEDBACK
                            </div>

                            <h2>
                                Prepare a CVM request
                            </h2>

                        </div>


                        <button
                            type="button"
                            class="cvm-modal-close"
                            data-close-modal
                        >
                            ×
                        </button>

                    </div>


                    <div class="cvm-modal-content">

                        <div class="cvm-contact-types">

                            ${[
                                "Technical problem",
                                "Problem with CV",
                                "Suggestion",
                                "Thank you",
                                "Other",
                            ]
                                .map(
                                    (
                                        label,
                                        index
                                    ) => `
                                        <label class="cvm-contact-choice">

                                            <input
                                                type="radio"
                                                name="cvmContactType"
                                                value="${label}"
                                                ${
                                                    index === 0
                                                        ? "checked"
                                                        : ""
                                                }
                                            >

                                            <span>
                                                ${label}
                                            </span>

                                        </label>
                                    `
                                )
                                .join("")}

                        </div>


                        <label
                            id="cvmContactOtherWrap"
                            class="field hidden"
                        >

                            <span>
                                Custom request title
                            </span>

                            <input
                                id="cvmContactOther"
                                type="text"
                                placeholder="Describe the request type"
                            >

                        </label>


                        <label class="field">

                            <span>
                                User name (optional)
                            </span>

                            <input
                                id="cvmContactName"
                                type="text"
                                placeholder="Your name"
                            >

                        </label>


                        <label class="field">

                            <span>
                                Problem / message
                            </span>

                            <textarea
                                id="cvmContactMessage"
                                rows="7"
                                placeholder="Tell me what happened or what you would like to suggest..."
                            ></textarea>

                        </label>


                        <div class="info-box">
                            Direct sending is intentionally not connected yet. CVM can copy a structured request for now; we can connect a private contact service later without exposing an email address.
                        </div>

                    </div>


                    <div class="cvm-modal-footer">

                        <button
                            type="button"
                            class="secondary-button"
                            data-close-modal
                        >
                            Cancel
                        </button>

                        <button
                            id="cvmContactCopy"
                            type="button"
                            class="primary-button"
                        >
                            Copy request
                        </button>

                    </div>

                </section>

            </div>
        `
    );
}

function cvmShowModal(id) {
    const layer =
        document.querySelector(
            "#cvmModalLayer"
        );

    if (!layer) {
        return;
    }

    layer.classList.remove(
        "hidden"
    );

    layer.querySelectorAll(
        ".cvm-modal"
    ).forEach(
        (modal) => {
            modal.classList.toggle(
                "hidden",
                modal.id !== id
            );
        }
    );
}

function cvmCloseModals() {
    document.querySelector(
        "#cvmModalLayer"
    )?.classList.add(
        "hidden"
    );

    document.querySelectorAll(
        "#cvmModalLayer .cvm-modal"
    ).forEach(
        (modal) => {
            modal.classList.add(
                "hidden"
            );
        }
    );
}

async function cvmRenderBrowser(
    path = ""
) {
    const result =
        await window.pywebview.api
            .browse_path(
                path,
                cvmBrowserMode
            );

    if (
        !result.ok
    ) {
        showToast(
            result.message
            || "Unable to browse this location.",
            "error"
        );

        return;
    }

    document.querySelector(
        "#cvmBrowserPath"
    ).value =
        result.current;

    document.querySelector(
        "#cvmBrowserUp"
    ).dataset.parent =
        result.parent
        || "";

    document.querySelector(
        "#cvmBrowserShortcuts"
    ).innerHTML = `
        ${result.shortcuts
            .map(
                (item) => `
                    <button
                        type="button"
                        data-browser-path="${escapeHtml(
                            item.path
                        )}"
                    >

                        <strong>
                            ${escapeHtml(
                                item.name
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                item.path
                            )}
                        </span>

                    </button>
                `
            )
            .join("")}

        ${result.drives
            .map(
                (drive) => `
                    <button
                        type="button"
                        data-browser-path="${escapeHtml(
                            drive
                        )}"
                    >

                        <strong>
                            ${escapeHtml(
                                drive
                            )}
                        </strong>

                        <span>
                            Drive
                        </span>

                    </button>
                `
            )
            .join("")}
    `;

    const rows =
        [];

    for (
        const item
        of result.directories
    ) {
        rows.push(`
            <button
                type="button"
                class="cvm-browser-row folder"
                data-browser-path="${escapeHtml(
                    item.path
                )}"
            >

                <span class="cvm-browser-icon">
                    ▰
                </span>

                <span>
                    ${escapeHtml(
                        item.name
                    )}
                </span>

                <small>
                    Folder
                </small>

            </button>
        `);
    }

    for (
        const item
        of result.files
    ) {
        rows.push(`
            <button
                type="button"
                class="cvm-browser-row file"
                data-browser-file="${escapeHtml(
                    item.path
                )}"
            >

                <span class="cvm-browser-icon">
                    ▧
                </span>

                <span>
                    ${escapeHtml(
                        item.name
                    )}
                </span>

                <small>
                    ${escapeHtml(
                        item.extension
                            .toUpperCase()
                    )}
                </small>

            </button>
        `);
    }

    document.querySelector(
        "#cvmBrowserList"
    ).innerHTML =
        rows.length
            ? rows.join("")
            : `
                <div class="cvm-browser-empty">
                    Nothing to show here.
                </div>
            `;

    document.querySelector(
        "#cvmBrowserSelectFolder"
    ).classList.toggle(
        "hidden",
        cvmBrowserMode === "photo"
        || cvmBrowserMode === "project"
    );
}

async function cvmOpenBrowser(
    mode,
    startPath,
    callback
) {
    if (
        !bridgeApiAvailable()
    ) {
        return;
    }

    cvmBrowserMode =
        mode;

    cvmBrowserCallback =
        callback;

    document.querySelector(
        "#cvmBrowserTitle"
    ).textContent =
        mode === "photo"
            ? "Choose a PNG or JPG photo"
            : mode === "project"
                ? "Open a CV Maker project"
                : "Choose export folder";

    cvmShowModal(
        "cvmBrowserModal"
    );

    await cvmRenderBrowser(
        startPath
    );
}


// ===========================================================
// CUSTOM EXPORT WORKFLOW
// ===========================================================

async function cvmOpenExportModal(
    format
) {
    if (
        !cvmProjectActive
        || !bridgeApiAvailable()
        || !state.project
    ) {
        return;
    }

    collectStaticFields();

    cvmExportFormat =
        format;

    const defaults =
        await window.pywebview.api
            .get_export_defaults(
                state.project,
                format
            );

    if (
        !defaults.ok
    ) {
        return;
    }

    document.querySelector(
        "#cvmExportTitle"
    ).textContent =
        format === "pdf"
            ? "Generate PDF"
            : "Generate DOCX";

    document.querySelector(
        "#cvmExportFilename"
    ).value =
        defaults.filename;

    document.querySelector(
        "#cvmExportDirectory"
    ).value =
        defaults.directory;

    document.querySelector(
        "#cvmExportHint"
    ).textContent =
        format === "pdf"
            ? "CVM will compile the LaTeX template, auto-fit the selected page target when enabled, then verify the exported PDF text layer."
            : "CVM will generate an editable Word document from the same structured project data.";

    cvmShowModal(
        "cvmExportModal"
    );
}

exportPdf =
    async function () {
        await cvmOpenExportModal(
            "pdf"
        );
    };

exportDocx =
    async function () {
        await cvmOpenExportModal(
            "docx"
        );
    };

async function cvmConfirmExport() {
    collectStaticFields();

    const filename =
        document.querySelector(
            "#cvmExportFilename"
        ).value.trim();

    const directory =
        document.querySelector(
            "#cvmExportDirectory"
        ).value.trim();

    const button =
        document.querySelector(
            "#cvmExportConfirm"
        );

    if (
        !filename
        || !directory
    ) {
        showToast(
            "Choose a destination and file name.",
            "warning"
        );

        return;
    }

    button.disabled =
        true;

    button.textContent =
        "Generating…";

    try {
        const result =
            cvmExportFormat === "pdf"
                ? await window.pywebview.api
                    .export_pdf_to_path(
                        state.project,
                        directory,
                        filename
                    )
                : await window.pywebview.api
                    .export_docx_to_path(
                        state.project,
                        directory,
                        filename
                    );

        if (
            !result.ok
        ) {
            showToast(
                result.message
                || "Export failed.",
                "error",
                5000
            );

            return;
        }

        cvmLastExportPath =
            cvmExportFormat === "pdf"
                ? result.pdf_path
                : result.docx_path;

        document.querySelector(
            "#cvmSuccessPath"
        ).textContent =
            cvmLastExportPath;

        const details =
            document.querySelector(
                "#cvmSuccessDetails"
            );

        if (
            cvmExportFormat === "pdf"
        ) {
            const validation =
                result.validation
                || {};

            const fit =
                result.fit
                || {};

            details.innerHTML = `
                <span
                    class="${
                        validation.passed
                            ? "ok"
                            : "warn"
                    }"
                >
                    ${
                        validation.passed
                            ? "✓"
                            : "!"
                    }
                    PDF parsing
                    ${
                        validation.passed
                            ? "passed"
                            : "needs review"
                    }
                </span>

                <span>
                    ${
                        fit.actual_pages
                        || validation.page_count
                        || "?"
                    }
                    page(s)
                </span>

                ${
                    fit.auto_fit_used
                        ? `
                            <span>
                                Auto-fit level
                                ${fit.compact_level}
                            </span>
                        `
                        : ""
                }
            `;
        }
        else {
            details.innerHTML = `
                <span class="ok">
                    ✓ Editable DOCX created
                </span>
            `;
        }

        cvmShowModal(
            "cvmSuccessModal"
        );

        showToast(
            `${cvmExportFormat.toUpperCase()} exported successfully.`,
            "success"
        );
    }
    finally {
        button.disabled =
            false;

        button.textContent =
            "Generate";
    }
}


// ===========================================================
// ATS WITH REAL PDF AUDIT + MINIMUM LOADING TIME
// ===========================================================

runAtsCheck =
    async function () {
        if (
            !cvmProjectActive
            || !bridgeApiAvailable()
            || !state.project
        ) {
            return;
        }

        collectStaticFields();

        const messages = [
            "Inspecting CV structure…",
            "Checking contact information and sections…",
            "Compiling a temporary PDF for parsing…",
            "Extracting PDF text and reading order…",
            "Calculating ATS-readiness results…",
        ];

        let messageIndex =
            0;

        const text =
            document.querySelector(
                "#cvmAtsLoadingText"
            );

        if (text) {
            text.textContent =
                messages[0];
        }

        cvmShowModal(
            "cvmAtsLoading"
        );

        const ticker =
            window.setInterval(
                () => {
                    messageIndex =
                        Math.min(
                            messageIndex + 1,
                            messages.length - 1
                        );

                    if (text) {
                        text.textContent =
                            messages[
                                messageIndex
                            ];
                    }
                },
                620
            );

        const minimumDelay =
            new Promise(
                (resolve) => {
                    window.setTimeout(
                        resolve,
                        3000
                    );
                }
            );

        try {
            const [
                response,
            ] =
                await Promise.all([
                    window.pywebview.api
                        .analyze_ats(
                            state.project
                        ),

                    minimumDelay,
                ]);

            if (
                !response.ok
            ) {
                showToast(
                    response.message
                    || "ATS analysis failed.",
                    "error"
                );

                return;
            }

            const result =
                response.result;

            const container =
                document.querySelector(
                    "#atsResults"
                );

            container.className =
                "analysis-panel";

            container.innerHTML = `
                <div class="score-card">

                    <div class="score-circle">
                        ${result.score}
                    </div>

                    <div>

                        <div class="eyebrow">
                            CVM ATS READINESS
                        </div>

                        <h2>
                            ${escapeHtml(
                                result.label
                            )}
                        </h2>

                        <p>
                            ${escapeHtml(
                                result.note
                            )}
                        </p>

                        <small>
                            ${
                                result.checks_run
                                || 0
                            }
                            checks reported
                        </small>

                    </div>

                </div>

                ${analysisList(
                    "Issues",
                    result.issues
                    || []
                )}

                ${analysisList(
                    "Warnings",
                    result.warnings
                    || []
                )}

                ${analysisList(
                    "Passed checks",
                    result.passed
                    || []
                )}

                ${analysisList(
                    "Technical verification",
                    result.technical
                    || []
                )}
            `;
        }
        catch (error) {
            console.error(
                error
            );

            showToast(
                "ATS analysis failed.",
                "error"
            );
        }
        finally {
            window.clearInterval(
                ticker
            );

            cvmCloseModals();
        }
    };


// ===========================================================
// JOB MATCH V2
// ===========================================================

runJobMatch =
    async function () {
        if (
            !cvmProjectActive
            || !bridgeApiAvailable()
            || !state.project
        ) {
            return;
        }

        collectStaticFields();

        const description =
            document.querySelector(
                "#jobDescription"
            )?.value
            || "";

        const container =
            document.querySelector(
                "#jobResults"
            );

        if (
            !description.trim()
        ) {
            showToast(
                "Paste a job description first.",
                "warning"
            );

            return;
        }

        container.className =
            "analysis-empty";

        container.innerHTML = `
            <div class="cvm-inline-loader">

                <span></span>

                Analysing role, required skills and keywords…

            </div>
        `;

        try {
            const response =
                await window.pywebview.api
                    .analyze_job_match(
                        state.project,
                        description
                    );

            if (
                !response.ok
            ) {
                container.textContent =
                    response.message
                    || "Job Match failed.";

                return;
            }

            const result =
                response.result;

            container.className =
                "analysis-panel";

            container.innerHTML = `
                <div class="score-card">

                    <div class="score-circle">
                        ${result.score}%
                    </div>

                    <div>

                        <div class="eyebrow">
                            JOB MATCH V2
                        </div>

                        <h2>
                            ${escapeHtml(
                                result.detected_role
                                || "Job description"
                            )}
                        </h2>

                        <p>
                            ${escapeHtml(
                                result.note
                            )}
                        </p>

                        <small>
                            Skills
                            ${result.skill_score}%
                            · Keywords
                            ${result.keyword_score}%
                            · Target role
                            ${
                                result.role_match
                                    ? "matched"
                                    : "not matched"
                            }
                        </small>

                    </div>

                </div>

                ${tagSection(
                    "Matched skills",
                    result.matched_skills
                    || [],
                    "matched"
                )}

                ${tagSection(
                    "Required skills not found in your CV",
                    result.required_missing
                    || [],
                    "missing"
                )}

                ${tagSection(
                    "Preferred skills not found in your CV",
                    result.preferred_missing
                    || [],
                    "missing"
                )}

                ${tagSection(
                    "Other missing skills",
                    (
                        result.missing_skills
                        || []
                    ).filter(
                        (item) =>
                            !(
                                result.required_missing
                                || []
                            ).includes(
                                item
                            )
                            &&
                            !(
                                result.preferred_missing
                                || []
                            ).includes(
                                item
                            )
                    ),
                    "missing"
                )}

                ${tagSection(
                    "Matched job keywords",
                    result.matched_keywords
                    || [],
                    "matched"
                )}

                ${tagSection(
                    "Other job keywords",
                    result.missing_keywords
                    || [],
                    "missing"
                )}
            `;
        }
        catch (error) {
            console.error(
                error
            );

            container.textContent =
                "Job Match failed.";
        }
    };


// ===========================================================
// CONTACT / FEEDBACK (LOCAL FOR NOW)
// ===========================================================

async function cvmCopyContactRequest() {
    const selected =
        document.querySelector(
            'input[name="cvmContactType"]:checked'
        )?.value
        || "Other";

    const custom =
        document.querySelector(
            "#cvmContactOther"
        )?.value
            .trim()
        || "";

    const name =
        document.querySelector(
            "#cvmContactName"
        )?.value
            .trim()
        || "";

    const message =
        document.querySelector(
            "#cvmContactMessage"
        )?.value
            .trim()
        || "";

    const title =
        selected === "Other"
        && custom
            ? custom
            : selected;

    if (
        !message
    ) {
        showToast(
            "Write your message first.",
            "warning"
        );

        return;
    }

    const payload = [
        `${title} - CV Maker app`,
        `CVM version: ${state.appVersion}`,
        `User name: ${
            name
            || "Not provided"
        }`,
        "",
        message,
    ].join(
        "\n"
    );

    try {
        await navigator.clipboard
            .writeText(
                payload
            );

        showToast(
            "Contact request copied.",
            "success"
        );

        cvmCloseModals();
    }
    catch (error) {
        showToast(
            "Could not copy the request.",
            "error"
        );
    }
}


// ===========================================================
// BINDINGS
// ===========================================================

function cvmBindV04Features() {
    cvmBuildDesignControls();
    cvmInjectModals();

    const appNav =
        document.querySelector(
            ".nav-list.compact"
        );

    if (
        appNav
        && !document.querySelector(
            "#contactBtn"
        )
    ) {
        appNav.insertAdjacentHTML(
            "beforeend",
            `
                <button
                    id="contactBtn"
                    class="nav-item"
                    type="button"
                >

                    <span class="nav-icon">
                        ?
                    </span>

                    <span>
                        Contact
                    </span>

                </button>
            `
        );
    }

    cvmSetProjectActive(
        false
    );


    // -------------------------------------------------------
    // GENERIC CLICK HANDLING
    // -------------------------------------------------------

    document.addEventListener(
        "click",
        (event) => {
            const swatch =
                event.target.closest(
                    "[data-color-target-input]"
                );

            if (swatch) {
                const textId =
                    swatch.dataset
                        .colorTargetInput;

                const color =
                    swatch.dataset
                        .color;

                const pickerId =
                    textId
                    === "accentColorText"
                        ? "accentColor"
                        : "secondaryColor";

                cvmSetColorPair(
                    textId,
                    pickerId,
                    color
                );

                projectChanged();

                return;
            }


            const browserPath =
                event.target.closest(
                    "[data-browser-path]"
                );

            if (browserPath) {
                cvmRenderBrowser(
                    browserPath.dataset
                        .browserPath
                );

                return;
            }


            const browserFile =
                event.target.closest(
                    "[data-browser-file]"
                );

            if (
                browserFile
                && (
                    cvmBrowserMode
                    === "photo"
                    ||
                    cvmBrowserMode
                    === "project"
                )
            ) {
                const selectedPath =
                    browserFile.dataset
                        .browserFile;

                const callback =
                    cvmBrowserCallback;

                cvmCloseModals();

                callback?.(
                    selectedPath
                );

                return;
            }


            if (
                event.target.closest(
                    "[data-close-modal]"
                )
            ) {
                cvmCloseModals();

                return;
            }
        }
    );


    // -------------------------------------------------------
    // DESIGN CHANGES
    // -------------------------------------------------------

    document.addEventListener(
        "change",
        (event) => {
            const target =
                event.target;

            if (
                target.matches(
                    "#useColor, #secondaryColorEnabled, #autoFit, #pageMode"
                )
            ) {
                cvmUpdateDesignVisibility();

                projectChanged();
            }

            if (
                target.matches(
                    '[data-color-group="primary"], [data-color-group="secondary"]'
                )
            ) {
                projectChanged();
            }

            if (
                target.matches(
                    "#photoEnabled"
                )
            ) {
                if (
                    !state.project
                ) {
                    return;
                }

                state.project.design
                    .photo_enabled =
                    target.checked;

                cvmUpdateDesignVisibility();

                projectChanged();
            }

            if (
                target.matches(
                    "[data-section-visibility]"
                )
            ) {
                const key =
                    target.dataset
                        .sectionVisibility;

                state.project.design
                    .section_visibility[
                        key
                    ] =
                    target.checked;

                cvmRenderSectionOrderList();

                projectChanged();
            }

            if (
                target.name
                === "cvmContactType"
            ) {
                document.querySelector(
                    "#cvmContactOtherWrap"
                )?.classList.toggle(
                    "hidden",
                    target.value
                    !== "Other"
                );
            }
        }
    );


    // -------------------------------------------------------
    // COLOR PICKERS
    // -------------------------------------------------------

    document.addEventListener(
        "input",
        (event) => {
            if (
                event.target.matches(
                    "#accentColor"
                )
            ) {
                cvmSetColorPair(
                    "accentColorText",
                    "accentColor",
                    event.target.value
                );

                projectChanged();
            }

            if (
                event.target.matches(
                    "#secondaryColor"
                )
            ) {
                cvmSetColorPair(
                    "secondaryColorText",
                    "secondaryColor",
                    event.target.value
                );

                projectChanged();
            }
        }
    );


    // -------------------------------------------------------
    // MANUAL HEX COLORS
    // -------------------------------------------------------

    document.addEventListener(
        "change",
        (event) => {
            if (
                event.target.matches(
                    "#accentColorText"
                )
            ) {
                if (
                    cvmSetColorPair(
                        "accentColorText",
                        "accentColor",
                        event.target.value
                    )
                ) {
                    projectChanged();
                }
                else {
                    showToast(
                        "Use a 6-digit HEX color such as #8B1540.",
                        "warning"
                    );
                }
            }

            if (
                event.target.matches(
                    "#secondaryColorText"
                )
            ) {
                if (
                    cvmSetColorPair(
                        "secondaryColorText",
                        "secondaryColor",
                        event.target.value
                    )
                ) {
                    projectChanged();
                }
                else {
                    showToast(
                        "Use a 6-digit HEX color such as #4F46E5.",
                        "warning"
                    );
                }
            }
        }
    );


    // -------------------------------------------------------
    // PHOTO
    // -------------------------------------------------------

    safeOn(
        "#photoSelectBtn",
        "click",
        async () => {
            const start =
                state.project
                    ?.design
                    ?.photo_path
                || "";

            await cvmOpenBrowser(
                "photo",
                start,
                async (
                    selectedPath
                ) => {
                    const result =
                        await window.pywebview.api
                            .load_photo_preview(
                                selectedPath
                            );

                    if (
                        !result.ok
                    ) {
                        showToast(
                            result.message,
                            "error"
                        );

                        return;
                    }

                    state.project.design
                        .photo_path =
                        result.path;

                    state.project.design
                        .photo_enabled =
                        true;

                    cvmPhotoDataUri =
                        result.data_uri;

                    cvmSyncDesignControls();

                    cvmRefreshPhotoPreview();

                    projectChanged();
                }
            );
        }
    );

    safeOn(
        "#photoRemoveBtn",
        "click",
        cvmRemovePhoto
    );


    // -------------------------------------------------------
    // FILE BROWSER
    // -------------------------------------------------------

    safeOn(
        "#cvmBrowserUp",
        "click",
        () => {
            const parent =
                document.querySelector(
                    "#cvmBrowserUp"
                )?.dataset
                    .parent;

            if (parent) {
                cvmRenderBrowser(
                    parent
                );
            }
        }
    );

    safeOn(
        "#cvmBrowserSelectFolder",
        "click",
        () => {
            const current =
                document.querySelector(
                    "#cvmBrowserPath"
                )?.value
                || "";

            const callback =
                cvmBrowserCallback;

            cvmCloseModals();

            callback?.(
                current
            );
        }
    );


    // -------------------------------------------------------
    // EXPORT
    // -------------------------------------------------------

    safeOn(
        "#cvmExportBrowse",
        "click",
        async () => {
            const current =
                document.querySelector(
                    "#cvmExportDirectory"
                )?.value
                || "";

            await cvmOpenBrowser(
                "folder",
                current,
                (folder) => {
                    document.querySelector(
                        "#cvmExportDirectory"
                    ).value =
                        folder;

                    cvmShowModal(
                        "cvmExportModal"
                    );
                }
            );
        }
    );

    safeOn(
        "#cvmExportConfirm",
        "click",
        cvmConfirmExport
    );

    safeOn(
        "#cvmSuccessOpenFile",
        "click",
        async () => {
            await window.pywebview.api
                .open_file(
                    cvmLastExportPath
                );
        }
    );

    safeOn(
        "#cvmSuccessOpenFolder",
        "click",
        async () => {
            await window.pywebview.api
                .open_parent_folder(
                    cvmLastExportPath
                );
        }
    );

    safeOn(
        "#cvmSuccessClose",
        "click",
        cvmCloseModals
    );


    // -------------------------------------------------------
    // CONTACT
    // -------------------------------------------------------

    safeOn(
        "#contactBtn",
        "click",
        () => {
            cvmShowModal(
                "cvmContactModal"
            );
        }
    );

    safeOn(
        "#cvmContactCopy",
        "click",
        cvmCopyContactRequest
    );


    // -------------------------------------------------------
    // QUICK EXPORT
    // -------------------------------------------------------

    safeOn(
        "#quickPdfBtn",
        "click",
        () =>
            cvmOpenExportModal(
                "pdf"
            )
    );

    safeOn(
        "#quickDocxBtn",
        "click",
        () =>
            cvmOpenExportModal(
                "docx"
            )
    );

    safeOn(
        "#exportOpenFolderBtn",
        "click",
        () =>
            openFolder(
                "open_exports_folder"
            )
    );


    // -------------------------------------------------------
    // INITIAL SYNC
    // -------------------------------------------------------

    cvmSyncDesignControls();
    cvmRenderSectionOrderList();
    cvmDecorateDynamicCards();
}


document.addEventListener(
    "DOMContentLoaded",
    cvmBindV04Features
);
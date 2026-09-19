"use strict";

// CVM consolidated product UI.
// Replaces the temporary features_v073 / v074 / v075 patch layers.

const cvmProduct = {
    initialized: false,
    templates: [],
    selectedTemplateId: null,
    baseRenderPreview: null,
    baseShowPage: null,
    baseLatexLabels: null,
    atsRunning: false,
};

const CVM_PRODUCT_FALLBACK_TEMPLATES = [
    {
    id: "classic_ats",
    title: "Classic ATS",
    description:
        "Clean single-column CV with maximum readability and selectable text.",
    category: "ATS-first",
    layout: "single",
    accent: "#8B1540",
    has_photo: false,
    has_qr: false,
    ats_note: "ATS-friendly structure",
},
    {
        id: "modern_gold",
        title: "Modern Gold",
        description:
            "Premium cream, ink and gold styling with a modern single-column layout.",
        category: "Modern",
        layout: "single",
        accent: "#BC965D",
        has_photo: false,
        has_qr: false,
        ats_note: "Readable, light visual styling",
    },
    {
        id: "navy_executive",
        title: "Navy Executive",
        description:
            "Executive header with dark navy and gold accents inspired by the CVM brand.",
        category: "Executive",
        layout: "single",
        accent: "#D0AA70",
        has_photo: false,
        has_qr: false,
        ats_note: "Visual header, still text-based",
    },
    {
        id: "two_column",
        title: "Two Column",
        description:
            "Visual two-column layout with a compact skills and links sidebar.",
        category: "Visual",
        layout: "two-column",
        accent: "#BC965D",
        has_photo: false,
        has_qr: false,
        ats_note: "More visual, less ATS-focused",
    },
    {
        id: "photo_profile",
        title: "Photo Profile",
        description:
            "Modern profile CV with a photo area and premium gold details.",
        category: "Photo",
        layout: "photo",
        accent: "#BC965D",
        has_photo: true,
        has_qr: false,
        ats_note: "Best for markets where photo CVs are appropriate",
    },
    {
        id: "qr_contact",
        title: "QR Contact",
        description:
            "Compact professional CV with a QR code for portfolio or contact details.",
        category: "QR",
        layout: "qr",
        accent: "#D0AA70",
        has_photo: false,
        has_qr: true,
        ats_note:
            "QR is supplementary; core contact text remains visible",
    },
];

function cvmProductLang() {
    try {
        if (
            typeof cvmCurrentLanguage !== "undefined"
            && cvmCurrentLanguage === "fr"
        ) {
            return "fr";
        }
    }
    catch (_) {
    }

    return document.documentElement.lang === "fr"
        ? "fr"
        : "en";
}

function cvmProductText(
    en,
    fr
) {
    return cvmProductLang() === "fr"
        ? fr
        : en;
}

function cvmProductEscape(
    value
) {
    if (
        typeof escapeHtml === "function"
    ) {
        return escapeHtml(
            value
        );
    }

    return String(
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
        );
}

function cvmProductApi() {
    return (
        window.pywebview?.api
        || null
    );
}

function cvmProductToast(
    message,
    type = "info"
) {
    if (
        typeof showToast === "function"
    ) {
        showToast(
            message,
            type
        );
    }
    else {
        console.log(
            `[CVM ${type}] ${message}`
        );
    }
}


// ===========================================================
// EDITOR SCROLL + HTML PREVIEW SPACING
// ===========================================================

function cvmProductResetEditorScroll() {
    requestAnimationFrame(
        () => {
            const scroller =
                document.querySelector(
                    ".cvm-editor-left-scroll"
                );

            if (scroller) {
                scroller.scrollTop =
                    0;

                scroller.scrollLeft =
                    0;
            }

            document
                .querySelectorAll(
                    ".cvm-editor-page, .cvm-editor-page-active"
                )
                .forEach(
                    (page) => {
                        page.scrollTop =
                            0;
                    }
                );
        }
    );
}

function cvmProductNumber(
    value,
    fallback
) {
    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? number
        : fallback;
}

function cvmProductSpacing() {
    const current =
        state?.project?.design?.spacing
        || {};

    const defaults =
        typeof CVM_V06_SPACING_DEFAULTS
            !== "undefined"
            ? CVM_V06_SPACING_DEFAULTS
            : {};

    const get =
        (
            key,
            fallback
        ) =>
            cvmProductNumber(
                current[key],
                cvmProductNumber(
                    defaults[key],
                    fallback
                )
            );

    return {
        get,

        pageTop:
            get(
                "page_top_mm",
                7
            ),

        pageBottom:
            get(
                "page_bottom_mm",
                7
            ),

        pageLeft:
            get(
                "page_left_mm",
                9
            ),

        pageRight:
            get(
                "page_right_mm",
                9
            ),

        sectionGap:
            get(
                "section_gap_mm",
                1
            ),

        titleBefore:
            get(
                "title_before_mm",
                0
            ),

        titleAfter:
            get(
                "title_after_mm",
                0.6
            ),

        separatorGap:
            get(
                "separator_gap_mm",
                0.2
            ),

        entryGap:
            get(
                "entry_gap_mm",
                1
            ),

        bulletGap:
            get(
                "bullet_gap_mm",
                0.2
            ),

        bodyLineHeight:
            get(
                "body_line_height",
                1.11
            ),
    };
}

function cvmProductSectionKey(
    text
) {
    const key =
        String(
            text || ""
        )
            .normalize(
                "NFD"
            )
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .trim()
            .toUpperCase();

    return ({
        PROFILE:
            "profile",

        PROFIL:
            "profile",

        "PROFESSIONAL EXPERIENCE":
            "experiences",

        "EXPERIENCE PROFESSIONNELLE":
            "experiences",

        EXPERIENCE:
            "experiences",

        EDUCATION:
            "education",

        FORMATION:
            "education",

        PROJECTS:
            "projects",

        PROJETS:
            "projects",

        VOLUNTEERING:
            "volunteering",

        BENEVOLAT:
            "volunteering",

        "TECHNICAL SKILLS":
            "skills",

        SKILLS:
            "skills",

        COMPETENCES:
            "skills",

        "COMPETENCES TECHNIQUES":
            "skills",

        LANGUAGES:
            "languages",

        LANGUES:
            "languages",

        CERTIFICATIONS:
            "certifications",
    })[key] || null;
}

function cvmProductApplyPreviewSpacing() {
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

    const s =
        cvmProductSpacing();

    const vars = {
        "--cvm-preview-page-top":
            `${s.pageTop}mm`,

        "--cvm-preview-page-bottom":
            `${s.pageBottom}mm`,

        "--cvm-preview-page-left":
            `${s.pageLeft}mm`,

        "--cvm-preview-page-right":
            `${s.pageRight}mm`,

        "--cvm-preview-section-gap":
            `${s.sectionGap}mm`,

        "--cvm-preview-title-before":
            `${s.titleBefore}mm`,

        "--cvm-preview-title-after":
            `${s.titleAfter}mm`,

        "--cvm-preview-separator-gap":
            `${s.separatorGap}mm`,

        "--cvm-preview-entry-gap":
            `${s.entryGap}mm`,

        "--cvm-preview-bullet-gap":
            `${s.bulletGap}mm`,

        "--cvm-preview-body-line-height":
            String(
                s.bodyLineHeight
            ),
    };

    Object.entries(
        vars
    )
        .forEach(
            (
                [
                    key,
                    value,
                ]
            ) => {
                preview.style
                    .setProperty(
                        key,
                        value
                    );
            }
        );

    let section =
        null;

    let lastNode =
        null;

    const finishSection =
        () => {
            if (
                section
                && lastNode
            ) {
                lastNode.style
                    .setProperty(
                        "margin-bottom",
                        `${
                            s.get(
                                `${section}_after_mm`,
                                0
                            )
                        }mm`,
                        "important"
                    );
            }
        };

    for (
        const child
        of Array.from(
            preview.children
        )
    ) {
        if (
            child.classList
                .contains(
                    "preview-section-title"
                )
        ) {
            finishSection();

            section =
                cvmProductSectionKey(
                    child.textContent
                );

            lastNode =
                null;

            const before =
                section
                    ? s.get(
                        `${section}_before_mm`,
                        0
                    )
                    : 0;

            child.style
                .setProperty(
                    "margin-top",
                    `calc(${s.sectionGap}mm + ${s.titleBefore}mm + ${before}mm)`,
                    "important"
                );

            child.style
                .setProperty(
                    "padding-bottom",
                    `${s.titleAfter}mm`,
                    "important"
                );

            child.style
                .setProperty(
                    "margin-bottom",
                    `${s.separatorGap}mm`,
                    "important"
                );

            continue;
        }

        if (!section) {
            continue;
        }

        const lineHeight =
            s.get(
                `${section}_line_height`,
                s.bodyLineHeight
            );

        child.style
            .setProperty(
                "line-height",
                String(
                    lineHeight
                ),
                "important"
            );

        child
            .querySelectorAll(
                ".preview-entry-sub, .preview-bullet, .preview-tools"
            )
            .forEach(
                (node) => {
                    node.style
                        .setProperty(
                            "line-height",
                            String(
                                lineHeight
                            ),
                            "important"
                        );
                }
            );

        lastNode =
            child;
    }

    finishSection();
}

function cvmProductInstallPreviewHook() {
    if (
        typeof renderPreview
            !== "function"
        || cvmProduct
            .baseRenderPreview
    ) {
        return;
    }

    cvmProduct.baseRenderPreview =
        renderPreview;

    renderPreview =
        function (
            ...args
        ) {
            const result =
                cvmProduct
                    .baseRenderPreview
                    .apply(
                        this,
                        args
                    );

            queueMicrotask(
                cvmProductApplyPreviewSpacing
            );

            return result;
        };

    window.renderPreview =
        renderPreview;

    cvmProductApplyPreviewSpacing();
}


// ===========================================================
// LATEX TEMPLATE GALLERY
// ===========================================================

function cvmProductSetTemplateButtonLabel() {
    const button =
        document.querySelector(
            "#cvmLatexStarterBtn"
        );

    if (!button) {
        return;
    }

    button.textContent =
        cvmProductText(
            "Templates",
            "Modèles"
        );

    button.title =
        cvmProductText(
            "Choose a LaTeX template",
            "Choisir un modèle LaTeX"
        );
}

function cvmProductInstallLatexLabelHook() {
    if (
        typeof cvmV07RefreshLatexLabels
            !== "function"
        || cvmProduct
            .baseLatexLabels
    ) {
        return;
    }

    cvmProduct.baseLatexLabels =
        cvmV07RefreshLatexLabels;

    cvmV07RefreshLatexLabels =
        function (
            ...args
        ) {
            const result =
                cvmProduct
                    .baseLatexLabels
                    .apply(
                        this,
                        args
                    );

            cvmProductSetTemplateButtonLabel();

            cvmProductRefreshGalleryLabels();

            return result;
        };

    window.cvmV07RefreshLatexLabels =
        cvmV07RefreshLatexLabels;
}

function cvmProductBuildGallery() {
    const existing =
        document.querySelector(
            "#cvmProductTemplateGallery"
        );

    if (existing) {
        return existing;
    }

    const shell =
        document.querySelector(
            ".cvm-latex-shell"
        );

    if (!shell) {
        return null;
    }

    const gallery =
        document.createElement(
            "section"
        );

    gallery.id =
        "cvmProductTemplateGallery";

    gallery.className =
        "cvm-product-template-gallery";

    gallery.setAttribute(
        "aria-hidden",
        "true"
    );

    gallery.innerHTML = `
        <header class="cvm-product-template-header">

            <div>

                <div class="eyebrow">
                    CVM TEMPLATE LAB
                </div>

                <h2 id="cvmProductTemplateTitle"></h2>

                <p id="cvmProductTemplateSubtitle"></p>

            </div>


            <button
                id="cvmProductTemplateClose"
                class="cvm-product-template-close"
                type="button"
            ></button>

        </header>


        <div class="cvm-product-template-body">

            <aside
                id="cvmProductTemplateList"
                class="cvm-product-template-list"
            ></aside>


            <section
                class="cvm-product-template-preview-column"
            >

                <div
                    id="cvmProductTemplatePreview"
                    class="cvm-product-template-preview-stage"
                ></div>

            </section>


            <aside
                id="cvmProductTemplateInfo"
                class="cvm-product-template-info"
            ></aside>

        </div>
    `;

    shell.appendChild(
        gallery
    );

    gallery
        .querySelector(
            "#cvmProductTemplateClose"
        )
        ?.addEventListener(
            "click",
            cvmProductCloseGallery
        );

    cvmProductRefreshGalleryLabels();

    return gallery;
}

function cvmProductRefreshGalleryLabels() {
    const title =
        document.querySelector(
            "#cvmProductTemplateTitle"
        );

    const subtitle =
        document.querySelector(
            "#cvmProductTemplateSubtitle"
        );

    const close =
        document.querySelector(
            "#cvmProductTemplateClose"
        );

    if (title) {
        title.textContent =
            cvmProductText(
                "Choose a LaTeX template",
                "Choisissez un modèle LaTeX"
            );
    }

    if (subtitle) {
        subtitle.textContent =
            cvmProductText(
                "Preview the design, then load its real LaTeX source into the editor.",
                "Prévisualisez le design, puis chargez son vrai code LaTeX dans l’éditeur."
            );
    }

    if (close) {
        close.innerHTML = `
            <span>
                ${
                    cvmProductText(
                        "Close",
                        "Fermer"
                    )
                }
            </span>

            <span aria-hidden="true">
                ×
            </span>
        `;

        close.setAttribute(
            "aria-label",
            cvmProductText(
                "Close template gallery",
                "Fermer la galerie de modèles"
            )
        );
    }
}

function cvmProductPreviewSection(
    title,
    count = 3
) {
    return `
        <div class="cvm-product-preview-section">

            <div class="cvm-product-preview-section-title">
                ${
                    cvmProductEscape(
                        title
                    )
                }
            </div>

            ${
                Array.from(
                    {
                        length:
                            count,
                    },
                    (
                        _,
                        index
                    ) => `
                        <div
                            class="cvm-product-preview-line ${
                                index === 0
                                    ? "strong"
                                    : index === count - 1
                                        ? "short"
                                        : ""
                            }"
                        ></div>
                    `
                )
                    .join("")
            }

        </div>
    `;
}

function cvmProductTemplatePreviewMarkup(
    template
) {
    const accent =
        /^#[0-9a-f]{6}$/i
            .test(
                template?.accent
                || ""
            )
            ? template.accent
            : "#BC965D";

    const layout =
        String(
            template?.layout
            || "single"
        );

    const classes = [
        "cvm-product-preview-paper",
    ];

    if (
        template?.id
        === "navy_executive"
    ) {
        classes.push(
            "navy-header"
        );
    }

    if (
        layout
        === "two-column"
    ) {
        classes.push(
            "two-column"
        );
    }

    const visual =
        layout === "photo"
            ? `
                <div class="cvm-product-preview-photo">
                    PHOTO
                </div>
            `
            : layout === "qr"
                ? `
                    <div class="cvm-product-preview-qr">
                        ▦
                    </div>
                `
                : "";

    const body =
        layout
        === "two-column"
            ? `
                <div class="cvm-product-preview-columns">

                    <div>

                        ${
                            cvmProductPreviewSection(
                                "Experience",
                                4
                            )
                        }

                        ${
                            cvmProductPreviewSection(
                                "Projects",
                                3
                            )
                        }

                        ${
                            cvmProductPreviewSection(
                                "Education",
                                2
                            )
                        }

                    </div>


                    <div class="cvm-product-preview-sidebar">

                        ${
                            cvmProductPreviewSection(
                                "Profile",
                                2
                            )
                        }

                        ${
                            cvmProductPreviewSection(
                                "Skills",
                                3
                            )
                        }

                    </div>

                </div>
            `
            : `
                ${
                    cvmProductPreviewSection(
                        "Profile",
                        2
                    )
                }

                ${
                    cvmProductPreviewSection(
                        "Experience",
                        4
                    )
                }

                ${
                    cvmProductPreviewSection(
                        "Education",
                        2
                    )
                }

                ${
                    cvmProductPreviewSection(
                        "Skills",
                        2
                    )
                }
            `;

    return `
        <article
            class="${classes.join(" ")}"
            style="--tpl-accent:${accent}"
        >

            <header
                class="cvm-product-preview-head ${
                    layout === "photo"
                    || layout === "qr"
                        ? "with-visual"
                        : ""
                }"
            >

                <div>

                    <div class="cvm-product-preview-name">
                        YOUR NAME
                    </div>

                    <div class="cvm-product-preview-role">
                        TARGET ROLE
                    </div>

                    <div class="cvm-product-preview-contact">
                        City · Email · LinkedIn · Portfolio
                    </div>

                </div>

                ${visual}

            </header>


            <div class="cvm-product-preview-rule"></div>

            ${body}

        </article>
    `;
}

function cvmProductRenderTemplateList() {
    const host =
        document.querySelector(
            "#cvmProductTemplateList"
        );

    if (!host) {
        return;
    }

    host.innerHTML =
        cvmProduct.templates
            .map(
                (
                    template
                ) => `
                    <button
                        type="button"
                        class="cvm-product-template-row ${
                            template.id
                            === cvmProduct.selectedTemplateId
                                ? "active"
                                : ""
                        }"
                        data-cvm-product-template="${
                            cvmProductEscape(
                                template.id
                            )
                        }"
                    >

                        <span
                            class="cvm-product-template-marker"
                        ></span>

                        <span
                            class="cvm-product-template-row-copy"
                        >

                            <span
                                class="cvm-product-template-row-top"
                            >

                                <strong>
                                    ${
                                        cvmProductEscape(
                                            template.title
                                        )
                                    }
                                </strong>

                                <span>
                                    ${
                                        cvmProductEscape(
                                            template.category
                                        )
                                    }
                                </span>

                            </span>

                            <small>
                                ${
                                    cvmProductEscape(
                                        template.description
                                    )
                                }
                            </small>

                        </span>

                    </button>
                `
            )
            .join("");

    host
        .querySelectorAll(
            "[data-cvm-product-template]"
        )
        .forEach(
            (
                button
            ) => {
                button.addEventListener(
                    "click",
                    () => {
                        cvmProduct
                            .selectedTemplateId =
                            button
                                .dataset
                                .cvmProductTemplate;

                        cvmProductRenderTemplateList();

                        cvmProductRenderTemplateDetail();
                    }
                );
            }
        );
}

function cvmProductRenderTemplateDetail() {
    const previewHost =
        document.querySelector(
            "#cvmProductTemplatePreview"
        );

    const infoHost =
        document.querySelector(
            "#cvmProductTemplateInfo"
        );

    if (
        !previewHost
        || !infoHost
    ) {
        return;
    }

    const template =
        cvmProduct.templates
            .find(
                (
                    item
                ) =>
                    item.id
                    === cvmProduct.selectedTemplateId
            );

    if (!template) {
        previewHost.innerHTML =
            "";

        infoHost.innerHTML =
            "";

        return;
    }

    previewHost.innerHTML =
        cvmProductTemplatePreviewMarkup(
            template
        );

    const tags = [
        template.category,

        template.has_photo
            ? cvmProductText(
                "Photo",
                "Photo"
            )
            : cvmProductText(
                "No photo",
                "Sans photo"
            ),

        template.has_qr
            ? "QR code"
            : cvmProductText(
                "Standard contact",
                "Contact standard"
            ),
    ];

    infoHost.innerHTML = `
        <div class="eyebrow">
            HTML PREVIEW
        </div>

        <h3>
            ${
                cvmProductEscape(
                    template.title
                )
            }
        </h3>

        <p>
            ${
                cvmProductEscape(
                    template.description
                )
            }
        </p>


        <div class="cvm-product-template-tags">

            ${
                tags
                    .map(
                        (
                            tag
                        ) => `
                            <span>
                                ${
                                    cvmProductEscape(
                                        tag
                                    )
                                }
                            </span>
                        `
                    )
                    .join("")
            }

        </div>


        <div class="cvm-product-template-note">
            ${
                cvmProductEscape(
                    template.ats_note
                    || ""
                )
            }
        </div>


        <button
            id="cvmProductUseTemplate"
            class="cvm-product-use-template"
            type="button"
        >
            ${
                cvmProductText(
                    "Use this template",
                    "Utiliser ce modèle"
                )
            }
        </button>


        <small class="cvm-product-template-footnote">
            ${
                cvmProductText(
                    "The real LaTeX source will replace the code in the editor. Compilation remains manual.",
                    "Le vrai code LaTeX remplacera le code de l’éditeur. La compilation reste manuelle."
                )
            }
        </small>
    `;

    infoHost
        .querySelector(
            "#cvmProductUseTemplate"
        )
        ?.addEventListener(
            "click",
            cvmProductUseSelectedTemplate
        );
}

async function cvmProductLoadTemplateCatalog() {
    cvmProduct.templates = [
        ...CVM_PRODUCT_FALLBACK_TEMPLATES,
    ];

    if (
        !cvmProduct.selectedTemplateId
        || !cvmProduct.templates
            .some(
                (
                    item
                ) =>
                    item.id
                    === cvmProduct.selectedTemplateId
            )
    ) {
        cvmProduct.selectedTemplateId =
            cvmProduct.templates[0]?.id
            || null;
    }

    cvmProductRenderTemplateList();

    cvmProductRenderTemplateDetail();

    const api =
        cvmProductApi();

    if (
        !api?.get_latex_templates
    ) {
        return;
    }

    try {
        const response =
            await api
                .get_latex_templates();

        if (
            response?.ok
            && Array.isArray(
                response.templates
            )
            && response.templates.length
        ) {
            cvmProduct.templates =
                response.templates;

            if (
                !cvmProduct.templates
                    .some(
                        (
                            item
                        ) =>
                            item.id
                            === cvmProduct.selectedTemplateId
                    )
            ) {
                cvmProduct.selectedTemplateId =
                    cvmProduct.templates[0]?.id
                    || null;
            }

            cvmProductRenderTemplateList();

            cvmProductRenderTemplateDetail();
        }
    }
    catch (
        error
    ) {
        console.error(
            error
        );
    }
}

async function cvmProductOpenGallery() {
    const gallery =
        cvmProductBuildGallery();

    if (!gallery) {
        cvmProductToast(
            cvmProductText(
                "LaTeX Studio is not ready yet.",
                "LaTeX Studio n’est pas encore prêt."
            ),
            "error"
        );

        return;
    }

    cvmProductRefreshGalleryLabels();

    gallery.classList.add(
        "open"
    );

    gallery.setAttribute(
        "aria-hidden",
        "false"
    );

    await cvmProductLoadTemplateCatalog();
}

function cvmProductCloseGallery() {
    const gallery =
        document.querySelector(
            "#cvmProductTemplateGallery"
        );

    gallery
        ?.classList
        .remove(
            "open"
        );

    gallery
        ?.setAttribute(
            "aria-hidden",
            "true"
        );
}


// ===========================================================
// CUSTOM TEMPLATE CONFIRMATION
// ===========================================================

function cvmProductConfirmTemplateReplace(
    templateTitle
) {
    return new Promise(
        (
            resolve
        ) => {
            document
                .querySelector(
                    "#cvmProductConfirmBackdrop"
                )
                ?.remove();

            const backdrop =
                document.createElement(
                    "div"
                );

            backdrop.id =
                "cvmProductConfirmBackdrop";

            backdrop.className =
                "cvm-product-confirm-backdrop";

            backdrop.innerHTML = `
                <section
                    class="cvm-product-confirm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cvmProductConfirmTitle"
                >

                    <div class="eyebrow">
                        ${
                            cvmProductText(
                                "TEMPLATE CHANGE",
                                "CHANGEMENT DE MODÈLE"
                            )
                        }
                    </div>

                    <h3 id="cvmProductConfirmTitle">
                        ${
                            cvmProductText(
                                "Replace current LaTeX code?",
                                "Remplacer le code LaTeX actuel ?"
                            )
                        }
                    </h3>

                    <p>
                        ${
                            cvmProductText(
                                `This will replace the code currently in the editor with “${cvmProductEscape(templateTitle)}”. You can edit it immediately afterwards.`,
                                `Cela remplacera le code actuellement présent dans l’éditeur par « ${cvmProductEscape(templateTitle)} ». Vous pourrez le modifier immédiatement ensuite.`
                            )
                        }
                    </p>


                    <div class="cvm-product-confirm-actions">

                        <button
                            type="button"
                            data-cvm-product-confirm="cancel"
                            class="secondary-button"
                        >
                            ${
                                cvmProductText(
                                    "Cancel",
                                    "Annuler"
                                )
                            }
                        </button>


                        <button
                            type="button"
                            data-cvm-product-confirm="apply"
                            class="primary-button"
                        >
                            ${
                                cvmProductText(
                                    "Replace template",
                                    "Remplacer le modèle"
                                )
                            }
                        </button>

                    </div>

                </section>
            `;

            let finished =
                false;

            const finish =
                (
                    value
                ) => {
                    if (finished) {
                        return;
                    }

                    finished =
                        true;

                    document.removeEventListener(
                        "keydown",
                        keyHandler,
                        true
                    );

                    backdrop.remove();

                    resolve(
                        value
                    );
                };

            const keyHandler =
                (
                    event
                ) => {
                    if (
                        event.key
                        === "Escape"
                    ) {
                        event.preventDefault();

                        finish(
                            false
                        );
                    }
                };

            backdrop.addEventListener(
                "click",
                (
                    event
                ) => {
                    if (
                        event.target
                        === backdrop
                    ) {
                        finish(
                            false
                        );

                        return;
                    }

                    const button =
                        event.target
                            .closest?.(
                                "[data-cvm-product-confirm]"
                            );

                    if (button) {
                        finish(
                            button
                                .dataset
                                .cvmProductConfirm
                            === "apply"
                        );
                    }
                }
            );

            document.addEventListener(
                "keydown",
                keyHandler,
                true
            );

            document.body.appendChild(
                backdrop
            );

            backdrop
                .querySelector(
                    '[data-cvm-product-confirm="apply"]'
                )
                ?.focus();
        }
    );
}

async function cvmProductUseSelectedTemplate() {
    const template =
        cvmProduct.templates
            .find(
                (
                    item
                ) =>
                    item.id
                    === cvmProduct.selectedTemplateId
            );

    const editor =
        document.querySelector(
            "#cvmLatexEditor"
        );

    const api =
        cvmProductApi();

    if (
        !template
        || !editor
        || !api?.get_latex_template
    ) {
        cvmProductToast(
            cvmProductText(
                "The template service is unavailable.",
                "Le service de modèles est indisponible."
            ),
            "error"
        );

        return;
    }

    if (
        editor.value.trim()
    ) {
        const approved =
            await cvmProductConfirmTemplateReplace(
                template.title
            );

        if (!approved) {
            return;
        }
    }

    try {
        const response =
            await api
                .get_latex_template(
                    template.id
                );

        if (!response?.ok) {
            throw new Error(
                response?.message
                || "Unable to load this template."
            );
        }

        editor.value =
            response.source
            || "";

        if (
            typeof cvmV07UpdateLatexLineNumbers
            === "function"
        ) {
            cvmV07UpdateLatexLineNumbers();
        }

        if (
            typeof cvmV07MarkLatexStale
            === "function"
        ) {
            cvmV07MarkLatexStale();
        }

        if (
            typeof cvmV07ScheduleLatexDraftSave
            === "function"
        ) {
            cvmV07ScheduleLatexDraftSave();
        }

        cvmProductCloseGallery();

        cvmProductToast(
            cvmProductText(
                `${template.title} loaded.`,
                `${template.title} chargé.`
            ),
            "success"
        );

        setTimeout(
            () =>
                editor.focus(),
            0
        );
    }
    catch (
        error
    ) {
        console.error(
            error
        );

        cvmProductToast(
            String(
                error?.message
                || cvmProductText(
                    "Unable to load this template.",
                    "Impossible de charger ce modèle."
                )
            ),
            "error"
        );
    }
}


// ===========================================================
// ATS CHECK REDESIGN + RESET
// ===========================================================

function cvmProductAtsList(
    items,
    emptyText
) {
    if (
        !items?.length
    ) {
        return `
            <p class="cvm-product-ats-empty-copy">
                ${
                    cvmProductEscape(
                        emptyText
                    )
                }
            </p>
        `;
    }

    return `
        <ul class="cvm-product-ats-list">

            ${
                items
                    .map(
                        (
                            item
                        ) => `
                            <li>
                                ${
                                    cvmProductEscape(
                                        item
                                    )
                                }
                            </li>
                        `
                    )
                    .join("")
            }

        </ul>
    `;
}

function cvmProductRenderAtsResult(
    result
) {
    const container =
        document.querySelector(
            "#atsResults"
        );

    if (!container) {
        return;
    }

    const recommendations = [
        ...(
            result.issues
            || []
        ),
        ...(
            result.warnings
            || []
        ),
    ];

    const methods = [
        [
            "01",
            cvmProductText(
                "Identity & contact",
                "Identité & contact"
            ),
            cvmProductText(
                "Checks name, email, phone and target role.",
                "Vérifie le nom, l’e-mail, le téléphone et le poste ciblé."
            ),
        ],
        [
            "02",
            cvmProductText(
                "CV structure",
                "Structure du CV"
            ),
            cvmProductText(
                "Checks visible sections, conventional headings and readable structure.",
                "Vérifie les sections visibles, les titres conventionnels et la structure."
            ),
        ],
        [
            "03",
            cvmProductText(
                "Experience bullets",
                "Puces d’expérience"
            ),
            cvmProductText(
                "Looks for length, repetition, action verbs and measurable evidence.",
                "Analyse la longueur, les répétitions, les verbes d’action et les résultats mesurables."
            ),
        ],
        [
            "04",
            cvmProductText(
                "ATS-safe formatting",
                "Format compatible ATS"
            ),
            cvmProductText(
                "Flags risky glyphs and formatting choices that may reduce readability.",
                "Signale les symboles et choix de mise en page susceptibles de réduire la lisibilité."
            ),
        ],
        [
            "05",
            cvmProductText(
                "PDF text audit",
                "Audit texte PDF"
            ),
            cvmProductText(
                "When a LaTeX engine is available, CVM also checks the generated PDF text layer locally.",
                "Lorsqu’un moteur LaTeX est disponible, CVM vérifie aussi localement la couche texte du PDF généré."
            ),
        ],
    ];

    const technical =
        Array.isArray(
            result.technical
        )
            ? result.technical
            : [];

    container.className =
        "cvm-product-ats-shell";

    container.innerHTML = `
        <section class="cvm-product-ats-summary">

            <div class="cvm-product-score-ring">
                ${
                    cvmProductEscape(
                        result.score
                    )
                }
            </div>


            <div>

                <div class="eyebrow">
                    CVM ATS READINESS
                </div>

                <h2>
                    ${
                        cvmProductEscape(
                            result.label
                        )
                    }
                </h2>

                <p>
                    ${
                        cvmProductEscape(
                            result.note
                        )
                    }
                </p>

                <span class="cvm-product-check-count">

                    ${
                        cvmProductEscape(
                            result.checks_run
                            || 0
                        )
                    }

                    ${
                        cvmProductText(
                            "checks reported",
                            "contrôles analysés"
                        )
                    }

                </span>

            </div>

        </section>


        <div class="cvm-product-ats-grid">

            <section class="cvm-product-ats-card">

                <h3>
                    ${
                        cvmProductText(
                            "Recommendations",
                            "Recommandations"
                        )
                    }
                </h3>

                <p>
                    ${
                        cvmProductText(
                            "Review these points before export. Add numbers or claims only when they are true.",
                            "Vérifiez ces points avant l’export. N’ajoutez des chiffres ou affirmations que s’ils sont réels."
                        )
                    }
                </p>

                ${
                    cvmProductAtsList(
                        recommendations,
                        cvmProductText(
                            "No major recommendation was generated for this CV.",
                            "Aucune recommandation majeure n’a été générée pour ce CV."
                        )
                    )
                }

            </section>


            <section class="cvm-product-ats-card good">

                <h3>
                    ${
                        cvmProductText(
                            "What already looks good",
                            "Ce qui est déjà bon"
                        )
                    }
                </h3>

                <p>
                    ${
                        cvmProductText(
                            "Checks that passed in the current CV structure and content.",
                            "Contrôles validés dans la structure et le contenu actuels."
                        )
                    }
                </p>

                ${
                    cvmProductAtsList(
                        result.passed
                        || [],
                        cvmProductText(
                            "No passed checks were reported yet.",
                            "Aucun contrôle validé n’a encore été signalé."
                        )
                    )
                }

            </section>


            <section class="cvm-product-ats-card wide">

                <h3>
                    ${
                        cvmProductText(
                            "How CVM checked your CV",
                            "Comment CVM a vérifié votre CV"
                        )
                    }
                </h3>

                <p>
                    ${
                        cvmProductText(
                            "The analysis runs locally and combines content, structure and generated-PDF checks.",
                            "L’analyse s’exécute localement et combine des contrôles du contenu, de la structure et du PDF généré."
                        )
                    }
                </p>


                <div class="cvm-product-method-grid">

                    ${
                        methods
                            .map(
                                (
                                    [
                                        number,
                                        title,
                                        detail,
                                    ]
                                ) => `
                                    <article class="cvm-product-method">

                                        <span>
                                            ${number}
                                        </span>

                                        <strong>
                                            ${
                                                cvmProductEscape(
                                                    title
                                                )
                                            }
                                        </strong>

                                        <small>
                                            ${
                                                cvmProductEscape(
                                                    detail
                                                )
                                            }
                                        </small>

                                    </article>
                                `
                            )
                            .join("")
                    }

                </div>

            </section>


            ${
                technical.length
                    ? `
                        <section class="cvm-product-ats-card wide">

                            <h3>
                                ${
                                    cvmProductText(
                                        "Technical validation",
                                        "Validation technique"
                                    )
                                }
                            </h3>

                            <p>
                                ${
                                    cvmProductText(
                                        "Details from the local generated-PDF parsing audit.",
                                        "Détails issus de l’audit local du PDF généré."
                                    )
                                }
                            </p>

                            ${
                                cvmProductAtsList(
                                    technical,
                                    ""
                                )
                            }

                        </section>
                    `
                    : ""
            }

        </div>
    `;
}

function cvmProductResetAts() {
    const container =
        document.querySelector(
            "#atsResults"
        );

    if (!container) {
        return;
    }

    container.className =
        "cvm-product-ats-reset";

    container.textContent =
        cvmProductText(
            "Run the ATS Check to analyse the current version of your CV.",
            "Lancez l’analyse ATS pour analyser la version actuelle de votre CV."
        );

    cvmProduct.atsRunning =
        false;

    const button =
        document.querySelector(
            "#runAtsBtn"
        );

    if (button) {
        button.disabled =
            false;

        button.textContent =
            cvmProductText(
                "Run ATS Check",
                "Lancer l’analyse ATS"
            );
    }
}

async function cvmProductRunAts() {
    if (
        cvmProduct.atsRunning
    ) {
        return;
    }

    const api =
        cvmProductApi();

    const container =
        document.querySelector(
            "#atsResults"
        );

    if (
        !api?.analyze_ats
        || !state?.project
        || !container
    ) {
        cvmProductToast(
            cvmProductText(
                "ATS analysis is not available yet.",
                "L’analyse ATS n’est pas encore disponible."
            ),
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

    cvmProduct.atsRunning =
        true;

    container.className =
        "cvm-product-ats-reset";

    container.textContent =
        cvmProductText(
            "Analysing your CV locally...",
            "Analyse locale de votre CV..."
        );

    const button =
        document.querySelector(
            "#runAtsBtn"
        );

    if (button) {
        button.disabled =
            true;

        button.textContent =
            cvmProductText(
                "Analysing...",
                "Analyse..."
            );
    }

    try {
        const response =
            await api
                .analyze_ats(
                    state.project
                );

        if (!response?.ok) {
            throw new Error(
                response?.message
                || "ATS analysis failed."
            );
        }

        cvmProductRenderAtsResult(
            response.result
        );
    }
    catch (
        error
    ) {
        console.error(
            error
        );

        container.className =
            "cvm-product-ats-reset";

        container.textContent =
            String(
                error?.message
                || cvmProductText(
                    "ATS analysis failed.",
                    "L’analyse ATS a échoué."
                )
            );
    }
    finally {
        cvmProduct.atsRunning =
            false;

        if (button) {
            button.disabled =
                false;

            button.textContent =
                cvmProductText(
                    "Run ATS Check",
                    "Lancer l’analyse ATS"
                );
        }
    }
}

function cvmProductInstallNavigationHook() {
    if (
        typeof showPage
            !== "function"
        || cvmProduct
            .baseShowPage
    ) {
        return;
    }

    cvmProduct.baseShowPage =
        showPage;

    showPage =
        function (
            pageName
        ) {
            if (
                pageName === "ats"
                || state?.currentPage === "ats"
            ) {
                cvmProductResetAts();
            }

            return cvmProduct
                .baseShowPage(
                    pageName
                );
        };

    window.showPage =
        showPage;
}


// ===========================================================
// EVENT ROUTING
// ===========================================================

function cvmProductCaptureClick(
    event
) {
    const target =
        event.target;

    const templatesButton =
        target?.closest?.(
            "#cvmLatexStarterBtn"
        );

    if (templatesButton) {
        event.preventDefault();

        event.stopImmediatePropagation();

        event.stopPropagation();

        cvmProductOpenGallery();

        return;
    }

    const atsButton =
        target?.closest?.(
            "#runAtsBtn"
        );

    if (atsButton) {
        event.preventDefault();

        event.stopImmediatePropagation();

        event.stopPropagation();

        cvmProductRunAts();

        return;
    }

    if (
        target?.closest?.(
            "[data-v06-editor-tab]"
        )
    ) {
        setTimeout(
            cvmProductResetEditorScroll,
            0
        );
    }
}

function cvmProductHandleKeydown(
    event
) {
    if (
        event.key !== "Escape"
    ) {
        return;
    }

    if (
        document.querySelector(
            "#cvmProductConfirmBackdrop"
        )
    ) {
        return;
    }

    const gallery =
        document.querySelector(
            "#cvmProductTemplateGallery"
        );

    if (
        gallery?.classList
            .contains(
                "open"
            )
    ) {
        event.preventDefault();

        event.stopPropagation();

        cvmProductCloseGallery();
    }
}

function cvmProductInit() {
    if (
        cvmProduct.initialized
    ) {
        return;
    }

    cvmProduct.initialized =
        true;

    // IMPORTANT:
    // Native addCollectionItem() already uses push().
    // We intentionally do NOT override it.
    // New Experience / Education items therefore appear
    // BELOW the existing entries in normal creation order.

    cvmProductInstallPreviewHook();

    cvmProductInstallLatexLabelHook();

    cvmProductInstallNavigationHook();

    cvmProductResetAts();

    document.addEventListener(
        "click",
        cvmProductCaptureClick,
        true
    );

    document.addEventListener(
        "keydown",
        cvmProductHandleKeydown,
        true
    );

    document.addEventListener(
        "input",
        (
            event
        ) => {
            if (
                event.target
                    ?.matches?.(
                        "[data-v06-spacing-key]"
                    )
            ) {
                requestAnimationFrame(
                    cvmProductApplyPreviewSpacing
                );
            }
        },
        true
    );
}

document.addEventListener(
    "DOMContentLoaded",
    cvmProductInit
);

window.addEventListener(
    "pywebviewready",
    cvmProductInit
);
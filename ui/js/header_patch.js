"use strict";

// ===========================================================
// CVM HEADER PATCH
//
// Only does two things:
// 1. Photo becomes a real LEFT-side header column.
// 2. Adds the damergi.com button to the app top bar.
// ===========================================================


// ===========================================================
// PATCH CSS
// ===========================================================

function cvmInstallHeaderPatchStyles() {
    if (
        document.querySelector(
            "#cvmHeaderPatchStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "cvmHeaderPatchStyles";

    style.textContent = `
        /* =====================================================
           CV HEADER
        ===================================================== */

        .cvm-preview-header {
            display: grid;
            width: 100%;
            align-items: center;
        }

        .cvm-preview-header.no-photo {
            grid-template-columns: minmax(0, 1fr);
        }

        .cvm-preview-header.with-photo {
            grid-template-columns: 78px minmax(0, 1fr);
            column-gap: 16px;
            min-height: 88px;
        }

        .cvm-preview-header-copy {
            min-width: 0;
            width: 100%;
            text-align: center;
        }


        /*
         * IMPORTANT:
         * v03.css previously positions the photo absolutely
         * at the top-right.
         *
         * These rules deliberately override that old behaviour.
         */

        .cvm-preview-header .cvm-preview-photo {
            position: static !important;

            top: auto !important;
            right: auto !important;
            bottom: auto !important;
            left: auto !important;
            inset: auto !important;

            display: block;

            width: 70px !important;
            height: 84px !important;

            max-width: 70px !important;

            margin: 0 !important;

            object-fit: cover;

            border-radius: 6px;

            justify-self: start;
            align-self: center;
        }


        .cvm-preview-header.with-photo .preview-name,
        .cvm-preview-header.with-photo .preview-role,
        .cvm-preview-header.with-photo .preview-contact {
            width: 100%;
            max-width: 100%;
        }


        .cvm-preview-header.with-photo .preview-contact {
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: normal;
        }


        /* =====================================================
           WEBSITE BUTTON
        ===================================================== */

        .cvm-website-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            min-height: 34px;

            padding: 0 12px;

            border: 1px solid var(--indigo-border);
            border-radius: 10px;

            color: var(--indigo);

            background: var(--indigo-soft);

            font-size: 10px;
            font-weight: 800;

            text-decoration: none;

            white-space: nowrap;

            transition:
                transform 120ms ease,
                border-color 120ms ease,
                background 120ms ease;
        }


        .cvm-website-button:hover {
            transform: translateY(-1px);
            border-color: var(--indigo);
        }


        @media (max-width: 1180px) {
            .cvm-website-button {
                padding: 0 9px;
            }
        }


        @media (max-width: 1050px) {
            .cvm-website-button {
                display: none;
            }
        }
    `;

    document.head.appendChild(
        style
    );
}


// ===========================================================
// WEBSITE BUTTON
// ===========================================================

function cvmInstallWebsiteButton() {
    if (
        document.querySelector(
            "#websiteBtn"
        )
    ) {
        return;
    }

    const actions =
        document.querySelector(
            ".topbar-actions"
        );

    if (!actions) {
        return;
    }

    const button =
        document.createElement(
            "a"
        );

    button.id =
        "websiteBtn";

    button.className =
        "cvm-website-button";

    button.href =
        "https://www.damergi.com";

    button.target =
        "_blank";

    button.rel =
        "noopener noreferrer";

    button.title =
        "Visit damergi.com";

    button.innerHTML =
        "damergi.com&nbsp;&nbsp;↗";

    const saveButton =
        document.querySelector(
            "#saveProjectBtn"
        );

    if (saveButton) {
        actions.insertBefore(
            button,
            saveButton
        );
    }
    else {
        actions.prepend(
            button
        );
    }
}


// ===========================================================
// LEFT-PHOTO LIVE PREVIEW
// ===========================================================

function cvmRenderPreviewWithLeftPhoto() {
    if (!state.project) {
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


    const contacts = [
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


    const hasPhoto =
        Boolean(
            project.design.photo_enabled
            && cvmPhotoDataUri
        );


    let html = `
        <div
            class="
                cvm-preview-header
                ${
                    hasPhoto
                        ? "with-photo"
                        : "no-photo"
                }
            "
        >

            ${
                hasPhoto
                    ? `
                        <img
                            class="cvm-preview-photo"
                            src="${cvmPhotoDataUri}"
                            alt="CV photo"
                        >
                    `
                    : ""
            }


            <div class="cvm-preview-header-copy">

                <div
                    class="preview-name"
                    style="
                        color:${cvmDesignColor(
                            "name"
                        )};
                    "
                >
                    ${escapeHtml(
                        personal.full_name
                        || "YOUR NAME"
                    )}
                </div>


                <div
                    class="preview-role"
                    style="
                        color:${cvmDesignColor(
                            "role_titles"
                        )};
                    "
                >
                    ${escapeHtml(
                        [
                            personal.target_role,
                            personal.secondary_target_role,
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
                    style="
                        color:${cvmDesignColor(
                            "links"
                        )};
                    "
                >
                    ${escapeHtml(
                        contacts
                    )}
                </div>

            </div>

        </div>


        <div
            class="preview-top-line"
            style="
                background:${cvmDesignColor(
                    "lines"
                )};
            "
        ></div>
    `;


    for (
        const sectionKey
        of project.design.section_order
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


// ===========================================================
// INSTALL PATCH
// ===========================================================

function cvmInstallHeaderPatch() {
    cvmInstallHeaderPatchStyles();

    cvmInstallWebsiteButton();

    /*
     * Replace CVM's old preview renderer.
     *
     * Anything elsewhere in the app calling renderPreview()
     * automatically uses this fixed version.
     */

    renderPreview =
        cvmRenderPreviewWithLeftPhoto;

    window.renderPreview =
        cvmRenderPreviewWithLeftPhoto;


    /*
     * Re-render immediately if a project is already open.
     */

    if (
        typeof state !== "undefined"
        && state.project
    ) {
        try {
            renderPreview();
        }
        catch (error) {
            console.debug(
                "CVM header patch waiting for project initialization.",
                error
            );
        }
    }
}


// The file is loaded at the bottom of index.html,
// so the top bar already exists.
cvmInstallHeaderPatch();


// Also run once after the document is fully ready,
// just in case pywebview initializes asynchronously.
document.addEventListener(
    "DOMContentLoaded",
    () => {
        cvmInstallHeaderPatchStyles();
        cvmInstallWebsiteButton();

        renderPreview =
            cvmRenderPreviewWithLeftPhoto;

        window.renderPreview =
            cvmRenderPreviewWithLeftPhoto;
    }
);
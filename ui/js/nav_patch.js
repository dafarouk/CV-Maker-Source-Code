"use strict";

// ===========================================================
// CVM NAVBAR / JOURNAL / SUPPORT PATCH
// ===========================================================

const CVM_SITE_URL = "https://www.damergi.com";

// Put your PayPal / Ko-fi / Buy Me a Coffee URL here later.
const CVM_DONATION_URL = "";

let cvmJournalUnread = 0;
let cvmChangeTimer = null;
let cvmLastChangeLabel = "CV updated";


// ===========================================================
// LANGUAGE-AWARE PATCH COPY
// ===========================================================

function cvmPatchLanguage() {
    return (
        typeof cvmCurrentLanguage !== "undefined"
        && cvmCurrentLanguage === "fr"
    ) ? "fr" : "en";
}

function cvmPatchCopy(key) {
    const copy = {
        en: {
            support: "Support",
            supportTitle: "Support CV Maker",
            supportText: "CV Maker is completely free. If the app helps you, any little support would be genuinely appreciated :)",
            supportFree: "Always free to use",
            supportSoon: "Donation link coming soon",
            close: "Close",
            websiteTitle: "Farouk's website",
            websiteText: "Portfolio, projects and more about the creator of CV Maker.",
            visitWebsite: "Visit website",
            languageEnglish: "English",
            languageFrench: "French",
            journalChange: "CV updated",
            designUpdated: "Design updated",
            contentUpdated: "CV content updated",
            languageUpdated: "Language changed",
            themeUpdated: "Theme changed",
            sectionAdded: "CV section added",
            sectionRemoved: "CV section removed",
        },

        fr: {
            support: "Soutenir",
            supportTitle: "Soutenir CV Maker",
            supportText: "CV Maker est entièrement gratuit. Si l'application vous aide, même un petit soutien serait sincèrement apprécié :)",
            supportFree: "Toujours gratuit",
            supportSoon: "Lien de don bientôt disponible",
            close: "Fermer",
            websiteTitle: "Site de Farouk",
            websiteText: "Portfolio, projets et informations sur le créateur de CV Maker.",
            visitWebsite: "Visiter le site",
            languageEnglish: "Anglais",
            languageFrench: "Français",
            journalChange: "CV modifié",
            designUpdated: "Design modifié",
            contentUpdated: "Contenu du CV modifié",
            languageUpdated: "Langue modifiée",
            themeUpdated: "Thème modifié",
            sectionAdded: "Section ajoutée au CV",
            sectionRemoved: "Section supprimée du CV",
        },
    };

    return copy[cvmPatchLanguage()][key] || key;
}


// ===========================================================
// REAL FLAG SVGs
// ===========================================================

function cvmUkFlagSvg() {
    return `
        <span class="cvm-real-flag" aria-hidden="true">
            <svg viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg">

                <rect
                    width="60"
                    height="36"
                    fill="#012169"
                />

                <path
                    d="M0 0L60 36M60 0L0 36"
                    stroke="#FFFFFF"
                    stroke-width="8"
                />

                <path
                    d="M0 0L60 36M60 0L0 36"
                    stroke="#C8102E"
                    stroke-width="4"
                />

                <path
                    d="M30 0V36M0 18H60"
                    stroke="#FFFFFF"
                    stroke-width="12"
                />

                <path
                    d="M30 0V36M0 18H60"
                    stroke="#C8102E"
                    stroke-width="7"
                />

            </svg>
        </span>
    `;
}

function cvmFrFlagSvg() {
    return `
        <span class="cvm-real-flag" aria-hidden="true">
            <svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">

                <rect
                    width="1"
                    height="2"
                    x="0"
                    fill="#0055A4"
                />

                <rect
                    width="1"
                    height="2"
                    x="1"
                    fill="#FFFFFF"
                />

                <rect
                    width="1"
                    height="2"
                    x="2"
                    fill="#EF4135"
                />

            </svg>
        </span>
    `;
}

function cvmPatchLanguageFlags() {
    const en =
        document.querySelector(
            '[data-cvm-language="en"]'
        );

    const fr =
        document.querySelector(
            '[data-cvm-language="fr"]'
        );

    if (en) {
        en.innerHTML =
            `${cvmUkFlagSvg()}<span>EN</span>`;

        en.title =
            cvmPatchCopy(
                "languageEnglish"
            );
    }

    if (fr) {
        fr.innerHTML =
            `${cvmFrFlagSvg()}<span>FR</span>`;

        fr.title =
            cvmPatchCopy(
                "languageFrench"
            );
    }
}


// ===========================================================
// WEBSITE / SUPPORT BUTTONS
// ===========================================================

function cvmEnsureWebsiteButton() {
    let website =
        document.querySelector(
            "#websiteBtn"
        );

    if (website) {
        website.href =
            CVM_SITE_URL;

        website.target =
            "_blank";

        website.rel =
            "noopener noreferrer";

        website.textContent =
            "damergi.com ↗";

        return website;
    }

    website =
        document.createElement(
            "a"
        );

    website.id =
        "websiteBtn";

    website.className =
        "cvm-website-button";

    website.href =
        CVM_SITE_URL;

    website.target =
        "_blank";

    website.rel =
        "noopener noreferrer";

    website.title =
        "damergi.com";

    website.textContent =
        "damergi.com ↗";

    return website;
}

function cvmEnsureDonationButton() {
    let button =
        document.querySelector(
            "#cvmDonationBtn"
        );

    if (button) {
        return button;
    }

    button =
        document.createElement(
            "button"
        );

    button.id =
        "cvmDonationBtn";

    button.type =
        "button";

    button.className =
        "cvm-donation-button";

    button.innerHTML = `
        <span aria-hidden="true">
            ♡
        </span>

        <span class="cvm-donation-label">
            ${cvmPatchCopy("support")}
        </span>
    `;

    return button;
}


// ===========================================================
// CLEAN HORIZONTAL COMMAND BAR
// ===========================================================

function cvmToolbarGroup(
    className
) {
    const group =
        document.createElement(
            "div"
        );

    group.className =
        `cvm-toolbar-group ${className}`;

    return group;
}

function cvmOrganizeTopbar() {
    const actions =
        document.querySelector(
            ".topbar-actions"
        );

    if (
        !actions
        || actions.querySelector(
            ".cvm-command-bar"
        )
    ) {
        cvmPatchLanguageFlags();
        return;
    }

    const website =
        cvmEnsureWebsiteButton();

    const donation =
        cvmEnsureDonationButton();

    const save =
        document.querySelector(
            "#saveProjectBtn"
        );

    const pdf =
        document.querySelector(
            "#quickPdfBtn"
        );

    const docx =
        document.querySelector(
            "#quickDocxBtn"
        );

    const language =
        document.querySelector(
            "#cvmLanguageToggle"
        );

    const theme =
        document.querySelector(
            "#themeToggle"
        );

    const journal =
        document.querySelector(
            "#journalToggle"
        );

    const connection =
        document.querySelector(
            "#connectionBadge"
        );

    const version =
        document.querySelector(
            "#versionBadge"
        );


    const commandBar =
        document.createElement(
            "div"
        );

    commandBar.className =
        "cvm-command-bar";


    const creator =
        cvmToolbarGroup(
            "cvm-toolbar-group--creator"
        );

    creator.append(
        website,
        donation
    );


    const project =
        cvmToolbarGroup(
            "cvm-toolbar-group--project"
        );

    if (save) {
        project.appendChild(
            save
        );
    }


    if (
        pdf
        || docx
    ) {
        const exportSegment =
            document.createElement(
                "div"
            );

        exportSegment.className =
            "cvm-export-segment";

        if (pdf) {
            exportSegment.appendChild(
                pdf
            );
        }

        if (docx) {
            exportSegment.appendChild(
                docx
            );
        }

        project.appendChild(
            exportSegment
        );
    }


    const view =
        cvmToolbarGroup(
            "cvm-toolbar-group--view"
        );

    if (language) {
        view.appendChild(
            language
        );
    }

    if (theme) {
        view.appendChild(
            theme
        );
    }

    if (journal) {
        journal.querySelector(
            "#cvmJournalBadge"
        )?.remove();

        const badge =
            document.createElement(
                "span"
            );

        badge.id =
            "cvmJournalBadge";

        badge.className =
            "cvm-journal-badge";

        badge.textContent =
            "0";

        journal.appendChild(
            badge
        );

        view.appendChild(
            journal
        );
    }


    const status =
        cvmToolbarGroup(
            "cvm-toolbar-group--status"
        );

    if (connection) {
        status.appendChild(
            connection
        );
    }

    if (version) {
        status.appendChild(
            version
        );
    }


    commandBar.append(
        creator,
        project,
        view,
        status
    );


    actions.replaceChildren(
        commandBar
    );


    cvmPatchLanguageFlags();
}


// ===========================================================
// JOURNAL BADGE + CHANGE NOTIFICATIONS
// ===========================================================

function cvmUpdateJournalBadge() {
    const badge =
        document.querySelector(
            "#cvmJournalBadge"
        );

    if (!badge) {
        return;
    }

    badge.textContent =
        cvmJournalUnread > 99
            ? "99+"
            : String(
                cvmJournalUnread
            );

    badge.classList.toggle(
        "visible",
        cvmJournalUnread > 0
    );
}

function cvmClearJournalUnread() {
    cvmJournalUnread =
        0;

    cvmUpdateJournalBadge();
}

function cvmJournalTimestamp() {
    return new Date()
        .toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            }
        );
}

function cvmAddJournalNotification(
    message
) {
    if (
        typeof appendLog
        !== "function"
    ) {
        return;
    }

    appendLog({
        timestamp:
            cvmJournalTimestamp(),

        level:
            "INFO",

        message,
    });

    const lastRow =
        document.querySelector(
            "#logList"
        )?.lastElementChild;

    if (lastRow) {
        lastRow.classList.add(
            "cvm-change-log"
        );
    }

    if (
        !(
            typeof state
            !== "undefined"
            && state.journalVisible
        )
    ) {
        cvmJournalUnread +=
            1;

        cvmUpdateJournalBadge();
    }
}

function cvmFieldLabel(
    target
) {
    const field =
        target.closest?.(
            ".field"
        );

    if (field) {
        const value =
            field.querySelector(
                ":scope > span"
            )?.textContent
            ?.trim();

        if (value) {
            return value;
        }
    }

    const toggle =
        target.closest?.(
            ".toggle-row, .cvm-switch-row, .cvm-check-chip"
        );

    if (toggle) {
        const value =
            toggle.querySelector(
                "strong, span"
            )?.textContent
            ?.trim();

        if (value) {
            return value;
        }
    }

    return "";
}

function cvmDescribeChange(
    target
) {
    const label =
        cvmFieldLabel(
            target
        );

    const inDesign =
        Boolean(
            target.closest?.(
                "#page-design"
            )
        );

    const base =
        inDesign
            ? cvmPatchCopy(
                "designUpdated"
            )
            : cvmPatchCopy(
                "contentUpdated"
            );

    return label
        ? `${base} — ${label}`
        : base;
}

function cvmScheduleChangeNotification() {
    window.clearTimeout(
        cvmChangeTimer
    );

    cvmChangeTimer =
        window.setTimeout(
            () => {
                cvmAddJournalNotification(
                    cvmLastChangeLabel
                    || cvmPatchCopy(
                        "journalChange"
                    )
                );

                cvmLastChangeLabel =
                    cvmPatchCopy(
                        "journalChange"
                    );
            },
            700
        );
}

function cvmInstallJournalChangeTracking() {
    if (
        typeof projectChanged
        === "function"
        && !projectChanged.__cvmJournalWrapped
    ) {
        const baseProjectChanged =
            projectChanged;

        const wrapped =
            function (...args) {
                const result =
                    baseProjectChanged.apply(
                        this,
                        args
                    );

                cvmScheduleChangeNotification();

                return result;
            };

        wrapped.__cvmJournalWrapped =
            true;

        projectChanged =
            wrapped;
    }


    document.addEventListener(
        "input",
        (event) => {
            const target =
                event.target;

            if (
                target.closest?.(
                    "#editorRoot"
                )
                ||
                target.closest?.(
                    "#page-design"
                )
            ) {
                cvmLastChangeLabel =
                    cvmDescribeChange(
                        target
                    );
            }
        },
        true
    );


    document.addEventListener(
        "change",
        (event) => {
            const target =
                event.target;

            if (
                target.closest?.(
                    "#editorRoot"
                )
                ||
                target.closest?.(
                    "#page-design"
                )
            ) {
                cvmLastChangeLabel =
                    cvmDescribeChange(
                        target
                    );
            }
        },
        true
    );


    document.addEventListener(
        "click",
        (event) => {
            if (
                event.target.closest?.(
                    "[data-add]"
                )
            ) {
                cvmLastChangeLabel =
                    cvmPatchCopy(
                        "sectionAdded"
                    );
            }


            if (
                event.target.closest?.(
                    "[data-remove]"
                )
            ) {
                cvmLastChangeLabel =
                    cvmPatchCopy(
                        "sectionRemoved"
                    );
            }


            const languageButton =
                event.target.closest?.(
                    "[data-cvm-language]"
                );

            if (languageButton) {
                cvmLastChangeLabel =
                    cvmPatchCopy(
                        "languageUpdated"
                    );

                window.setTimeout(
                    () => {
                        cvmPatchLanguageFlags();
                        cvmRefreshPatchText();
                    },
                    20
                );
            }


            if (
                event.target.closest?.(
                    "#themeToggle, #settingsThemeBtn"
                )
            ) {
                cvmAddJournalNotification(
                    cvmPatchCopy(
                        "themeUpdated"
                    )
                );
            }
        },
        true
    );


    [
        "#journalToggle",
        "#settingsJournalBtn",
    ].forEach(
        (selector) => {
            document.querySelector(
                selector
            )?.addEventListener(
                "click",
                () => {
                    window.setTimeout(
                        () => {
                            if (
                                typeof state
                                !== "undefined"
                                && state.journalVisible
                            ) {
                                cvmClearJournalUnread();
                            }
                        },
                        0
                    );
                }
            );
        }
    );
}


// ===========================================================
// CONTACT WEBSITE BLOCK
// ===========================================================

function cvmInjectContactWebsite() {
    const modal =
        document.querySelector(
            "#cvmContactModal .cvm-modal-content"
        );

    if (
        !modal
        || modal.querySelector(
            "#cvmContactWebsite"
        )
    ) {
        return;
    }

    const block =
        document.createElement(
            "div"
        );

    block.id =
        "cvmContactWebsite";

    block.className =
        "cvm-contact-website";

    block.innerHTML = `
        <div class="cvm-contact-website-copy">

            <strong id="cvmContactWebsiteTitle"></strong>

            <span id="cvmContactWebsiteText"></span>

        </div>


        <a
            id="cvmContactWebsiteLink"
            href="${CVM_SITE_URL}"
            target="_blank"
            rel="noopener noreferrer"
        ></a>
    `;

    modal.appendChild(
        block
    );

    cvmRefreshContactWebsiteText();
}

function cvmRefreshContactWebsiteText() {
    const title =
        document.querySelector(
            "#cvmContactWebsiteTitle"
        );

    const text =
        document.querySelector(
            "#cvmContactWebsiteText"
        );

    const link =
        document.querySelector(
            "#cvmContactWebsiteLink"
        );

    if (title) {
        title.textContent =
            cvmPatchCopy(
                "websiteTitle"
            );
    }

    if (text) {
        text.textContent =
            cvmPatchCopy(
                "websiteText"
            );
    }

    if (link) {
        link.textContent =
            `${
                cvmPatchCopy(
                    "visitWebsite"
                )
            } ↗`;
    }
}


// ===========================================================
// DONATION MODAL
// ===========================================================

function cvmInjectDonationModal() {
    const layer =
        document.querySelector(
            "#cvmModalLayer"
        );

    if (
        !layer
        || document.querySelector(
            "#cvmSupportModal"
        )
    ) {
        return;
    }

    const modal =
        document.createElement(
            "section"
        );

    modal.id =
        "cvmSupportModal";

    modal.className =
        "cvm-modal cvm-support-modal hidden";

    modal.innerHTML = `
        <div class="cvm-modal-header">

            <div>

                <div class="eyebrow">
                    CVM
                </div>

                <h2 id="cvmSupportTitle"></h2>

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

            <div class="cvm-support-mark">
                ♡
            </div>

            <h2 id="cvmSupportHeadline"></h2>

            <p id="cvmSupportText"></p>

            <div
                id="cvmSupportFree"
                class="cvm-support-free-pill"
            ></div>

        </div>


        <div class="cvm-modal-footer centered">

            <button
                id="cvmSupportClose"
                type="button"
                class="secondary-button"
            ></button>


            <a
                id="cvmSupportDonateLink"
                class="primary-button cvm-support-coming-soon"
                href="#"
                role="button"
                aria-disabled="true"
            ></a>

        </div>
    `;

    layer.appendChild(
        modal
    );


    document.querySelector(
        "#cvmSupportClose"
    )?.addEventListener(
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


    document.querySelector(
        "#cvmSupportDonateLink"
    )?.addEventListener(
        "click",
        (event) => {
            if (
                !CVM_DONATION_URL
            ) {
                event.preventDefault();
            }
        }
    );


    cvmRefreshDonationModalText();
}

function cvmRefreshDonationModalText() {
    const title =
        document.querySelector(
            "#cvmSupportTitle"
        );

    const headline =
        document.querySelector(
            "#cvmSupportHeadline"
        );

    const text =
        document.querySelector(
            "#cvmSupportText"
        );

    const free =
        document.querySelector(
            "#cvmSupportFree"
        );

    const close =
        document.querySelector(
            "#cvmSupportClose"
        );

    const link =
        document.querySelector(
            "#cvmSupportDonateLink"
        );


    if (title) {
        title.textContent =
            cvmPatchCopy(
                "supportTitle"
            );
    }

    if (headline) {
        headline.textContent =
            cvmPatchCopy(
                "supportTitle"
            );
    }

    if (text) {
        text.textContent =
            cvmPatchCopy(
                "supportText"
            );
    }

    if (free) {
        free.textContent =
            `✓ ${
                cvmPatchCopy(
                    "supportFree"
                )
            }`;
    }

    if (close) {
        close.textContent =
            cvmPatchCopy(
                "close"
            );
    }


    if (link) {
        if (
            CVM_DONATION_URL
        ) {
            link.textContent =
                `♡ ${
                    cvmPatchCopy(
                        "support"
                    )
                }`;

            link.classList.remove(
                "cvm-support-coming-soon"
            );

            link.removeAttribute(
                "aria-disabled"
            );

            link.href =
                CVM_DONATION_URL;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";
        }
        else {
            link.textContent =
                cvmPatchCopy(
                    "supportSoon"
                );

            link.classList.add(
                "cvm-support-coming-soon"
            );

            link.setAttribute(
                "aria-disabled",
                "true"
            );

            link.href =
                "#";
        }
    }
}


// ===========================================================
// REFRESH PATCH TEXT
// ===========================================================

function cvmRefreshPatchText() {
    const donationLabel =
        document.querySelector(
            ".cvm-donation-label"
        );

    if (donationLabel) {
        donationLabel.textContent =
            cvmPatchCopy(
                "support"
            );
    }

    cvmPatchLanguageFlags();
    cvmRefreshDonationModalText();
    cvmRefreshContactWebsiteText();
}


// ===========================================================
// START
// ===========================================================

function cvmStartNavPatch() {
    cvmOrganizeTopbar();

    cvmInjectContactWebsite();

    cvmInjectDonationModal();

    cvmRefreshPatchText();

    cvmInstallJournalChangeTracking();


    document.querySelector(
        "#cvmDonationBtn"
    )?.addEventListener(
        "click",
        () => {
            cvmRefreshDonationModalText();

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


    // Journal always starts hidden.
    if (
        typeof applyJournalVisibility
        === "function"
    ) {
        applyJournalVisibility(
            false
        );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    cvmStartNavPatch
);
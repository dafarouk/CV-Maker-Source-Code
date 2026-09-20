"use strict";

// ===========================================================
// CVM GITHUB RELEASE UPDATER
// - Manual check from About -> Check updates
// - Automatic check at startup, at most once every 24 hours
// - Centered verified download progress
// - Visible installer handoff
// - One-time post-update success / changelog modal
// ===========================================================

const cvmUpdaterState = {
    initialized: false,
    automaticStarted: false,
    busy: false,
    handoffStarted: false,
};


function cvmUpdaterApi() {
    return window.pywebview?.api || null;
}


function cvmUpdaterText(en, fr) {
    if (typeof cvmV05Text === "function") {
        return cvmV05Text(en, fr);
    }

    return document.documentElement.lang === "fr"
        ? fr
        : en;
}


function cvmUpdaterEscape(value) {
    if (typeof cvmV05Escape === "function") {
        return cvmV05Escape(value ?? "");
    }

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}


function cvmUpdaterCleanReleaseLine(value) {
    return String(value || "")
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*[-*•]\s+/, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim();
}


function cvmUpdaterV102Highlights() {
    if (document.documentElement.lang === "fr") {
        return [
            "Correction des libellés Tools / Outils, des groupes de compétences et des langues qui pouvaient disparaître dans l’aperçu HTML du CV.",
            "LaTeX Studio transformé en véritable environnement de code avec coloration syntaxique, ligne active, numéros de ligne, correspondance des parenthèses, recherche/remplacement et barre d’état.",
            "Expérience de mise à jour améliorée avec une fenêtre centrée affichant la progression réelle du téléchargement et la vérification SHA-256.",
            "Ajout d’un message clair pendant l’installation demandant de ne pas fermer ou relancer CV Maker manuellement pendant que l’installateur termine.",
            "Ajout d’un récapitulatif unique après mise à jour lorsque CV Maker se rouvre automatiquement.",
        ];
    }

    return [
        "Fixed Tools / Outils, skill group labels and language labels that could disappear in the HTML CV preview.",
        "Rebuilt LaTeX Studio into a polished coding environment with syntax highlighting, active line, line numbers, bracket matching, search/replace and editor status.",
        "Improved the update experience with a centered window showing real download progress and SHA-256 verification status.",
        "Added a clear installation handoff telling users not to close or reopen CV Maker manually while the installer finishes.",
        "Added a one-time update summary after CV Maker automatically reopens.",
    ];
}


function cvmUpdaterReleaseItems(notes, version = "") {
    const text = String(notes || "").trim();

    if (!text) {
        if (String(version).replace(/^v/i, "") === "1.0.2") {
            return cvmUpdaterV102Highlights();
        }

        return [
            cvmUpdaterText(
                "This update includes improvements and fixes for CV Maker.",
                "Cette mise à jour contient des améliorations et correctifs pour CV Maker."
            ),
        ];
    }

    const items = text
        .split(/\r?\n/)
        .map(cvmUpdaterCleanReleaseLine)
        .filter(Boolean)
        .filter((line) => {
            const lowered = line.toLocaleLowerCase();

            return !(
                lowered === "what's new"
                || lowered === "whats new"
                || lowered === "what is new"
                || lowered === "problems fixed"
                || lowered === "problems fixed and improvements"
                || lowered === "problems fixed & improvements"
                || lowered === "bug fixes"
                || lowered === "changes"
            );
        });

    return items.length
        ? items.slice(0, 8)
        : cvmUpdaterReleaseItems("", version);
}


function cvmUpdaterReleaseListHtml(items) {
    return `
        <div class="cvm-update-fix-list">
            ${items.map((item) => `
                <div class="cvm-update-fix-item">
                    <span class="cvm-update-fix-check">✓</span>

                    <div class="cvm-update-fix-copy">
                        ${cvmUpdaterEscape(item)}
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}


function cvmUpdaterNotesHtml(notes, version = "") {
    const items = cvmUpdaterReleaseItems(
        notes,
        version
    );

    return `
        <section class="cvm-update-release-card">
            <div class="cvm-update-release-heading">
                <strong>
                    ${cvmUpdaterText(
                        "Problems fixed & improvements",
                        "Problèmes corrigés et améliorations"
                    )}
                </strong>

                ${
                    version
                        ? `
                            <span class="cvm-update-version-pill">
                                v${cvmUpdaterEscape(
                                    String(version)
                                        .replace(/^v/i, "")
                                )}
                            </span>
                        `
                        : ""
                }
            </div>

            ${cvmUpdaterReleaseListHtml(items)}
        </section>
    `;
}


function cvmUpdaterFormatBytes(value) {
    const bytes = Number(value || 0);

    if (
        !Number.isFinite(bytes)
        || bytes <= 0
    ) {
        return "";
    }

    if (
        bytes
        >= 1024 * 1024 * 1024
    ) {
        return (
            `${(
                bytes
                / (
                    1024
                    * 1024
                    * 1024
                )
            ).toFixed(1)} GB`
        );
    }

    if (
        bytes
        >= 1024 * 1024
    ) {
        return (
            `${(
                bytes
                / (
                    1024
                    * 1024
                )
            ).toFixed(1)} MB`
        );
    }

    if (
        bytes
        >= 1024
    ) {
        return (
            `${(
                bytes
                / 1024
            ).toFixed(1)} KB`
        );
    }

    return `${Math.round(bytes)} B`;
}


// ===========================================================
// CENTERED DOWNLOAD / INSTALL HANDOFF WINDOW
// ===========================================================

function cvmUpdaterEnsureProgressWindow() {
    let layer =
        document.querySelector(
            "#cvmUpdaterProgressLayer"
        );

    if (layer) {
        return layer;
    }

    layer =
        document.createElement(
            "div"
        );

    layer.id =
        "cvmUpdaterProgressLayer";

    layer.className =
        "cvm-updater-progress-layer hidden";

    layer.setAttribute(
        "aria-hidden",
        "true"
    );

    layer.innerHTML = `
        <section
            id="cvmUpdaterProgressCard"
            class="cvm-updater-progress-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cvmUpdaterProgressTitle"
        >
            <div class="cvm-updater-progress-brand">
                <div class="cvm-updater-progress-mark">
                    ↻
                </div>

                <div>
                    <div class="cvm-updater-progress-eyebrow">
                        ${cvmUpdaterText(
                            "CV MAKER UPDATE",
                            "MISE À JOUR CV MAKER"
                        )}
                    </div>

                    <h2 id="cvmUpdaterProgressTitle">
                        ${cvmUpdaterText(
                            "Preparing update",
                            "Préparation de la mise à jour"
                        )}
                    </h2>
                </div>
            </div>

            <p
                id="cvmUpdaterProgressMessage"
                class="cvm-updater-progress-message"
            >
                ${cvmUpdaterText(
                    "Preparing the secure update download…",
                    "Préparation du téléchargement sécurisé…"
                )}
            </p>

            <div
                class="cvm-updater-progress-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="0"
            >
                <div
                    id="cvmUpdaterProgressBar"
                    class="cvm-updater-progress-bar"
                ></div>
            </div>

            <div class="cvm-updater-progress-meta">
                <span id="cvmUpdaterProgressStage">
                    ${cvmUpdaterText(
                        "Preparing…",
                        "Préparation…"
                    )}
                </span>

                <strong id="cvmUpdaterProgressPercent">
                    0%
                </strong>
            </div>

            <p
                id="cvmUpdaterProgressNotice"
                class="cvm-updater-progress-notice"
            >
                ${cvmUpdaterText(
                    "Keep CV Maker open while the update is downloading.",
                    "Gardez CV Maker ouvert pendant le téléchargement de la mise à jour."
                )}
            </p>
        </section>
    `;

    document.body.appendChild(
        layer
    );

    return layer;
}


function cvmUpdaterOpenProgressWindow() {
    const layer =
        cvmUpdaterEnsureProgressWindow();

    layer.classList.remove(
        "hidden"
    );

    layer.setAttribute(
        "aria-hidden",
        "false"
    );
}


function cvmUpdaterCloseProgressWindow() {
    const layer =
        document.querySelector(
            "#cvmUpdaterProgressLayer"
        );

    if (!layer) {
        return;
    }

    layer.classList.add(
        "hidden"
    );

    layer.setAttribute(
        "aria-hidden",
        "true"
    );
}


function cvmUpdaterProgressCopy(phase) {
    const copies = {
        preparing: {
            title: cvmUpdaterText(
                "Preparing update",
                "Préparation de la mise à jour"
            ),

            stage: cvmUpdaterText(
                "Preparing…",
                "Préparation…"
            ),

            message: cvmUpdaterText(
                "Preparing the secure update download…",
                "Préparation du téléchargement sécurisé…"
            ),
        },

        download: {
            title: cvmUpdaterText(
                "Downloading update",
                "Téléchargement de la mise à jour"
            ),

            stage: cvmUpdaterText(
                "Downloading",
                "Téléchargement"
            ),

            message: cvmUpdaterText(
                "Downloading the verified CV Maker installer…",
                "Téléchargement de l’installateur CV Maker vérifié…"
            ),
        },

        verify: {
            title: cvmUpdaterText(
                "Verifying update",
                "Vérification de la mise à jour"
            ),

            stage: cvmUpdaterText(
                "Verifying SHA-256",
                "Vérification SHA-256"
            ),

            message: cvmUpdaterText(
                "Download complete. Verifying the installer integrity…",
                "Téléchargement terminé. Vérification de l’intégrité de l’installateur…"
            ),
        },

        verified: {
            title: cvmUpdaterText(
                "Update verified",
                "Mise à jour vérifiée"
            ),

            stage: cvmUpdaterText(
                "Ready to install",
                "Prêt à installer"
            ),

            message: cvmUpdaterText(
                "The installer is verified and ready.",
                "L’installateur est vérifié et prêt."
            ),
        },

        handoff: {
            title: cvmUpdaterText(
                "Installing update",
                "Installation de la mise à jour"
            ),

            stage: cvmUpdaterText(
                "Starting installer",
                "Démarrage de l’installateur"
            ),

            message: cvmUpdaterText(
                "CV Maker will close in a moment so Windows can replace the application files.",
                "CV Maker va se fermer dans un instant afin que Windows puisse remplacer les fichiers de l’application."
            ),
        },

        installing: {
            title: cvmUpdaterText(
                "Installing update",
                "Installation de la mise à jour"
            ),

            stage: cvmUpdaterText(
                "Installer started",
                "Installateur démarré"
            ),

            message: cvmUpdaterText(
                "CV Maker is closing now. The installer progress window will remain visible.",
                "CV Maker se ferme maintenant. La fenêtre de progression de l’installateur restera visible."
            ),
        },

        error: {
            title: cvmUpdaterText(
                "Update failed",
                "Échec de la mise à jour"
            ),

            stage: cvmUpdaterText(
                "Error",
                "Erreur"
            ),

            message: cvmUpdaterText(
                "The update could not be completed.",
                "La mise à jour n’a pas pu être terminée."
            ),
        },
    };

    return (
        copies[phase]
        || copies.preparing
    );
}


function cvmUpdaterSetProgress(
    payload = {}
) {
    const layer =
        cvmUpdaterEnsureProgressWindow();

    const card =
        layer.querySelector(
            "#cvmUpdaterProgressCard"
        );

    const title =
        layer.querySelector(
            "#cvmUpdaterProgressTitle"
        );

    const message =
        layer.querySelector(
            "#cvmUpdaterProgressMessage"
        );

    const track =
        layer.querySelector(
            ".cvm-updater-progress-track"
        );

    const bar =
        layer.querySelector(
            "#cvmUpdaterProgressBar"
        );

    const stage =
        layer.querySelector(
            "#cvmUpdaterProgressStage"
        );

    const percentText =
        layer.querySelector(
            "#cvmUpdaterProgressPercent"
        );

    const notice =
        layer.querySelector(
            "#cvmUpdaterProgressNotice"
        );

    const phase =
        String(
            payload.phase
            || "preparing"
        );

    const copy =
        cvmUpdaterProgressCopy(
            phase
        );

    const rawPercent =
        Number(
            payload.percent
            ?? 0
        );

    const percent =
        Math.max(
            0,

            Math.min(
                100,

                Number.isFinite(
                    rawPercent
                )
                    ? Math.round(
                        rawPercent
                    )
                    : 0
            )
        );

    title.textContent =
        payload.title
        || copy.title;

    message.textContent =
        payload.message_localized
        || copy.message;

    stage.textContent =
        copy.stage;

    percentText.textContent =
        `${percent}%`;

    bar.style.width =
        `${percent}%`;

    track.setAttribute(
        "aria-valuenow",
        String(percent)
    );

    card.classList.toggle(
        "is-installing",

        phase === "handoff"
        || phase === "installing"
    );

    card.classList.toggle(
        "is-error",

        phase === "error"
    );


    const downloadedBytes =
        Number(
            payload.downloaded_bytes
            || 0
        );

    const totalBytes =
        Number(
            payload.total_bytes
            || 0
        );


    if (
        phase === "download"
        && downloadedBytes > 0
        && totalBytes > 0
    ) {
        stage.textContent =
            (
                `${copy.stage} · `
                + `${cvmUpdaterFormatBytes(
                    downloadedBytes
                )}`
                + ` / `
                + `${cvmUpdaterFormatBytes(
                    totalBytes
                )}`
            );
    }


    if (
        phase === "handoff"
        || phase === "installing"
    ) {
        notice.textContent =
            cvmUpdaterText(
                "Do not close or reopen CV Maker manually. The installer will finish the update and CV Maker will reopen automatically when it is done.",
                "Ne fermez pas et ne relancez pas CV Maker manuellement. L’installateur terminera la mise à jour et CV Maker se rouvrira automatiquement à la fin."
            );
    }
    else if (
        phase === "verify"
        || phase === "verified"
    ) {
        notice.textContent =
            cvmUpdaterText(
                "The downloaded installer is being checked before anything is installed.",
                "L’installateur téléchargé est vérifié avant toute installation."
            );
    }
    else {
        notice.textContent =
            cvmUpdaterText(
                "Keep CV Maker open while the update is downloading.",
                "Gardez CV Maker ouvert pendant le téléchargement de la mise à jour."
            );
    }

    cvmUpdaterOpenProgressWindow();
}


window.cvmUpdaterReceiveProgress =
    function (payload) {
        cvmUpdaterSetProgress(
            payload || {}
        );
    };


// ===========================================================
// MODALS
// ===========================================================

async function cvmUpdaterShowError(
    message
) {
    if (
        typeof cvmV05ShowError
        === "function"
    ) {
        return cvmV05ShowError(
            message
        );
    }

    console.error(
        message
    );
}


async function cvmUpdaterShowUpToDate(
    result
) {
    return cvmV05Modal({
        id:
            "cvmUpdateResult",

        eyebrow:
            "UPDATE",

        title:
            cvmUpdaterText(
                "CV Maker is up to date",
                "CV Maker est à jour"
            ),

        html: `
            <p>
                ${cvmUpdaterText(
                    "You already have the latest public version of CV Maker.",
                    "Vous utilisez déjà la dernière version publique de CV Maker."
                )}
            </p>

            <p>
                <strong>
                    ${cvmUpdaterText(
                        "Installed version",
                        "Version installée"
                    )}:
                </strong>

                ${cvmUpdaterEscape(
                    result?.current
                    || ""
                )}
            </p>
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


async function cvmUpdaterShowCompletedUpdate(
    info
) {
    if (!info?.to_version) {
        return;
    }

    const version =
        String(
            info.to_version
        )
            .replace(
                /^v/i,
                ""
            );

    const fromVersion =
        String(
            info.from_version
            || ""
        )
            .replace(
                /^v/i,
                ""
            );

    const items =
        cvmUpdaterReleaseItems(
            info.notes,
            version
        );

    const actions = [];

    if (info.release_url) {
        actions.push({
            id:
                "release",

            label:
                cvmUpdaterText(
                    "View release",
                    "Voir la version"
                ),
        });
    }

    actions.push({
        id:
            "continue",

        label:
            cvmUpdaterText(
                "Continue",
                "Continuer"
            ),

        primary:
            true,
    });


    const choice =
        await cvmV05Modal({
            id:
                "cvmUpdateCompleteModal",

            eyebrow:
                cvmUpdaterText(
                    "UPDATE COMPLETE",
                    "MISE À JOUR TERMINÉE"
                ),

            title:
                cvmUpdaterText(
                    "CV Maker updated successfully",
                    "CV Maker a été mis à jour avec succès"
                ),

            html: `
                <div class="cvm-update-success-hero">

                    <div class="cvm-update-success-icon">
                        ✓
                    </div>

                    <strong>
                        ${
                            fromVersion
                                ? cvmUpdaterText(
                                    `Updated from v${cvmUpdaterEscape(
                                        fromVersion
                                    )} to v${cvmUpdaterEscape(
                                        version
                                    )}`,

                                    `Mise à jour de v${cvmUpdaterEscape(
                                        fromVersion
                                    )} vers v${cvmUpdaterEscape(
                                        version
                                    )}`
                                )
                                : cvmUpdaterText(
                                    `CV Maker v${cvmUpdaterEscape(
                                        version
                                    )} is ready`,

                                    `CV Maker v${cvmUpdaterEscape(
                                        version
                                    )} est prêt`
                                )
                        }
                    </strong>

                    <span>
                        ${cvmUpdaterText(
                            "The update finished and CV Maker reopened automatically.",
                            "La mise à jour est terminée et CV Maker s’est rouvert automatiquement."
                        )}
                    </span>

                </div>

                <section class="cvm-update-release-card">

                    <div class="cvm-update-release-heading">

                        <strong>
                            ${cvmUpdaterText(
                                "Bugs fixed & improvements",
                                "Bugs corrigés et améliorations"
                            )}
                        </strong>

                        <span class="cvm-update-version-pill">
                            v${cvmUpdaterEscape(
                                version
                            )}
                        </span>

                    </div>

                    ${cvmUpdaterReleaseListHtml(
                        items
                    )}

                </section>
            `,

            actions,
        });


    if (
        choice === "release"
        && info.release_url
    ) {
        window.open(
            info.release_url,
            "_blank",
            "noopener,noreferrer"
        );
    }
}


async function cvmUpdaterShowAvailable(
    result,
    automatic = false
) {
    const automaticInstall =
        Boolean(
            result?.install_ready
        );

    const choice =
        await cvmV05Modal({
            id:
                "cvmUpdateAvailable",

            eyebrow:
                automatic
                    ? cvmUpdaterText(
                        "NEW UPDATE",
                        "NOUVELLE MISE À JOUR"
                    )
                    : "UPDATE",

            title:
                cvmUpdaterText(
                    `CV Maker ${result.latest} is available`,
                    `CV Maker ${result.latest} est disponible`
                ),

            html: `
                <p>
                    ${cvmUpdaterText(
                        `You are using version ${result.current}.`,
                        `Vous utilisez la version ${result.current}.`
                    )}
                </p>

                ${cvmUpdaterNotesHtml(
                    result.notes,
                    result.latest
                )}

                ${
                    automaticInstall
                        ? `
                            <p>
                                ${cvmUpdaterText(
                                    "Press Download & Install. CV Maker will show the download progress, verify the installer, close itself for installation, then reopen automatically.",
                                    "Cliquez sur Télécharger et installer. CV Maker affichera la progression du téléchargement, vérifiera l’installateur, se fermera pour l’installation puis se rouvrira automatiquement."
                                )}
                            </p>
                        `
                        : `
                            <p>
                                ${cvmUpdaterText(
                                    "Automatic installation is not available for this release yet. You can open the GitHub release below.",
                                    "L’installation automatique n’est pas encore disponible pour cette version. Vous pouvez ouvrir la page GitHub ci-dessous."
                                )}
                            </p>
                        `
                }

                ${
                    result.release_url
                        ? `
                            <p>
                                <a
                                    href="${cvmUpdaterEscape(
                                        result.release_url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    ${cvmUpdaterText(
                                        "View release on GitHub ↗",
                                        "Voir la version sur GitHub ↗"
                                    )}
                                </a>
                            </p>
                        `
                        : ""
                }
            `,

            actions:
                automaticInstall
                    ? [
                        {
                            id:
                                "later",

                            label:
                                cvmUpdaterText(
                                    "Later",
                                    "Plus tard"
                                ),
                        },

                        {
                            id:
                                "install",

                            label:
                                cvmUpdaterText(
                                    "Download & Install",
                                    "Télécharger et installer"
                                ),

                            primary:
                                true,
                        },
                    ]
                    : [
                        {
                            id:
                                "close",

                            label:
                                cvmUpdaterText(
                                    "Close",
                                    "Fermer"
                                ),

                            primary:
                                true,
                        },
                    ],
        });

    if (
        choice
        !== "install"
    ) {
        return;
    }

    await cvmUpdaterDownloadAndInstall();
}


function cvmUpdaterWait(
    milliseconds
) {
    return new Promise(
        (resolve) =>
            window.setTimeout(
                resolve,
                milliseconds
            )
    );
}


// ===========================================================
// DOWNLOAD + INSTALL
// ===========================================================

async function cvmUpdaterDownloadAndInstall() {
    if (cvmUpdaterState.busy) {
        return;
    }

    const api =
        cvmUpdaterApi();

    if (
        !api?.download_update
        || !api?.install_update
    ) {
        return cvmUpdaterShowError(
            cvmUpdaterText(
                "The automatic updater is not available in this build.",
                "La mise à jour automatique n’est pas disponible dans cette version."
            )
        );
    }


    const dirty =
        await api
            .get_dirty_state?.();

    if (dirty?.dirty) {
        await cvmV05Modal({
            id:
                "cvmUpdateSaveFirst",

            eyebrow:
                "UPDATE",

            title:
                cvmUpdaterText(
                    "Save your CV first",
                    "Enregistrez d’abord votre CV"
                ),

            html: `
                <p>
                    ${cvmUpdaterText(
                        "You have unsaved changes. Save your project, then run the update again so no work is lost.",
                        "Vous avez des modifications non enregistrées. Enregistrez votre projet puis relancez la mise à jour afin de ne perdre aucun travail."
                    )}
                </p>
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

        return;
    }


    cvmUpdaterState.busy =
        true;

    cvmUpdaterState.handoffStarted =
        false;


    cvmUpdaterSetProgress({
        phase:
            "preparing",

        percent:
            0,
    });


    try {
        const downloaded =
            await api
                .download_update();


        if (!downloaded?.ok) {
            cvmUpdaterCloseProgressWindow();

            await cvmUpdaterShowError(
                downloaded?.message
                || cvmUpdaterText(
                    "The update could not be downloaded.",
                    "La mise à jour n’a pas pu être téléchargée."
                )
            );

            return;
        }


        cvmUpdaterSetProgress({
            phase:
                "verified",

            percent:
                100,
        });


        await cvmUpdaterWait(
            650
        );


        cvmUpdaterSetProgress({
            phase:
                "handoff",

            percent:
                100,
        });


        await cvmUpdaterWait(
            1800
        );


        const launched =
            await api.install_update(
                downloaded.path
            );


        if (!launched?.ok) {
            cvmUpdaterCloseProgressWindow();

            await cvmUpdaterShowError(
                launched?.message
                || cvmUpdaterText(
                    "The update installer could not be started.",
                    "L’installateur de mise à jour n’a pas pu être démarré."
                )
            );

            return;
        }


        cvmUpdaterState.handoffStarted =
            true;


        cvmUpdaterSetProgress({
            phase:
                "installing",

            percent:
                100,
        });


        // Python closes this CVM process shortly after the
        // native installer starts.
        //
        // The installer uses /SILENT so the native installer
        // progress remains visible.
        //
        // Inno Setup reopens CV Maker automatically when the
        // installation is complete.
    }
    catch (error) {
        console.error(
            error
        );

        cvmUpdaterCloseProgressWindow();

        await cvmUpdaterShowError(
            cvmUpdaterText(
                "The update failed. Please try again later.",
                "La mise à jour a échoué. Réessayez plus tard."
            )
        );
    }
    finally {
        cvmUpdaterState.busy =
            false;

        if (
            !cvmUpdaterState
                .handoffStarted
        ) {
            cvmUpdaterCloseProgressWindow();
        }
    }
}


// ===========================================================
// UPDATE CHECK
// ===========================================================

async function cvmUpdaterCheck(
    manual = false
) {
    const api =
        cvmUpdaterApi();

    if (!api?.check_for_updates) {
        if (manual) {
            await cvmUpdaterShowError(
                cvmUpdaterText(
                    "The update service is unavailable.",
                    "Le service de mise à jour est indisponible."
                )
            );
        }

        return;
    }


    let result;

    try {
        result =
            await api
                .check_for_updates(
                    Boolean(
                        manual
                    )
                );
    }
    catch (error) {
        console.error(
            error
        );

        if (manual) {
            await cvmUpdaterShowError(
                cvmUpdaterText(
                    "Unable to check for updates right now.",
                    "Impossible de vérifier les mises à jour pour le moment."
                )
            );
        }

        return;
    }


    // This is deliberately checked BEFORE the normal
    // update-check result so a successful update can still be
    // acknowledged even when the 24h GitHub check is skipped.
    if (
        result?.completed_update
    ) {
        await cvmUpdaterShowCompletedUpdate(
            result.completed_update
        );
    }


    if (
        result?.skipped
        && !manual
    ) {
        return;
    }


    if (!result?.configured) {
        if (manual) {
            await cvmV05Modal({
                id:
                    "cvmUpdateNotConfigured",

                eyebrow:
                    "UPDATE",

                title:
                    cvmUpdaterText(
                        "Updates are not configured yet",
                        "Les mises à jour ne sont pas encore configurées"
                    ),

                html:
                    `<p>${
                        cvmUpdaterEscape(
                            result?.message
                            || ""
                        )
                    }</p>`,

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

        return;
    }


    if (!result?.ok) {
        if (manual) {
            await cvmUpdaterShowError(
                result?.message
                || cvmUpdaterText(
                    "Update check failed.",
                    "La vérification des mises à jour a échoué."
                )
            );
        }

        return;
    }


    if (result.available) {
        await cvmUpdaterShowAvailable(
            result,
            !manual
        );

        return;
    }


    if (manual) {
        await cvmUpdaterShowUpToDate(
            result
        );
    }
}


// Replace the old About -> Check updates implementation
// from productivity_v05.js.
async function cvmV05CheckUpdates() {
    return cvmUpdaterCheck(
        true
    );
}


window.cvmV05CheckUpdates =
    cvmV05CheckUpdates;


// ===========================================================
// AUTOMATIC STARTUP CHECK
// ===========================================================

function cvmUpdaterModalIsOpen() {
    const layer =
        document.querySelector(
            "#cvmModalLayer"
        );

    return Boolean(
        layer
        && !layer.classList
            .contains(
                "hidden"
            )
    );
}


function cvmUpdaterScheduleAutomaticCheck(
    attempt = 0
) {
    if (
        cvmUpdaterState
            .automaticStarted
    ) {
        return;
    }


    const api =
        cvmUpdaterApi();


    if (!api) {
        window.setTimeout(
            () =>
                cvmUpdaterScheduleAutomaticCheck(
                    attempt + 1
                ),

            500
        );

        return;
    }


    // Recovery and other startup modals get priority.
    if (
        cvmUpdaterModalIsOpen()
    ) {
        if (attempt < 60) {
            window.setTimeout(
                () =>
                    cvmUpdaterScheduleAutomaticCheck(
                        attempt + 1
                    ),

                1000
            );
        }

        return;
    }


    cvmUpdaterState.automaticStarted =
        true;


    cvmUpdaterCheck(
        false
    );
}


function cvmUpdaterInit() {
    if (
        cvmUpdaterState
            .initialized
    ) {
        return;
    }


    cvmUpdaterState.initialized =
        true;


    cvmUpdaterEnsureProgressWindow();


    // Give Home + recovery UI time to finish before
    // updater UI appears.
    window.setTimeout(
        () =>
            cvmUpdaterScheduleAutomaticCheck(),

        3500
    );
}


document.addEventListener(
    "DOMContentLoaded",
    cvmUpdaterInit
);


window.addEventListener(
    "pywebviewready",

    () =>
        window.setTimeout(
            cvmUpdaterInit,
            0
        )
);
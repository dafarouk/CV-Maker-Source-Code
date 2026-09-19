"use strict";

// ===========================================================
// CVM GITHUB RELEASE UPDATER
// - Manual check from About -> Check updates
// - Automatic check at startup, at most once every 24 hours
// - One-click verified download + silent installer launch
// ===========================================================

const cvmUpdaterState = {
    initialized: false,
    automaticStarted: false,
    busy: false,
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


function cvmUpdaterNotesHtml(notes) {
    const text = String(notes || "").trim();

    if (!text) {
        return `
            <p>
                ${cvmUpdaterText(
                    "This update includes improvements and fixes for CV Maker.",
                    "Cette mise à jour contient des améliorations et correctifs pour CV Maker."
                )}
            </p>
        `;
    }

    const shortened = text.length > 2200
        ? `${text.slice(0, 2200).trim()}…`
        : text;

    return `
        <div style="white-space:pre-wrap; line-height:1.65;">
            ${cvmUpdaterEscape(shortened)}
        </div>
    `;
}


async function cvmUpdaterShowError(message) {
    if (typeof cvmV05ShowError === "function") {
        return cvmV05ShowError(message);
    }

    console.error(message);
}


async function cvmUpdaterShowUpToDate(result) {
    return cvmV05Modal({
        id: "cvmUpdateResult",
        eyebrow: "UPDATE",
        title: cvmUpdaterText(
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
                <strong>${cvmUpdaterText("Installed version", "Version installée")}:</strong>
                ${cvmUpdaterEscape(result?.current || "")}
            </p>
        `,
        actions: [
            {
                id: "ok",
                label: "OK",
                primary: true,
            },
        ],
    });
}


async function cvmUpdaterShowAvailable(result, automatic = false) {
    const automaticInstall = Boolean(result?.install_ready);

    const choice = await cvmV05Modal({
        id: "cvmUpdateAvailable",
        eyebrow: automatic
            ? cvmUpdaterText("NEW UPDATE", "NOUVELLE MISE À JOUR")
            : "UPDATE",
        title: cvmUpdaterText(
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

            ${cvmUpdaterNotesHtml(result.notes)}

            ${
                automaticInstall
                    ? `
                        <p>
                            ${cvmUpdaterText(
                                "Press Download & Install and CV Maker will download the verified installer, close itself and install the update automatically.",
                                "Cliquez sur Télécharger et installer. CV Maker téléchargera l’installateur vérifié, se fermera puis installera automatiquement la mise à jour."
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
                                href="${cvmUpdaterEscape(result.release_url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ${cvmUpdaterText("View release on GitHub ↗", "Voir la version sur GitHub ↗")}
                            </a>
                        </p>
                    `
                    : ""
            }
        `,
        actions: automaticInstall
            ? [
                {
                    id: "later",
                    label: cvmUpdaterText("Later", "Plus tard"),
                },
                {
                    id: "install",
                    label: cvmUpdaterText(
                        "Download & Install",
                        "Télécharger et installer"
                    ),
                    primary: true,
                },
            ]
            : [
                {
                    id: "close",
                    label: cvmUpdaterText("Close", "Fermer"),
                    primary: true,
                },
            ],
    });

    if (choice !== "install") {
        return;
    }

    await cvmUpdaterDownloadAndInstall();
}


async function cvmUpdaterDownloadAndInstall() {
    if (cvmUpdaterState.busy) {
        return;
    }

    const api = cvmUpdaterApi();

    if (!api?.download_update || !api?.install_update) {
        return cvmUpdaterShowError(
            cvmUpdaterText(
                "The automatic updater is not available in this build.",
                "La mise à jour automatique n’est pas disponible dans cette version."
            )
        );
    }

    const dirty = await api.get_dirty_state?.();

    if (dirty?.dirty) {
        await cvmV05Modal({
            id: "cvmUpdateSaveFirst",
            eyebrow: "UPDATE",
            title: cvmUpdaterText(
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
                    id: "ok",
                    label: "OK",
                    primary: true,
                },
            ],
        });

        return;
    }

    cvmUpdaterState.busy = true;

    if (typeof showToast === "function") {
        showToast(
            cvmUpdaterText(
                "Downloading and verifying the update…",
                "Téléchargement et vérification de la mise à jour…"
            ),
            "info"
        );
    }

    try {
        const downloaded = await api.download_update();

        if (!downloaded?.ok) {
            await cvmUpdaterShowError(
                downloaded?.message
                || cvmUpdaterText(
                    "The update could not be downloaded.",
                    "La mise à jour n’a pas pu être téléchargée."
                )
            );

            return;
        }

        if (typeof showToast === "function") {
            showToast(
                cvmUpdaterText(
                    "Update verified. Starting installation…",
                    "Mise à jour vérifiée. Installation en cours…"
                ),
                "success"
            );
        }

        const launched =
            await api.install_update(downloaded.path);

        if (!launched?.ok) {
            await cvmUpdaterShowError(
                launched?.message
                || cvmUpdaterText(
                    "The update installer could not be started.",
                    "L’installateur de mise à jour n’a pas pu être démarré."
                )
            );
        }
    }
    catch (error) {
        console.error(error);

        await cvmUpdaterShowError(
            cvmUpdaterText(
                "The update failed. Please try again later.",
                "La mise à jour a échoué. Réessayez plus tard."
            )
        );
    }
    finally {
        cvmUpdaterState.busy = false;
    }
}


async function cvmUpdaterCheck(manual = false) {
    const api = cvmUpdaterApi();

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
            await api.check_for_updates(Boolean(manual));
    }
    catch (error) {
        console.error(error);

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

    if (result?.skipped && !manual) {
        return;
    }

    if (!result?.configured) {
        if (manual) {
            await cvmV05Modal({
                id: "cvmUpdateNotConfigured",
                eyebrow: "UPDATE",
                title: cvmUpdaterText(
                    "Updates are not configured yet",
                    "Les mises à jour ne sont pas encore configurées"
                ),
                html:
                    `<p>${cvmUpdaterEscape(
                        result?.message || ""
                    )}</p>`,
                actions: [
                    {
                        id: "ok",
                        label: "OK",
                        primary: true,
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
        await cvmUpdaterShowUpToDate(result);
    }
}


// Replace the old About -> Check updates implementation
// from productivity_v05.js.
async function cvmV05CheckUpdates() {
    return cvmUpdaterCheck(true);
}

window.cvmV05CheckUpdates =
    cvmV05CheckUpdates;


function cvmUpdaterModalIsOpen() {
    const layer =
        document.querySelector("#cvmModalLayer");

    return Boolean(
        layer
        && !layer.classList.contains("hidden")
    );
}


function cvmUpdaterScheduleAutomaticCheck(attempt = 0) {
    if (cvmUpdaterState.automaticStarted) {
        return;
    }

    const api = cvmUpdaterApi();

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

    if (cvmUpdaterModalIsOpen()) {
        if (attempt < 30) {
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

    cvmUpdaterState.automaticStarted = true;

    cvmUpdaterCheck(false);
}


function cvmUpdaterInit() {
    if (cvmUpdaterState.initialized) {
        return;
    }

    cvmUpdaterState.initialized = true;

    // Give the home/recovery UI time to finish before
    // a background update check.
    window.setTimeout(
        () => cvmUpdaterScheduleAutomaticCheck(),
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
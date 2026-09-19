"use strict";

// ===========================================================
// CVM RECOVERY UI POLISH
// Keeps the existing recovery behavior, but presents the
// autosave title and timestamp in a proper product modal.
// ===========================================================

function cvmRecoveryUiLang() {
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

function cvmRecoveryUiText(en, fr) {
    return cvmRecoveryUiLang() === "fr"
        ? fr
        : en;
}

function cvmRecoveryUiFormatDateTime(value) {
    if (!value) {
        return cvmRecoveryUiText(
            "Save time unavailable",
            "Heure de sauvegarde indisponible"
        );
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const locale =
        cvmRecoveryUiLang() === "fr"
            ? "fr-FR"
            : "en-GB";

    const dateText =
        new Intl.DateTimeFormat(
            locale,
            {
                day: "numeric",
                month: "long",
                year: "numeric",
            }
        ).format(date);

    const timeText =
        new Intl.DateTimeFormat(
            locale,
            {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }
        ).format(date);

    return cvmRecoveryUiLang() === "fr"
        ? `${dateText} à ${timeText}`
        : `${dateText} at ${timeText}`;
}

function cvmRecoveryUiInstall() {
    if (
        typeof cvmV05CheckRecovery !== "function"
        || typeof cvmV05Modal !== "function"
        || typeof cvmV05Api !== "function"
    ) {
        return false;
    }

    cvmV05CheckRecovery = async function () {
        if (
            cvmV05.recoveryAsked
            || !cvmV05Api()
        ) {
            return;
        }

        cvmV05.recoveryAsked = true;

        const stateResult =
            await cvmV05Api()
                .get_recovery_state();

        if (!stateResult?.available) {
            return;
        }

        const projectTitle =
            stateResult.title
            || stateResult.person
            || "CV";

        const person =
            String(
                stateResult.person
                || ""
            ).trim();

        const savedAt =
            cvmRecoveryUiFormatDateTime(
                stateResult.modified_at
            );

        const personMarkup =
            person
                ? `
                    <div class="cvm-recovery-person">
                        ${cvmV05Escape(person)}
                    </div>
                `
                : "";

        const choice =
            await cvmV05Modal({
                id:
                    "cvmRecoveryModal",

                eyebrow:
                    cvmRecoveryUiText(
                        "RECOVERY",
                        "RÉCUPÉRATION"
                    ),

                title:
                    cvmRecoveryUiText(
                        "Continue where you left off?",
                        "Reprendre là où vous vous êtes arrêté ?"
                    ),

                html: `
                    <div class="cvm-recovery-card">

                        <div class="cvm-recovery-icon" aria-hidden="true">
                            ↻
                        </div>

                        <div>

                            <div class="cvm-recovery-kicker">
                                ${cvmRecoveryUiText(
                                    "LAST LOCAL AUTOSAVE",
                                    "DERNIÈRE SAUVEGARDE LOCALE"
                                )}
                            </div>

                            <h3 class="cvm-recovery-title">
                                ${cvmV05Escape(projectTitle)}
                            </h3>

                            <p class="cvm-recovery-date">
                                ${cvmRecoveryUiText(
                                    "Saved",
                                    "Sauvegardé le"
                                )}
                                ${cvmV05Escape(savedAt)}
                            </p>

                            ${personMarkup}

                        </div>

                    </div>

                    <p class="cvm-recovery-copy">
                        ${cvmRecoveryUiText(
                            "CVM found a locally saved session from your previous work. Recover it to continue editing exactly where you left off, or discard the autosave and start fresh.",
                            "CVM a trouvé une session sauvegardée localement lors de votre travail précédent. Récupérez-la pour reprendre exactement là où vous vous êtes arrêté, ou ignorez la sauvegarde pour repartir proprement."
                        )}
                    </p>
                `,

                actions: [
                    {
                        id:
                            "discard",

                        label:
                            cvmRecoveryUiText(
                                "Discard autosave",
                                "Ignorer la sauvegarde"
                            ),
                    },
                    {
                        id:
                            "recover",

                        label:
                            cvmRecoveryUiText(
                                "Recover session",
                                "Récupérer la session"
                            ),

                        primary:
                            true,
                    },
                ],
            });

        if (choice === "recover") {
            const recovered =
                await cvmV05Api()
                    .recover_autosave();

            if (recovered?.ok) {
                cvmUnlockOnNextProjectLoad = true;

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
        else if (choice === "discard") {
            await cvmV05Api()
                .discard_recovery();
        }
    };

    window.cvmV05CheckRecovery =
        cvmV05CheckRecovery;

    return true;
}

cvmRecoveryUiInstall();
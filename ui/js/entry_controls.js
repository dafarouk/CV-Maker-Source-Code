"use strict";

// ===========================================================
// CVM STRUCTURED ENTRY CONTROLS
// - Month/year-only date pickers
// - Skill chips added with Enter
// - CEFR language levels A1 -> C2
// ===========================================================

const CVM_CEFR_LEVELS = [
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
];


// ===========================================================
// SMALL LOCALIZED COPY
// ===========================================================

function cvmEntryLanguage() {
    return (
        typeof cvmCurrentLanguage !== "undefined"
        && cvmCurrentLanguage === "fr"
    ) ? "fr" : "en";
}

function cvmEntryText(key) {
    const copy = {
        en: {
            monthHint: "MM/YYYY only — choose a month and year.",
            skillHint: "Type a skill and press Enter to add it.",
            skillPlaceholder: "e.g. Power BI — press Enter",
            selectLevel: "Select level",
        },

        fr: {
            monthHint: "MM/AAAA uniquement — choisissez le mois et l'année.",
            skillHint: "Saisissez une compétence puis appuyez sur Entrée pour l'ajouter.",
            skillPlaceholder: "ex. Power BI — appuyez sur Entrée",
            selectLevel: "Choisir le niveau",
        },
    };

    return copy[cvmEntryLanguage()][key] || key;
}


// ===========================================================
// MONTH / YEAR NORMALIZATION
// ===========================================================

const CVM_MONTH_NAMES = {
    jan: 1,
    january: 1,
    janvier: 1,

    feb: 2,
    february: 2,
    fev: 2,
    fevr: 2,
    fevrier: 2,
    "février": 2,

    mar: 3,
    march: 3,
    mars: 3,

    apr: 4,
    april: 4,
    avr: 4,
    avril: 4,

    may: 5,
    mai: 5,

    jun: 6,
    june: 6,
    juin: 6,

    jul: 7,
    july: 7,
    juil: 7,
    juillet: 7,

    aug: 8,
    august: 8,
    aout: 8,
    "août": 8,

    sep: 9,
    sept: 9,
    september: 9,
    septembre: 9,

    oct: 10,
    october: 10,
    octobre: 10,

    nov: 11,
    november: 11,
    novembre: 11,

    dec: 12,
    december: 12,
    decembre: 12,
    "décembre": 12,
};

function cvmPadMonth(value) {
    return String(value).padStart(
        2,
        "0"
    );
}

function cvmParseMonthYear(value) {
    const raw = String(
        value || ""
    ).trim();

    if (!raw) {
        return null;
    }

    let match =
        raw.match(
            /^(\d{2})\/(\d{4})$/
        );

    if (match) {
        const month =
            Number(match[1]);

        const year =
            Number(match[2]);

        if (
            month >= 1
            && month <= 12
        ) {
            return {
                month,
                year,
            };
        }
    }


    match =
        raw.match(
            /^(\d{4})-(\d{2})$/
        );

    if (match) {
        const year =
            Number(match[1]);

        const month =
            Number(match[2]);

        if (
            month >= 1
            && month <= 12
        ) {
            return {
                month,
                year,
            };
        }
    }


    match =
        raw.match(
            /^(\d{4})$/
        );

    if (match) {
        return {
            month: 1,
            year: Number(
                match[1]
            ),
        };
    }


    match =
        raw.match(
            /^([^\s]+)\s+(\d{4})$/i
        );

    if (match) {
        const monthKey =
            match[1]
                .toLowerCase()
                .replace(
                    /\.$/,
                    ""
                );

        const month =
            CVM_MONTH_NAMES[
                monthKey
            ];

        if (month) {
            return {
                month,
                year: Number(
                    match[2]
                ),
            };
        }
    }

    return null;
}

function cvmMonthInputValue(value) {
    const parsed =
        cvmParseMonthYear(
            value
        );

    if (!parsed) {
        return "";
    }

    return (
        `${parsed.year}-`
        + cvmPadMonth(
            parsed.month
        )
    );
}

function cvmStoredMonthYear(value) {
    const match =
        String(
            value || ""
        )
            .trim()
            .match(
                /^(\d{4})-(\d{2})$/
            );

    if (!match) {
        return "";
    }

    return (
        `${match[2]}/${match[1]}`
    );
}

function cvmCanonicalMonthYear(value) {
    const parsed =
        cvmParseMonthYear(
            value
        );

    if (!parsed) {
        return String(
            value || ""
        ).trim();
    }

    return (
        `${cvmPadMonth(
            parsed.month
        )}/${parsed.year}`
    );
}

function cvmNormalizeProjectDates(project) {
    if (!project) {
        return;
    }

    const groups = [
        project.experiences || [],
        project.education || [],
        project.volunteering || [],
    ];

    for (
        const collection
        of groups
    ) {
        for (
            const item
            of collection
        ) {
            if (
                item.start_date
            ) {
                item.start_date =
                    cvmCanonicalMonthYear(
                        item.start_date
                    );
            }

            if (
                item.end_date
            ) {
                item.end_date =
                    cvmCanonicalMonthYear(
                        item.end_date
                    );
            }
        }
    }
}


// ===========================================================
// NORMALIZE OLD PROJECTS WHEN OPENED
// ===========================================================

if (
    typeof loadProjectIntoUI
    === "function"
) {
    const cvmEntryBaseLoadProjectIntoUI =
        loadProjectIntoUI;

    loadProjectIntoUI =
        function (project) {

            cvmNormalizeProjectDates(
                project
            );

            return cvmEntryBaseLoadProjectIntoUI(
                project
            );
        };
}


// ===========================================================
// START / END DATE FIELDS
// ===========================================================

if (
    typeof field
    === "function"
) {
    const cvmEntryBaseField =
        field;

    field =
        function (
            label,
            collection,
            index,
            key,
            value = "",
            options = {}
        ) {

            if (
                key === "start_date"
                || key === "end_date"
            ) {

                const full =
                    options.full
                        ? "full"
                        : "";

                return `
                    <label
                        class="field ${full} cvm-month-field"
                    >

                        <span>

                            ${escapeHtml(
                                label
                            )}

                            <small
                                class="cvm-field-hint"
                            >
                                ${escapeHtml(
                                    cvmEntryText(
                                        "monthHint"
                                    )
                                )}
                            </small>

                        </span>


                        <input
                            type="month"

                            value="${escapeHtml(
                                cvmMonthInputValue(
                                    value
                                )
                            )}"

                            data-collection="${collection}"
                            data-index="${index}"
                            data-key="${key}"
                            data-value-type="month"
                        >

                    </label>
                `;
            }


            return cvmEntryBaseField(
                label,
                collection,
                index,
                key,
                value,
                options
            );
        };
}


// ===========================================================
// SAVE MONTH PICKER AS MM/YYYY
// ===========================================================

if (
    typeof handleDynamicInput
    === "function"
) {
    const cvmEntryBaseHandleDynamicInput =
        handleDynamicInput;

    handleDynamicInput =
        function (target) {

            if (
                target?.dataset
                    ?.valueType
                === "month"
            ) {

                if (
                    !state.project
                ) {
                    return;
                }


                const collection =
                    target.dataset
                        .collection;

                const index =
                    Number(
                        target.dataset
                            .index
                    );

                const key =
                    target.dataset.key;


                const item =
                    state.project
                        ?.[collection]
                        ?.[index];


                if (
                    !item
                    || !key
                    || Number.isNaN(
                        index
                    )
                ) {
                    return;
                }


                item[key] =
                    cvmStoredMonthYear(
                        target.value
                    );


                projectChanged();

                return;
            }


            return cvmEntryBaseHandleDynamicInput(
                target
            );
        };
}


// ===========================================================
// SKILLS — ENTER TO ADD
// ===========================================================

function cvmSkillInputHtml(
    item,
    index
) {

    const chips =
        (
            item.items
            || []
        )
            .map(
                (
                    skill,
                    skillIndex
                ) => `

                    <span
                        class="cvm-skill-chip"
                    >

                        <span>
                            ${escapeHtml(
                                skill
                            )}
                        </span>


                        <button
                            type="button"

                            data-cvm-remove-skill

                            data-index="${index}"

                            data-skill-index="${skillIndex}"

                            title="Remove"

                            aria-label="Remove ${escapeHtml(
                                skill
                            )}"
                        >
                            ×
                        </button>

                    </span>
                `
            )
            .join("");


    return `
        <label
            class="field full cvm-skill-field"
        >

            <span>

                ${escapeHtml(
                    cvmEntryLanguage()
                    === "fr"
                        ? "Compétences"
                        : "Skills"
                )}

                <small
                    class="cvm-field-hint"
                >
                    ${escapeHtml(
                        cvmEntryText(
                            "skillHint"
                        )
                    )}
                </small>

            </span>


            <div
                class="cvm-skill-editor"
            >

                <div
                    class="cvm-skill-chips"
                >
                    ${chips}
                </div>


                <div
                    class="cvm-skill-input-wrap"
                >

                    <input
                        type="text"

                        class="cvm-skill-input"

                        data-cvm-skill-input

                        data-index="${index}"

                        placeholder="${escapeHtml(
                            cvmEntryText(
                                "skillPlaceholder"
                            )
                        )}"

                        autocomplete="off"
                    >

                </div>

            </div>

        </label>
    `;
}


renderSkills =
    function () {

        const container =
            document.querySelector(
                "#skillsContainer"
            );


        if (
            !container
            || !state.project
        ) {
            return;
        }


        state.project.skills ||=
            [];


        container.innerHTML =
            state.project.skills
                .map(
                    (
                        item,
                        index
                    ) => {

                        item.items ||=
                            [];


                        return dynamicCard(

                            item.name
                            || `Skill group ${index + 1}`,

                            "skills",

                            index,

                            field(
                                "Group name",
                                "skills",
                                index,
                                "name",
                                item.name
                            )

                            +

                            cvmSkillInputHtml(
                                item,
                                index
                            )
                        );
                    }
                )
                .join("");
    };


function cvmAddSkillsFromInput(
    input
) {

    if (
        !state.project
    ) {
        return;
    }


    const index =
        Number(
            input.dataset.index
        );


    const group =
        state.project.skills
            ?.[index];


    if (
        !group
        || Number.isNaN(
            index
        )
    ) {
        return;
    }


    const candidates =
        String(
            input.value
            || ""
        )
            .split(
                /[;,]+/
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


    if (
        !candidates.length
    ) {
        return;
    }


    group.items ||=
        [];


    const existing =
        new Set(
            group.items.map(
                (
                    value
                ) =>
                    String(
                        value
                    ).toLowerCase()
            )
        );


    for (
        const skill
        of candidates
    ) {

        const key =
            skill.toLowerCase();


        if (
            !existing.has(
                key
            )
        ) {
            group.items.push(
                skill
            );

            existing.add(
                key
            );
        }
    }


    input.value =
        "";


    renderDynamicSections();

    projectChanged();


    window.setTimeout(
        () => {

            document.querySelector(
                `[data-cvm-skill-input][data-index="${index}"]`
            )?.focus();

        },
        0
    );
}


// ===========================================================
// LANGUAGES — A1 → C2 DROPDOWN
// ===========================================================

renderLanguages =
    function () {

        const container =
            document.querySelector(
                "#languagesContainer"
            );


        if (
            !container
            || !state.project
        ) {
            return;
        }


        container.innerHTML =
            state.project.languages
                .map(
                    (
                        item,
                        index
                    ) => {

                        const options = [

                            `
                                <option value="">
                                    ${escapeHtml(
                                        cvmEntryText(
                                            "selectLevel"
                                        )
                                    )}
                                </option>
                            `,

                            ...CVM_CEFR_LEVELS.map(
                                (
                                    level
                                ) => `

                                    <option
                                        value="${level}"

                                        ${
                                            item.level
                                            === level
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${level}
                                    </option>
                                `
                            ),

                        ].join("");


                        const body =

                            field(
                                "Language",
                                "languages",
                                index,
                                "name",
                                item.name
                            )

                            +

                            `
                                <label
                                    class="field cvm-language-field"
                                >

                                    <span>
                                        ${escapeHtml(
                                            cvmEntryLanguage()
                                            === "fr"
                                                ? "Niveau"
                                                : "Level"
                                        )}
                                    </span>


                                    <select
                                        class="cvm-language-level-select"

                                        data-collection="languages"

                                        data-index="${index}"

                                        data-key="level"

                                        data-value-type="text"
                                    >
                                        ${options}
                                    </select>

                                </label>
                            `;


                        return dynamicCard(

                            item.name
                            || `Language ${index + 1}`,

                            "languages",

                            index,

                            body
                        );
                    }
                )
                .join("");
    };


// ===========================================================
// SKILL EVENTS
// ===========================================================

document.addEventListener(
    "keydown",
    (
        event
    ) => {

        const input =
            event.target
                .closest?.(
                    "[data-cvm-skill-input]"
                );


        if (
            !input
        ) {
            return;
        }


        if (
            event.key
            === "Enter"
        ) {

            event.preventDefault();

            cvmAddSkillsFromInput(
                input
            );

            return;
        }


        if (
            event.key
            === "Backspace"

            && !input.value
        ) {

            const index =
                Number(
                    input.dataset.index
                );


            const group =
                state.project
                    ?.skills
                    ?.[index];


            if (
                group
                    ?.items
                    ?.length
            ) {

                event.preventDefault();


                group.items.pop();


                renderDynamicSections();

                projectChanged();


                window.setTimeout(
                    () => {

                        document.querySelector(
                            `[data-cvm-skill-input][data-index="${index}"]`
                        )?.focus();

                    },
                    0
                );
            }
        }
    }
);


document.addEventListener(
    "click",
    (
        event
    ) => {

        const button =
            event.target
                .closest?.(
                    "[data-cvm-remove-skill]"
                );


        if (
            !button
        ) {
            return;
        }


        const index =
            Number(
                button.dataset.index
            );


        const skillIndex =
            Number(
                button.dataset
                    .skillIndex
            );


        const group =
            state.project
                ?.skills
                ?.[index];


        if (
            !group

            || Number.isNaN(
                index
            )

            || Number.isNaN(
                skillIndex
            )
        ) {
            return;
        }


        group.items.splice(
            skillIndex,
            1
        );


        renderDynamicSections();

        projectChanged();
    }
);


// ===========================================================
// INITIAL REFRESH
// ===========================================================

function cvmRefreshStructuredControls() {

    if (
        !state?.project
    ) {
        return;
    }


    cvmNormalizeProjectDates(
        state.project
    );


    renderDynamicSections();

    renderPreview();
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        window.setTimeout(
            cvmRefreshStructuredControls,
            0
        );
    }
);
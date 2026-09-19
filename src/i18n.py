from __future__ import annotations


def normalize_language(value: str | None) -> str:
    return "fr" if str(value or "").lower().startswith("fr") else "en"


STRINGS = {
    "en": {
        "profile": "PROFILE",
        "experience": "PROFESSIONAL EXPERIENCE",
        "education": "EDUCATION",
        "projects": "PROJECTS",
        "volunteering": "VOLUNTEERING",
        "skills": "TECHNICAL SKILLS",
        "languages": "LANGUAGES",
        "certifications": "CERTIFICATIONS",
        "present": "Present",
        "tools": "Tools",
        "project_link": "Project link",
        "strong": "Strong",
        "good": "Good",
        "needs_review": "Needs review",
        "needs_work": "Needs work",
        "ats_note": (
            "CVM performs a local ATS-readiness audit of content, structure and the generated PDF text layer. "
            "It is not a score from Workday, Taleo, Greenhouse, SuccessFactors or any other employer ATS."
        ),
        "job_note": (
            "CVM compares the job description with text that already exists in your CV. "
            "A missing term is not permission to invent experience or skills; add it only when it is genuinely true."
        ),
    },
    "fr": {
        "profile": "PROFIL",
        "experience": "EXPÉRIENCE PROFESSIONNELLE",
        "education": "FORMATION",
        "projects": "PROJETS",
        "volunteering": "BÉNÉVOLAT / VIE ASSOCIATIVE",
        "skills": "COMPÉTENCES TECHNIQUES",
        "languages": "LANGUES",
        "certifications": "CERTIFICATIONS",
        "present": "Présent",
        "tools": "Outils",
        "project_link": "Lien du projet",
        "strong": "Très solide",
        "good": "Bon",
        "needs_review": "À revoir",
        "needs_work": "À améliorer",
        "ats_note": (
            "CVM effectue localement un audit de compatibilité ATS portant sur le contenu, la structure et la couche texte du PDF généré. "
            "Ce score ne provient pas de Workday, Taleo, Greenhouse, SuccessFactors ni d'un autre ATS employeur."
        ),
        "job_note": (
            "CVM compare l'offre d'emploi avec le texte déjà présent dans votre CV. "
            "Un terme manquant ne justifie jamais d'inventer une expérience ou une compétence ; ajoutez-le uniquement s'il est réellement vrai."
        ),
    },
}


def tr(language: str | None, key: str) -> str:
    lang = normalize_language(language)
    return STRINGS.get(lang, STRINGS["en"]).get(key, STRINGS["en"].get(key, key))

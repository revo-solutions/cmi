namespace RevoSolutions.CMI.Domain.Enumerators;

// Stored as these codes so the list can grow without breaking analysis; the app owns the display text.
public static class HealthCondition
{
    public const string Other = "outra";

    public const string None = "nenhuma";

    public static readonly IReadOnlySet<string> Codes = new HashSet<string>(StringComparer.Ordinal)
    {
        "hipertensao",
        "diabetes",
        "colesterol",
        "coracao",
        "artrose_artrite",
        "osteoporose",
        "tireoide",
        "depressao_ansiedade",
        "memoria",
        "asma_bronquite",
        "avc",
        "rins",
        Other,
        None,
    };
}

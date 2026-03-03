export const COLORS = {
    bg: "#0A0E17",
    card: "#111827",
    cardHover: "#1A2332",
    border: "#1E293B",
    lime: "#84CC16",
    limeDark: "#65A30D",
    limeGlow: "rgba(132, 204, 22, 0.15)",
    blue: "#3B82F6",
    purple: "#A855F7",
    orange: "#F97316",
    pink: "#EC4899",
    cyan: "#06B6D4",
    text: "#F1F5F9",
    textMuted: "#94A3B8",
    textDim: "#64748B",
    success: "#22C55E",
    warning: "#EAB308",
    danger: "#EF4444",
};

export const UI_STYLES = {
    card: {
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "12px",
        transition: "all 0.2s ease-in-out",
    },
    glass: {
        background: "rgba(17, 24, 39, 0.7)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${COLORS.border}`,
    },
    buttonPrimary: {
        background: COLORS.lime,
        color: COLORS.bg,
        fontWeight: "700",
        borderRadius: "12px",
        padding: "12px 24px",
        transition: "transform 0.1s active",
    }
};

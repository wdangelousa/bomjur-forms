export const COLORS = {
    bg: "#f8fafc",
    card: "#ffffff",
    cardHover: "#f1f5f9",
    border: "#e2e8f0",
    primary: "#0ea5e9",
    primaryDark: "#0284c7",
    primaryGlow: "rgba(14, 165, 233, 0.15)",
    blue: "#3B82F6",
    purple: "#A855F7",
    orange: "#F97316",
    pink: "#EC4899",
    cyan: "#06B6D4",
    text: "#0f172a",
    textMuted: "#475569",
    textDim: "#64748b",
    success: "#10b981",
    warning: "#EAB308",
    danger: "#ef4444",
    accent: "#f97316",
};

export const UI_STYLES = {
    card: {
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "12px",
        transition: "all 0.2s ease-in-out",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    },
    glass: {
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${COLORS.border}`,
    },
    buttonPrimary: {
        background: COLORS.primary,
        color: "#ffffff",
        fontWeight: "700",
        borderRadius: "12px",
        padding: "12px 24px",
        transition: "transform 0.1s active",
    }
};

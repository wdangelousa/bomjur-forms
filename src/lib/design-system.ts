export const COLORS = {
    bg: "#F9FAFB",
    card: "#FFFFFF",
    cardHover: "#F3F4F6",
    border: "#F3F4F6",
    primary: "#6366F1",
    primaryDark: "#4F46E5",
    primaryGlow: "rgba(99, 102, 241, 0.15)",
    course: "#38BDF8",
    page: "#F97316",
    quiz: "#FBBF24",
    assignment: "#818CF8",
    learningPath: "#DB2777",
    wiki: "#10B981",
    text: "#111827",
    textMuted: "#4B5563",
    textDim: "#9CA3AF",
    success: "#10b981",
    warning: "#FBBF24",
    danger: "#ef4444",
    accent: "#F97316",
};

export const UI_STYLES = {
    card: {
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "16px",
        transition: "all 0.2s ease-in-out",
        boxShadow: "0 4px 24px -4px rgba(0, 0, 0, 0.05)",
    },
    glass: {
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${COLORS.border}`,
    },
    buttonPrimary: {
        background: COLORS.primary,
        color: "#ffffff",
        fontWeight: "600",
        borderRadius: "12px",
        padding: "12px 24px",
        transition: "transform 0.1s active",
    }
};

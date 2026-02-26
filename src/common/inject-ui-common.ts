import React, { useEffect } from "react";

export function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (!ref.current) return;
            if (e.target instanceof Node && !ref.current.contains(e.target)) {
                onOutside();
            }
        };
        document.addEventListener("click", onClickOutside);
        return () => document.removeEventListener("click", onClickOutside);
    }, [ref, onOutside]);
}

export const baseMenuStyle: React.CSSProperties = {
    position: "absolute",
    top: "36px",
    left: 0,
    background: "#fff",
    color: "#111",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 9999999,
    padding: "6px"
};

export const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "4px 2px"
};

export const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#374151"
};

export const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid rgba(17,24,39,0.22)",
    padding: "13px 14px",
    fontSize: 15
};

interface CopyTextProps {
    text: string
}

/**
 * Copy text, use navigator.clipboard
 *
 * @param param0
 * param0.text Text to copy
 * @returns a Promise that resolves when the text is copied to the clipboard, so the user can paste it
 */
export default async function copyText({
    text,
}: CopyTextProps) {

    if (!navigator) return

    return navigator.clipboard.writeText(text)
}
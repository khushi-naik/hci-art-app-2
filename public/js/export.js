// Export PNG
const exportBoardAsPNG = () => {
    const ext = "png"
    const base64 = canvas.toDataURL({
        format: ext,
        enableRetinaScaling: true
    })
    const link = document.createElement("a")
    link.href = base64
    link.download = `list.${ext}`
    link.click()
}

// Export SVG
const downloadSVG = () => {
    const svg = canvas.toSVG()
    const a = document.createElement("a")
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const blobURL = URL.createObjectURL(blob)
    a.href = blobURL
    a.download = "list.svg"
    a.click()
    URL.revokeObjectURL(blobURL)
}
// Minimal retained utility after removing legacy pdfService
// Provides a simple browser download helper for already-generated Blobs.
export function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } finally {
        URL.revokeObjectURL(url);
    }
}

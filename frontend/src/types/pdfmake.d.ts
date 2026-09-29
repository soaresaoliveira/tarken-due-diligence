declare module 'pdfmake/build/pdfmake.js' {
  type PdfMakeOutput = {
    getBlob: () => Promise<Blob>
  }

  type PdfMakeApi = {
    addVirtualFileSystem: (files: Record<string, string>) => void
    createPdf: (definition: object) => PdfMakeOutput
  }

  const pdfMake: PdfMakeApi
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts.js' {
  const virtualFonts: Record<string, string>
  export default virtualFonts
}
OFFLINE SLIP READER FILES (Tesseract.js 5.1.1, Apache-2.0 licence)
Upload this whole "ocr" folder next to index.html so that the
website reads slips from its own files instead of downloading
them from the internet.

Expected layout in the repository:
  index.html
  ocr/tesseract.min.js
  ocr/worker.min.js
  ocr/tesseract-core-simd-lstm.wasm.js
  ocr/tesseract-core-lstm.wasm.js
  ocr/eng.traineddata.gz

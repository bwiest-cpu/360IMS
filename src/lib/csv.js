import Papa from 'papaparse'

export function exportToCsv(filename, rows, columns) {
  const data = rows.map((row) => {
    const out = {}
    for (const col of columns) {
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]
      out[col.header] = val ?? ''
    }
    return out
  })
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject
    })
  })
}

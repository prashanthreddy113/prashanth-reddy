/**
 * Shrinks a photo on the phone before upload: full size max 1280px (JPEG 0.82) and a 320px thumbnail.
 * A 4 MB camera photo becomes ~150–300 KB, which keeps uploads fast on mobile data.
 */
async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

function draw(bitmap, maxSize, quality) {
  const w = bitmap.width, h = bitmap.height
  const scale = Math.min(1, maxSize / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function compressImage(file, { maxSize = 1280, quality = 0.82, thumbSize = 320 } = {}) {
  const bitmap = await loadBitmap(file)
  const full = draw(bitmap, maxSize, quality)
  const thumb = draw(bitmap, thumbSize, 0.7)
  if (bitmap.close) bitmap.close()
  return {
    contentType: 'image/jpeg',
    dataBase64: full.split(',')[1],
    thumbBase64: thumb.split(',')[1],
    preview: thumb,
    size: Math.round((full.length * 3) / 4),
  }
}

/** Logos keep their original format (PNG/SVG transparency) when small enough; large ones are resized. */
export async function prepareLogo(file) {
  if (file.size <= 400 * 1024 && ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'].includes(file.type)) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => reject(new Error('Could not read file'))
      r.readAsDataURL(file)
    })
    return { contentType: file.type, dataBase64: dataUrl.split(',')[1], preview: dataUrl }
  }
  const bitmap = await loadBitmap(file)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/png')
  return { contentType: 'image/png', dataBase64: dataUrl.split(',')[1], preview: dataUrl }
}

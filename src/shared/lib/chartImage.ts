/**
 * Draws an SVG chart (Recharts) on a canvas and returns a PNG data URI for reports.
 * Returns null where canvas drawing is unavailable (tests, very old browsers) or the image fails to load.
 */
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string | null> {
  const box = svg.getBoundingClientRect();
  const width = Math.round(box.width || Number(svg.getAttribute('width')) || 0);
  const height = Math.round(box.height || Number(svg.getAttribute('height')) || 0);
  if (width <= 0 || height <= 0) {
    return null;
  }

  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  // Text of the chart inherits the page font; an image rendered from the SVG does not.
  copy.setAttribute('font-family', getComputedStyle(svg).fontFamily || 'Segoe UI, Arial, sans-serif');

  const source = new XMLSerializer().serializeToString(copy);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Изображение графика не загружено.'));
      element.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

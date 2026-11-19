import {jsPDF} from 'jspdf';

const palette = {navy:'#121C4E', blue:'#1F43E0', yellow:'#FFC72C', red:'#E3263F', ink:'#2B3253', muted:'#5D6485', pale:'#EEF2FF', line:'#DFE5F5'};
const text = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\u2010-\u2015]/g, '-').replace(/\u2026/g, '...').trim();

export function collectApplication(form, now = new Date()) {
  const submitted = new FormData(form);
  const sections = [...form.querySelectorAll(':scope > fieldset')].map(fieldset => {
    const legend = fieldset.querySelector('legend').cloneNode(true);
    legend.querySelectorAll('.form-section__num, .hint').forEach(node => node.remove());
    const seen = new Set();
    const fields = [...fieldset.querySelectorAll('input, textarea, select')].flatMap(input => {
      if (!input.name || input.name.startsWith('_') || input.type === 'hidden' || seen.has(input.name)) return [];
      seen.add(input.name);
      const group = input.closest('.fields')?.previousElementSibling;
      const label = input.type === 'radio' ? input.name : input.labels?.[0]?.textContent || input.closest('.field')?.querySelector('.field__label')?.textContent || input.name;
      let value = submitted.getAll(input.name).map(text).filter(Boolean).join(', ');
      if (input.type === 'checkbox') value = input.checked ? 'Confirmed' : 'Not confirmed';
      if (input.type === 'date' && value) {
        value = new Intl.DateTimeFormat('en-ZA', {day:'numeric', month:'long', year:'numeric', timeZone:'Africa/Johannesburg'}).format(new Date(`${value}T12:00:00Z`));
      }
      return [{label:text(label).replace(/\s*\*\s*$/, ''), value:value || 'Not provided', group:group?.matches('h3') ? text(group.textContent) : ''}];
    });
    return {title:text(legend.textContent), fields};
  });
  const agreements = [...form.querySelectorAll('.terms details')].map(details => {
    const copy = details.cloneNode(true);
    const title = text(copy.querySelector('summary')?.textContent);
    copy.querySelector('summary')?.remove();
    return {title, paragraphs:[...copy.children].map(node => text(node.textContent).replace(/\s+/g, ' ')).filter(Boolean)};
  });
  for (const list of form.querySelectorAll('.terms-list')) {
    agreements.push({title:'Aftercare terms', paragraphs:[...list.children].map(node => text(node.textContent))});
  }
  const isAftercare = submitted.get('Form') === 'Aftercare agreement';
  return {
    title:isAftercare ? 'Aftercare application' : 'School application',
    learner:text(submitted.get('Learner - Full names') ? `${submitted.get('Learner - Full names')} ${submitted.get('Learner - Surname') || ''}` : submitted.get('Child 1 - Full name')),
    createdAt:now.toISOString(), sections, agreements,
  };
}

export function createApplicationPdf(application, fonts) {
  const doc = new jsPDF({unit:'mm', format:'a4', compress:true});
  doc.addFileToVFS('Lato-Regular.ttf', fonts.regular);
  doc.addFileToVFS('Lato-Bold.ttf', fonts.bold);
  doc.addFont('Lato-Regular.ttf', 'Lato', 'normal');
  doc.addFont('Lato-Bold.ttf', 'Lato', 'bold');
  doc.setProperties({title:`${application.title} - Ausome Learning Minds`, author:'Ausome Learning Minds', subject:'Completed application copy'});
  const margin = 18;
  const width = 174;
  const bottom = 272;
  let y = 0;
  let sectionTitle = '';
  const font = (size = 10, style = 'normal', colour = palette.ink) => {
    doc.setFont('Lato', style); doc.setFontSize(size); doc.setTextColor(colour);
  };
  const pageHeader = first => {
    doc.setFillColor(palette.blue); doc.rect(0, 0, 210, first ? 58 : 29, 'F');
    doc.setFillColor(palette.yellow); doc.circle(185, first ? 15 : 12, first ? 17 : 10, 'F');
    doc.setFillColor(palette.red); doc.roundedRect(193, first ? 32 : 5, 13, 13, 2, 2, 'F');
    font(first ? 20 : 13, 'bold', '#FFFFFF');
    doc.text('Ausome Learning Minds', margin, first ? 18 : 13);
    font(9, 'normal', '#FFFFFF'); doc.text('Play. Explore. Learn.', margin, first ? 25 : 20);
    if (first) {
      font(23, 'bold', '#FFFFFF'); doc.text(text(application.title), margin, 42);
      font(10, 'normal', '#FFFFFF'); doc.text('Completed application copy', margin, 50);
      y = 68;
      font(8, 'bold', palette.muted); doc.text('LEARNER', margin, y);
      font(13, 'bold');
      const learnerLines = doc.splitTextToSize(text(application.learner) || 'Application record', 105);
      doc.text(learnerLines, margin, y + 7);
      font(8, 'bold', palette.muted); doc.text('SUBMITTED', 137, y);
      font(10); doc.text(new Intl.DateTimeFormat('en-ZA', {dateStyle:'medium', timeZone:'Africa/Johannesburg'}).format(new Date(application.createdAt)), 137, y + 7);
      y += Math.max(22, learnerLines.length * 6 + 14);
      font(9, 'normal', palette.muted);
      doc.text('Application received for review. This copy does not confirm placement.', margin, y);
      y += 11;
      if (application.reference) {
        font(8,'bold',palette.blue); doc.text(`Reference: ${text(application.reference)}`,margin,y); y += 9;
      }
    } else y = 39;
  };
  const ensure = height => {
    if (y + height <= bottom) return;
    doc.addPage(); pageHeader(false);
    if (sectionTitle) {
      font(9, 'bold', palette.blue); doc.text(`${sectionTitle} (continued)`, margin, y); y += 9;
    }
  };
  const heading = (title, number) => {
    sectionTitle = '';
    ensure(25);
    sectionTitle = text(title);
    doc.setFillColor(palette.pale); doc.roundedRect(margin, y, width, 13, 2, 2, 'F');
    doc.setFillColor(palette.yellow); doc.circle(margin + 6.5, y + 6.5, 4.2, 'F');
    font(9, 'bold', palette.navy); doc.text(String(number).padStart(2,'0'), margin + 6.5, y + 7.7, {align:'center'});
    font(11, 'bold', palette.navy);
    doc.text(text(title), margin + 14, y + 8.2);
    y += 21;
  };
  pageHeader(true);
  application.sections.forEach((section, index) => {
    heading(section.title, index + 1);
    let lastGroup = '';
    section.fields.forEach(field => {
      if (field.group && field.group !== lastGroup) {
        ensure(19); font(10, 'bold', palette.blue);
        const lines = doc.splitTextToSize(text(field.group), width);
        doc.text(lines, margin, y); y += lines.length * 5 + 5;
        lastGroup = field.group;
      }
      font(8.5, 'bold', palette.muted);
      const labels = doc.splitTextToSize(text(field.label), 59);
      font(10);
      const values = doc.splitTextToSize(text(field.value), 106);
      let offset = 0;
      // Split long responses across pages, repeating their label on each continuation.
      while (offset < values.length) {
        ensure(Math.max(labels.length * 4.2, 5) + 6);
        const available = Math.max(1, Math.floor((bottom - y - 5) / 5));
        const chunk = values.slice(offset, offset + available);
        font(8.5, 'bold', palette.muted); doc.text(labels, margin, y);
        font(10, 'normal', field.value === 'Not provided' ? palette.muted : palette.ink);
        doc.text(chunk, margin + 66, y);
        const height = Math.max(labels.length * 4.2, chunk.length * 5);
        y += height + 4;
        doc.setDrawColor(palette.line); doc.line(margin, y - 2, margin + width, y - 2);
        y += 3; offset += chunk.length;
        if (offset < values.length) {y = bottom; ensure(10);}
      }
    });
    y += 5;
  });
  if (application.agreements.length) {
    sectionTitle = ''; doc.addPage(); pageHeader(false);
    heading('Declarations and terms', application.sections.length + 1);
    font(9, 'normal', palette.muted);
    doc.text('A copy of the terms displayed with this application.', margin, y); y += 10;
    for (const agreement of application.agreements) {
      ensure(20); font(11, 'bold', palette.blue);
      const title = doc.splitTextToSize(text(agreement.title), width);
      doc.text(title, margin, y); y += title.length * 5 + 4;
      for (const paragraph of agreement.paragraphs) {
        font(9);
        const lines = doc.splitTextToSize(text(paragraph), width);
        for (const line of lines) {ensure(5); font(9); doc.text(line, margin, y); y += 4.7;}
        y += 4;
      }
      y += 3;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(palette.line); doc.line(margin, 280, 192, 280);
    font(8, 'bold', palette.navy); doc.text('Ausome Learning Minds', margin, 286);
    font(7.5, 'normal', palette.muted);
    doc.text('064 909 7710 / 064 510 9728', margin, 291);
    doc.text('17 Toinette St, Brackenhurst, Alberton', 92, 291);
    doc.text(`Page ${page} of ${pages}`, 192, 286, {align:'right'});
    doc.text('Personal information - keep this copy private', 192, 276.5, {align:'right'});
  }
  return doc;
}

let fontPromise;
export function loadPdfFonts() {
  fontPromise ||= Promise.all([
    new URL('../fonts/Lato-Regular.ttf', import.meta.url), new URL('../fonts/Lato-Bold.ttf', import.meta.url),
  ].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF fonts could not load.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })).then(([regular, bold]) => ({regular, bold})).catch(error => {fontPromise = null; throw error;});
  return fontPromise;
}

export async function downloadApplicationPdf(application) {
  const fonts = await loadPdfFonts();
  const doc = createApplicationPdf(application, fonts);
  const name = text(application.learner).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g,'').slice(0,60) || 'learner';
  doc.save(`Ausome-${application.title.replaceAll(' ', '-')}-${name}.pdf`);
}

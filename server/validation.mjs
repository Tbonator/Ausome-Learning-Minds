import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const definitions = JSON.parse(fs.readFileSync(new URL('./form-definitions.json',import.meta.url),'utf8'));
export class ValidationError extends Error {
  constructor(fields) {super('Please check the highlighted application details.'); this.fields = fields; this.status = 422;}
}

export function validateApplication(kind, body, now = new Date()) {
  const definition = definitions[kind];
  if (!definition) throw Object.assign(new Error('Application type not found.'),{status:404});
  if (body['Terms version'] !== definition.version) throw Object.assign(new Error('This application form has changed. Refresh the page and review the current terms before submitting.'),{status:409});
  const errors = {};
  const values = {};
  for (const field of definition.sections.flatMap(section => section.fields)) {
    const raw = body[field.name] ?? '';
    if (typeof raw !== 'string') {errors[field.name] = 'Provide one value.'; continue;}
    const value = raw.trim();
    values[field.name] = value;
    if (field.required && !value) {errors[field.name] = 'This field is required.'; continue;}
    if (!value) continue;
    if (value.length > field.maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) errors[field.name] = 'This value is too long or contains unsupported characters.';
    else if (field.options && !field.options.includes(value)) errors[field.name] = 'Choose an available option.';
    else if (field.type === 'checkbox' && value !== field.checkedValue) errors[field.name] = 'Please confirm this declaration.';
    else if (field.pattern && !new RegExp(`^(?:${field.pattern})$`).test(value)) errors[field.name] = 'Please check the format.';
    else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.name] = 'Enter a valid email address.';
    else if (field.type === 'date') {
      const date = new Date(`${value}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) errors[field.name] = 'Enter a valid date.';
      else if (field.name.includes('Date of birth') && date > now) errors[field.name] = 'Date of birth must not be in the future.';
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const sections = definition.sections.map(section => ({title:section.title,fields:section.fields.map(field => {
    let value = values[field.name];
    if (field.type === 'checkbox') value = value ? 'Confirmed' : 'Not confirmed';
    else if (field.type === 'date' && value) value = new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Johannesburg'}).format(new Date(`${value}T12:00:00Z`));
    return {label:field.label,group:field.group,value:value || 'Not provided'};
  })}));
  return {
    title:definition.title,
    learner:kind === 'school' ? `${values['Learner - Full names']} ${values['Learner - Surname']}`.trim() : values['Child 1 - Full name'],
    createdAt:now.toISOString(), sections, agreements:definition.agreements, schemaVersion:definition.version,
    // Used only for duplicate protection; routing fields and submitted HTML are never trusted.
    fingerprint:createHash('sha256').update(JSON.stringify({kind,values,version:definition.version})).digest('hex'),
  };
}

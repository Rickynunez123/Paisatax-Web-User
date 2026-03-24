/**
 * paisatax-web-user/src/lib/onboarding-constants.ts
 *
 * Shared constants and helpers for the in-chat onboarding flow.
 */

// ─── Filing ─────────────────────────────────────────────────────────────────

export const FILING_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
  { value: 'married_filing_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'qualifying_surviving_spouse', label: 'Qualifying Surviving Spouse' },
] as const;

export const TAX_YEARS = ['2025', '2024', '2023'] as const;

// ─── Profiles ───────────────────────────────────────────────────────────────

export const PROFILES = [
  { id: 'employee', label: 'Employee', description: 'W-2 income from an employer' },
  { id: 'self_employed', label: 'Self-Employed / Freelancer', description: '1099-NEC, Schedule C' },
  { id: 'investor', label: 'Investor', description: 'Interest, dividends, stock sales' },
  { id: 'student', label: 'Student', description: 'Tuition, student loans' },
  { id: 'family', label: 'Family with Dependents', description: 'Child Tax Credit, EITC, childcare' },
  { id: 'hsa_retirement', label: 'HSA / Retirement', description: 'HSA, 1099-R, Social Security' },
  { id: 'rental_farm', label: 'Rental / Farm', description: 'Rental property, farm, partnerships' },
  { id: 'energy_credits', label: 'Energy Credits', description: 'Solar, EV, home improvements' },
  { id: 'itemized', label: 'Itemizing Deductions', description: 'Mortgage, state taxes, charity' },
  { id: 'household_employer', label: 'Household Employer', description: 'Nanny, housekeeper tax' },
] as const;

// ─── Identity Fields ────────────────────────────────────────────────────────

export const IDENTITY_FIELDS = [
  { key: 'firstName', label: 'First Name', placeholder: '' },
  { key: 'lastName', label: 'Last Name', placeholder: '' },
  { key: 'ssn', label: 'SSN', placeholder: '', type: 'password' as const },
  { key: 'birthday', label: 'Date of Birth', placeholder: 'YYYY-MM-DD' },
  { key: 'phoneNumber', label: 'Phone', placeholder: '' },
  { key: 'street', label: 'Street', placeholder: '' },
  { key: 'apt', label: 'Apt / Suite', placeholder: '' },
  { key: 'city', label: 'City', placeholder: '' },
  { key: 'state', label: 'State', placeholder: '' },
  { key: 'zip', label: 'ZIP', placeholder: '' },
] as const;

/** Spouse fields — no address (shared with primary for joint filing). */
export const SPOUSE_FIELDS = [
  { key: 'firstName', label: 'First Name', placeholder: '' },
  { key: 'lastName', label: 'Last Name', placeholder: '' },
  { key: 'ssn', label: 'SSN', placeholder: '', type: 'password' as const },
  { key: 'birthday', label: 'Date of Birth', placeholder: 'YYYY-MM-DD' },
  { key: 'phoneNumber', label: 'Phone', placeholder: '' },
] as const;

export const DEPENDENT_FIELDS = [
  { key: 'firstName', label: 'First Name', placeholder: '' },
  { key: 'lastName', label: 'Last Name', placeholder: '' },
  { key: 'ssn', label: 'SSN', placeholder: '', type: 'password' as const },
  { key: 'birthday', label: 'Date of Birth', placeholder: 'YYYY-MM-DD' },
  { key: 'relationship', label: 'Relationship', placeholder: '' },
] as const;

export const RELATIONSHIP_OPTIONS = [
  'Son', 'Daughter', 'Stepchild', 'Foster child', 'Sibling', 'Parent', 'Other',
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map a UserTable record to our identity field keys. */
export function userRecordToIdentity(record: Record<string, any>): Record<string, string> {
  return {
    firstName: record.firstName ?? record.name?.split(' ')[0] ?? '',
    lastName: record.lastName ?? record.name?.split(' ').slice(1).join(' ') ?? '',
    ssn: record.ssn ?? '',
    birthday: record.birthday ?? record.dob ?? '',
    phoneNumber: record.phoneNumber ?? record.phone ?? '',
    street: record.street ?? record.address?.street ?? '',
    apt: record.apt ?? record.address?.apt ?? '',
    city: record.city ?? record.address?.city ?? '',
    state: record.state ?? record.address?.state ?? '',
    zip: record.zip ?? record.address?.zip ?? '',
  };
}

/** Determine if a filing status implies a spouse. */
export function statusHasSpouse(status: string): boolean {
  return status === 'married_filing_jointly' || status === 'married_filing_separately';
}

// ─── Skills extraction helpers ──────────────────────────────────────────────

/** Extract profile IDs from skill markdown content. */
export function extractProfilesFromSkills(
  skills: { name: string; content: string }[],
): Set<string> {
  const profiles = new Set<string>();
  const allContent = skills.map((s) => s.content.toLowerCase()).join('\n');

  if (/w-?2|employer|wages/.test(allContent)) profiles.add('employee');
  if (/1099-nec|self.?employ|freelanc|schedule\s?c|independent\s?contractor/.test(allContent)) profiles.add('self_employed');
  if (/invest|dividend|1099-div|1099-int|capital\s?gain|stock|brokerage/.test(allContent)) profiles.add('investor');
  if (/student|tuition|1098-t|student\s?loan/.test(allContent)) profiles.add('student');
  if (/dependent|child|eitc|child\s?tax\s?credit|childcare/.test(allContent)) profiles.add('family');
  if (/hsa|retirement|1099-r|social\s?security|401\(?k\)?|403\(?b\)?|ira/.test(allContent)) profiles.add('hsa_retirement');
  if (/rental|farm|schedule\s?e|partnership|k-?1/.test(allContent)) profiles.add('rental_farm');
  if (/solar|ev\b|electric\s?vehicle|energy\s?credit|home\s?improvement/.test(allContent)) profiles.add('energy_credits');
  if (/itemiz|mortgage|state\s?tax|charit|schedule\s?a/.test(allContent)) profiles.add('itemized');
  if (/household\s?employ|nanny|housekeeper|schedule\s?h/.test(allContent)) profiles.add('household_employer');

  return profiles;
}

/** Extract filing status from skills content. */
export function extractFilingStatusFromSkills(
  skills: { name: string; content: string }[],
): string | null {
  const profile = skills.find((s) => s.name === 'tax_profile');
  if (!profile) return null;
  const lower = profile.content.toLowerCase();

  if (/married\s+filing\s+jointly/.test(lower)) return 'married_filing_jointly';
  if (/married\s+filing\s+separate/.test(lower)) return 'married_filing_separately';
  if (/head\s+of\s+household/.test(lower)) return 'head_of_household';
  if (/qualifying\s+surviving/.test(lower)) return 'qualifying_surviving_spouse';
  if (/\bsingle\b/.test(lower)) return 'single';
  return null;
}

/** Extract hasDependents from skills content. */
export function extractDependentsFromSkills(
  skills: { name: string; content: string }[],
): boolean | null {
  const profile = skills.find((s) => s.name === 'tax_profile');
  if (!profile) return null;
  if (/dependent|child/i.test(profile.content)) return true;
  return null;
}

/** Get list of empty identity field keys. */
export function getEmptyFields(identity: Record<string, string>): string[] {
  return IDENTITY_FIELDS
    .map((f) => f.key)
    .filter((key) => !identity[key]?.trim());
}
